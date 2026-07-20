import { exit } from "node:process"
import { disposeReleaseRuntime, plan, type ReleasePlanSummary } from "../../../src/index.js"
import {
  appPackagePath,
  binaryArtifactFacts,
  configuredCliBuild,
  decodeReleaseConfig,
  expectedCliOutput,
  expectedCliTargets,
  expectedPackageName,
  expectedRepositories,
  identityFor,
  isJsonObject,
  packagePath,
  readJson,
  readOptionalText,
  releaseConfigPath,
  releaseWorkflowFileName,
  runCommand,
  stringField,
  wheelArtifactFacts
} from "./self-release-facts.js"

const description = "Portable artifact and package-manager distribution planning for TypeScript projects."

const currentGitCommit = async (): Promise<string | undefined> => {
  const result = await runCommand(["git", "rev-parse", "--short", "HEAD"])
  return result.exitCode === 0 ? result.stdout.trim() : undefined
}

const envExampleDocuments = (contents: string, name: string): boolean =>
  contents.split(/\r?\n/).some((line) => line.trim() === name || line.trim().startsWith(`${name}=`))

const failures: Array<string> = []
const manifest = readJson(packagePath)
const appManifest = readJson(appPackagePath)

const { config, error: configError } = decodeReleaseConfig(true)

let summary: ReleasePlanSummary | undefined

try {
  summary = await plan({ config: releaseConfigPath })
} catch (error) {
  failures.push(`release plan must be constructible: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await disposeReleaseRuntime()
}

if (!isJsonObject(manifest)) failures.push("package.json must be a JSON object")
if (!isJsonObject(appManifest)) failures.push(`${appPackagePath} must be a JSON object`)
if (config === undefined) {
  failures.push(`${releaseConfigPath} must decode against the release config schema: ${configError ?? "unknown decode error"}`)
}

if (isJsonObject(manifest) && isJsonObject(appManifest) && config !== undefined) {
  const packageName = stringField(manifest, "name")
  const version = stringField(manifest, "version")
  const appVersion = stringField(appManifest, "version")
  if (packageName !== expectedPackageName) failures.push(`package name must equal ${expectedPackageName}`)
  if (version !== undefined && appVersion !== undefined && appVersion !== version) {
    failures.push(`${appPackagePath} version ${appVersion} must match package version ${version}`)
  }

  const project = config.project
  if (project.name !== undefined || project.version !== undefined || project.tag !== undefined) {
    failures.push("release project must derive name, version, and tag from package manifest data")
  }
  if (project.packagePath !== undefined && project.packagePath !== packagePath) {
    failures.push(`release project packagePath ${String(project.packagePath)} must be ${packagePath} or omitted`)
  }
  if (project.tagTemplate !== "v{version}") {
    failures.push(`release project tagTemplate ${String(project.tagTemplate)} must equal v{version}`)
  }
  const commit = project.commit
  const gitCommit = await currentGitCommit()
  if (commit === "replace-with-release-commit" || commit === "0000000") {
    failures.push("release project commit must not use a placeholder value")
  }
  if (commit !== undefined && commit !== "HEAD" && gitCommit !== undefined && commit !== gitCommit) {
    failures.push(`release project commit ${commit} must match current git commit ${gitCommit}`)
  }

  if (version !== undefined && packageName !== undefined) {
    const identity = identityFor(packageName, version)
    const build = configuredCliBuild(config)
    if (build === undefined) {
      failures.push(`${releaseConfigPath} builds must include cli`)
    } else {
      if (build.entry !== "apps/release-ts/src/cli/main.ts") failures.push("build cli entry must equal apps/release-ts/src/cli/main.ts")
      if (build.binaryName !== "ts-release") failures.push("build cli binaryName must equal ts-release")
      if (build.installPath !== "bin/ts-release") failures.push("build cli installPath must equal bin/ts-release")
      const configuredTargets = build.targets ?? []
      if (configuredTargets.length !== expectedCliTargets.length || expectedCliTargets.some((target, index) => configuredTargets[index] !== target)) {
        failures.push(`build cli targets must equal ${expectedCliTargets.join(", ")}`)
      }
      const output = build.output
      if (output === undefined || !output.includes("{version}") || !output.includes("{targetTriple}") || !output.includes("{ext}")) {
        failures.push("build cli output must include {version}, {targetTriple}, and {ext}")
      } else {
        const expectedPaths = new Map(binaryArtifactFacts(build, identity, expectedCliOutput).map((fact) => [fact.target, fact.path]))
        for (const fact of binaryArtifactFacts(build, identity)) {
          const expected = expectedPaths.get(fact.target)
          if (expected !== undefined && fact.path !== expected) {
            failures.push(`build cli output for ${fact.target} expands to ${fact.path}; expected ${expected}`)
          }
        }
      }
    }

    const artifactPaths = new Map(summary?.artifacts.map((artifact) => [artifact.id, artifact.path]) ?? [])
    const binaries = build === undefined ? [] : binaryArtifactFacts(build, identity)
    for (const fact of binaries) {
      if (artifactPaths.get(fact.id) !== fact.path) {
        failures.push(`planned artifact ${fact.id} must come from the CLI build at ${fact.path}`)
      }
    }

    const wheelSection = config.pypiWheel
    const wheels = wheelArtifactFacts(config, identity)
    const staticArtifacts = new Set((config.artifacts ?? []).map((artifact) => artifact.id))
    for (const id of [...binaries.map(({ id }) => id), ...wheels.map(({ id }) => id)]) {
      if (staticArtifacts.has(id)) failures.push(`artifact ${id} must be declared by builds, not artifacts`)
    }

    if (wheelSection !== undefined) {
      const familyExpectations = [
        ["packageName", wheelSection.packageName, "ts-release"],
        ["moduleName", wheelSection.moduleName, "ts_release"],
        ["consoleScript", wheelSection.consoleScript, "ts-release"],
        ["requiresPython", wheelSection.requiresPython, ">=3.8"]
      ] as const
      for (const [field, actual, expected] of familyExpectations) {
        if (actual !== expected) failures.push(`pypiWheel ${field} must equal ${expected}`)
      }
    }
    const wheelById = new Map(wheels.map((wheel) => [wheel.id, wheel]))
    for (const target of build?.targets ?? []) {
      const expectedId = `pypi-wheel-${target}`
      if (!wheelById.has(expectedId)) failures.push(`${releaseConfigPath} pypiWheel must include ${expectedId}`)
    }
    const binaryByTarget = new Map<string, string>(binaries.map((binary) => [binary.target, binary.path]))
    for (const wheel of wheels) {
      const binary = wheel.binary
      if (binary === undefined) {
        failures.push(`PyPI wheel ${wheel.id} must include one platform binary`)
        continue
      }
      const target = `${binary.os}-${binary.arch}`
      const expectedId = `pypi-wheel-${target}`
      if (wheel.id !== expectedId) failures.push(`PyPI wheel ${wheel.id} id must equal ${expectedId}`)
      if (!wheel.path.endsWith(`-${wheel.wheelTag}.whl`)) {
        failures.push(`PyPI wheel ${wheel.id} path ${wheel.path} must end with its configured wheelTag ${wheel.wheelTag}`)
      }
      const expectedWheelPath = `${wheelSection?.moduleName}/bin/${wheelSection?.consoleScript}-${target}${binary.os === "windows" ? ".exe" : ""}`
      if (binary.wheelPath !== expectedWheelPath) {
        failures.push(`PyPI wheel ${wheel.id} binary ${target} wheelPath ${binary.wheelPath} must equal ${expectedWheelPath}`)
      }
      const expectedSource = binaryByTarget.get(target)
      if (expectedSource === undefined || binary.sourcePath !== expectedSource) {
        failures.push(`PyPI wheel ${wheel.id} binary ${target} sourcePath ${binary.sourcePath} must equal configured build path ${String(expectedSource)}`)
      }
      if (artifactPaths.get(wheel.id) !== wheel.path) {
        failures.push(`planned artifact ${wheel.id} must come from the PyPI wheel build at ${wheel.path}`)
      }
    }
  }

  const publish = config.publish
  const npm = typeof publish.npm === "object" ? publish.npm : undefined
  const github = typeof publish.github === "object" ? publish.github : undefined
  const pypi = typeof publish.pypi === "object" ? publish.pypi : undefined
  const homebrew = publish.homebrew
  const scoop = publish.scoop

  const publishSections = [
    ["github", publish.github],
    ["homebrew", publish.homebrew],
    ["npm", publish.npm],
    ["pypi", publish.pypi],
    ["scoop", publish.scoop]
  ] as const
  for (const [id, section] of publishSections) {
    if (typeof section !== "object" || section === null) failures.push(`self-release publish must include ${id}`)
  }

  const envExample = readOptionalText(".env.example")
  const tokenNames = [npm?.tokenEnv, github?.tokenEnv]
    .filter((name): name is string => typeof name === "string")
  if (tokenNames.length > 0 && envExample === undefined) failures.push(".env.example must document release token environment variables")
  for (const name of tokenNames) {
    if (envExample !== undefined && !envExampleDocuments(envExample, name)) failures.push(`.env.example must document ${name}`)
  }

  if (npm?.provenance !== true) failures.push("npm self-release target must enable provenance for GitHub Actions publishing")
  if (npm !== undefined && npm.packageName !== packageName) {
    failures.push(`npm self-release target packageName ${String(npm.packageName)} must match package name ${String(packageName)}`)
  }
  const npmTrusted = typeof npm?.trustedPublishing === "object" ? npm.trustedPublishing : undefined
  if (
    npmTrusted?.provider !== "github-actions" ||
    npmTrusted.workflow !== releaseWorkflowFileName ||
    npmTrusted.verifyPackageExists !== true
  ) {
    failures.push("npm self-release target must use GitHub Actions trusted publishing")
  }

  if (github?.repository === "owner/repo") failures.push("GitHub release target repository must not use owner/repo placeholder")

  if (config.project.description !== description) failures.push("self-release project.description must match the package description")
  if (config.project.homepage !== `https://github.com/${expectedRepositories.github}`) failures.push(`self-release project.homepage must equal https://github.com/${expectedRepositories.github}`)
  if (config.project.license !== "MIT") failures.push("self-release project.license must equal MIT")

  if (homebrew?.repository !== expectedRepositories.homebrew) failures.push(`self-release target homebrew repository must equal ${expectedRepositories.homebrew}`)
  if (homebrew?.formulaPath !== ".release/catalogs/homebrew-ts-release/Formula/ts-release.rb") failures.push("self-release target homebrew formulaPath must equal .release/catalogs/homebrew-ts-release/Formula/ts-release.rb")
  if (homebrew?.tapDirectory !== ".release/catalogs/homebrew-ts-release") failures.push("self-release target homebrew tapDirectory must equal .release/catalogs/homebrew-ts-release")
  const configuredBinaries = version === undefined || packageName === undefined
    ? []
    : configuredCliBuild(config) === undefined
    ? []
    : binaryArtifactFacts(configuredCliBuild(config)!, identityFor(packageName, version))
  const homebrewIds = configuredBinaries.filter(({ target }) => target.startsWith("darwin-")).map(({ id }) => id).sort()
  if (JSON.stringify(homebrew?.ids) !== JSON.stringify(homebrewIds)) {
    failures.push(`self-release target homebrew ids must equal ${homebrewIds.join(", ")}`)
  }

  if (scoop?.repository !== expectedRepositories.scoop) failures.push(`self-release target scoop repository must equal ${expectedRepositories.scoop}`)
  if (scoop?.manifestPath !== ".release/catalogs/scoop-ts-release/bucket/ts-release.json") failures.push("self-release target scoop manifestPath must equal .release/catalogs/scoop-ts-release/bucket/ts-release.json")
  if (scoop?.bucketDirectory !== ".release/catalogs/scoop-ts-release") failures.push("self-release target scoop bucketDirectory must equal .release/catalogs/scoop-ts-release")
  const scoopIds = configuredBinaries.filter(({ target }) => target.startsWith("windows-")).map(({ id }) => id)
  if (JSON.stringify(scoop?.ids) !== JSON.stringify(scoopIds)) failures.push(`self-release target scoop ids must equal ${scoopIds.join(", ")}`)

  if (pypi?.repositoryUrl !== "https://upload.pypi.org/legacy/") failures.push("self-release target pypi repositoryUrl must equal https://upload.pypi.org/legacy/")
  if (pypi?.pythonExecutable !== "python3") failures.push("self-release target pypi pythonExecutable must equal python3")
  const pypiTrusted = typeof pypi?.trustedPublishing === "object" ? pypi.trustedPublishing : undefined
  if (pypiTrusted?.provider !== "github-actions" || pypiTrusted.workflow !== releaseWorkflowFileName || pypiTrusted.publisherConfigured !== true) {
    failures.push("pypi trustedPublishing.publisherConfigured must equal true")
  }
}

if (failures.length > 0) {
  console.error("Self-release config checks failed:")
  for (const failure of failures) console.error(`- ${failure}`)
  exit(1)
}
