import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd, exit } from "node:process"
import * as Schema from "effect/Schema"
import { ReleaseConfig } from "../../../src/config/schema.js"
import { platformTargetVariant } from "../../../src/pipeline/platform.js"
import { ReleaseIdentity } from "../../../src/pipeline/state.js"
import { normalizedName, renderTemplate } from "../../../src/pipeline/template.js"
import { disposeReleaseRuntime, plan, type ReleasePlanSummary } from "../../../src/index.js"

const root = cwd()
const appPackagePath = "apps/release-ts/package.json"
const releaseConfigPath = "apps/release-ts/release.config.json"
const expectedPackageName = "@mannyc1/ts-release"
const description = "Portable artifact and package-manager distribution planning for TypeScript projects."
const targets = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"] as const

const decodeReleaseConfig = Schema.decodeUnknownSync(ReleaseConfig)

// Only for JSON the tool does not own a schema for (package manifests).
const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringField = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"))

const readText = (path: string): string | undefined => {
  try {
    return readFileSync(resolve(root, path), "utf8")
  } catch {
    return undefined
  }
}

const identityFor = (packageName: string, packageVersion: string): ReleaseIdentity =>
  ReleaseIdentity.make({
    name: packageName,
    normalizedName: normalizedName(packageName),
    version: packageVersion,
    tag: "",
    commit: "",
    shortCommit: "",
    versionSource: "manifest",
    snapshot: false
  })

const expectedBinaryPath = (version: string, target: string): string =>
  `.release/artifacts/ts-release-${version}-${target}${target === "windows-x64" ? ".exe" : ""}`

const wheelFacts = (version: string) => [
  ["pypi-wheel-linux-x64", "py3-none-manylinux2014_x86_64", "linux", "x64", `ts_release/bin/ts-release-linux-x64`, `.release/artifacts/ts_release-${version}-py3-none-manylinux2014_x86_64.whl`],
  ["pypi-wheel-linux-arm64", "py3-none-manylinux2014_aarch64", "linux", "arm64", `ts_release/bin/ts-release-linux-arm64`, `.release/artifacts/ts_release-${version}-py3-none-manylinux2014_aarch64.whl`],
  ["pypi-wheel-darwin-x64", "py3-none-macosx_10_15_x86_64", "darwin", "x64", `ts_release/bin/ts-release-darwin-x64`, `.release/artifacts/ts_release-${version}-py3-none-macosx_10_15_x86_64.whl`],
  ["pypi-wheel-darwin-arm64", "py3-none-macosx_11_0_arm64", "darwin", "arm64", `ts_release/bin/ts-release-darwin-arm64`, `.release/artifacts/ts_release-${version}-py3-none-macosx_11_0_arm64.whl`],
  ["pypi-wheel-windows-x64", "py3-none-win_amd64", "windows", "x64", `ts_release/bin/ts-release-windows-x64.exe`, `.release/artifacts/ts_release-${version}-py3-none-win_amd64.whl`]
] as const

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const currentGitCommit = async (): Promise<string | undefined> => {
  const subprocess = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore"
  })
  const stdout = await streamText(subprocess.stdout)
  return await subprocess.exited === 0 ? stdout.trim() : undefined
}

const envExampleDocuments = (contents: string, name: string): boolean =>
  contents.split(/\r?\n/).some((line) => line.trim() === name || line.trim().startsWith(`${name}=`))

const failures: Array<string> = []
const manifest = readJson("package.json")
const appManifest = readJson(appPackagePath)

const decodedConfig = (): { readonly config?: ReleaseConfig; readonly error?: string } => {
  try {
    return { config: decodeReleaseConfig(readJson(releaseConfigPath)) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: message.split("\n").map((line) => line.trim()).filter((line) => line.length > 0).join(" | ") }
  }
}
const { config, error: configError } = decodedConfig()

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
  if (project.packagePath !== undefined && project.packagePath !== "package.json") {
    failures.push(`release project packagePath ${String(project.packagePath)} must be package.json or omitted`)
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
    const build = (config.builds ?? []).find((item) => item.id === "cli")
    if (build === undefined) {
      failures.push(`${releaseConfigPath} builds must include cli`)
    } else if (build.builder !== "bun") {
      failures.push("build cli builder must equal bun")
    } else {
      if (build.entry !== "apps/release-ts/src/cli/main.ts") failures.push("build cli entry must equal apps/release-ts/src/cli/main.ts")
      if (build.binaryName !== "ts-release") failures.push("build cli binaryName must equal ts-release")
      if (build.installPath !== "bin/ts-release") failures.push("build cli installPath must equal bin/ts-release")
      const configuredTargets = build.targets ?? []
      if (configuredTargets.length !== targets.length || targets.some((target, index) => configuredTargets[index] !== target)) {
        failures.push(`build cli targets must equal ${targets.join(", ")}`)
      }
      const output = build.output
      if (output === undefined || !output.includes("{version}") || !output.includes("{targetTriple}") || !output.includes("{ext}")) {
        failures.push("build cli output must include {version}, {targetTriple}, and {ext}")
      } else {
        for (const target of targets) {
          const expanded = renderTemplate(output, {
            identity,
            platform: platformTargetVariant(target),
            targetTriple: target
          })
          const expected = expectedBinaryPath(version, target)
          if (expanded !== expected) {
            failures.push(`build cli output for ${target} expands to ${expanded}; expected ${expected}`)
          }
        }
      }
    }

    const artifactIds = new Set(summary?.artifacts.map((artifact) => artifact.id) ?? [])
    const artifactPaths = new Map(summary?.artifacts.map((artifact) => [artifact.id, artifact.path]) ?? [])
    for (const target of targets) {
      const id = `cli-${target}`
      if (!artifactIds.has(id) || artifactPaths.get(id) !== expectedBinaryPath(version, target)) {
        failures.push(`planned artifact ${id} must come from the CLI build at ${expectedBinaryPath(version, target)}`)
      }
    }

    const staticArtifacts = new Set((config.artifacts ?? []).map((artifact) => artifact.id))
    for (const id of [...targets.map((target) => `cli-${target}`), ...wheelFacts(version).map(([id]) => id)]) {
      if (staticArtifacts.has(id)) failures.push(`artifact ${id} must be declared by builds, not artifacts`)
    }

    const wheelSection = config.pypiWheel
    const wheelItems = wheelSection === undefined ? [] : Array.isArray(wheelSection) ? wheelSection : [wheelSection]
    const wheels = new Map(wheelItems.map((wheel) => [wheel.id, wheel]))
    for (const [id, wheelTag, os, arch, wheelPath, expectedPath] of wheelFacts(version)) {
      const wheel = wheels.get(id)
      if (wheel === undefined) {
        failures.push(`${releaseConfigPath} pypiWheel must include ${id}`)
        continue
      }
      const expandedPath = renderTemplate(wheel.path, { identity })
      if (expandedPath !== expectedPath) {
        failures.push(`PyPI wheel ${id} path ${wheel.path} expands to ${expandedPath}; expected ${expectedPath}`)
      }
      if (wheel.wheelTag !== wheelTag) failures.push(`PyPI wheel ${id} wheelTag ${String(wheel.wheelTag)} must equal ${wheelTag}`)
      const wheelExpectations = [
        ["packageName", wheel.packageName, "ts-release"],
        ["moduleName", wheel.moduleName, "ts_release"],
        ["consoleScript", wheel.consoleScript, "ts-release"],
        ["summary", wheel.summary, description],
        ["homepage", wheel.homepage, "https://github.com/mannyc2/ts-release"],
        ["license", wheel.license, "MIT"],
        ["requiresPython", wheel.requiresPython, ">=3.8"]
      ] as const
      for (const [field, actual, expected] of wheelExpectations) {
        if (actual !== expected) failures.push(`PyPI wheel ${id} ${field} must equal ${expected}`)
      }
      const binary = wheel.binaries[0]
      if (binary === undefined) {
        failures.push(`PyPI wheel ${id} must include binary ${os}-${arch}`)
      } else {
        if (binary.os !== os) failures.push(`PyPI wheel ${id} binary ${os}-${arch} os ${String(binary.os)} must equal ${os}`)
        if (binary.arch !== arch) failures.push(`PyPI wheel ${id} binary ${os}-${arch} arch ${String(binary.arch)} must equal ${arch}`)
        if (binary.wheelPath !== wheelPath) failures.push(`PyPI wheel ${id} binary ${os}-${arch} wheelPath ${String(binary.wheelPath)} must equal ${wheelPath}`)
        const expandedSource = renderTemplate(binary.sourcePath, { identity })
        const expectedSource = expectedBinaryPath(version, `${os}-${arch}`)
        if (expandedSource !== expectedSource) {
          failures.push(`PyPI wheel ${id} binary ${os}-${arch} sourcePath ${binary.sourcePath} expands incorrectly; expected ${expectedSource}`)
        }
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

  const envExample = readText(".env.example")
  const tokenNames = [npm?.tokenEnv, github?.tokenEnv, homebrew?.tokenEnv, scoop?.tokenEnv]
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
  if (npmTrusted?.provider !== "github-actions" || npmTrusted.workflow !== "release.yml" || npmTrusted.packageExists !== true) {
    failures.push("npm self-release target must use GitHub Actions trusted publishing")
  }

  if (github?.repository === "owner/repo") failures.push("GitHub release target repository must not use owner/repo placeholder")

  if (homebrew?.repository !== "mannyc2/homebrew-ts-release") failures.push("self-release target homebrew repository must equal mannyc2/homebrew-ts-release")
  if (homebrew?.description !== description) failures.push("self-release target homebrew description must match package description")
  if (homebrew?.formulaPath !== ".release/catalogs/homebrew-ts-release/Formula/ts-release.rb") failures.push("self-release target homebrew formulaPath must equal .release/catalogs/homebrew-ts-release/Formula/ts-release.rb")
  if (homebrew?.tapDirectory !== ".release/catalogs/homebrew-ts-release") failures.push("self-release target homebrew tapDirectory must equal .release/catalogs/homebrew-ts-release")
  if (JSON.stringify(homebrew?.artifactIds) !== JSON.stringify(["cli-darwin-arm64", "cli-darwin-x64"])) {
    failures.push("self-release target homebrew artifactIds must equal cli-darwin-arm64, cli-darwin-x64")
  }

  if (scoop?.repository !== "mannyc2/scoop-ts-release") failures.push("self-release target scoop repository must equal mannyc2/scoop-ts-release")
  if (scoop?.manifestPath !== ".release/catalogs/scoop-ts-release/bucket/ts-release.json") failures.push("self-release target scoop manifestPath must equal .release/catalogs/scoop-ts-release/bucket/ts-release.json")
  if (scoop?.bucketDirectory !== ".release/catalogs/scoop-ts-release") failures.push("self-release target scoop bucketDirectory must equal .release/catalogs/scoop-ts-release")
  if (scoop?.artifactId !== "cli-windows-x64") failures.push("self-release target scoop artifactId must equal cli-windows-x64")

  if (pypi?.repositoryUrl !== "https://upload.pypi.org/legacy/") failures.push("self-release target pypi repositoryUrl must equal https://upload.pypi.org/legacy/")
  if (pypi?.pythonExecutable !== "python3") failures.push("self-release target pypi pythonExecutable must equal python3")
  if (pypi?.usernameEnv !== undefined || pypi?.passwordEnv !== undefined) failures.push("pypi self-release target must use trusted publishing instead of TWINE_USERNAME/TWINE_PASSWORD")
  const pypiTrusted = typeof pypi?.trustedPublishing === "object" ? pypi.trustedPublishing : undefined
  if (pypiTrusted?.provider !== "github-actions" || pypiTrusted.workflow !== "release.yml" || pypiTrusted.publisherConfigured !== true) {
    failures.push("pypi trustedPublishing.publisherConfigured must equal true")
  }
}

if (failures.length > 0) {
  console.error("Self-release config checks failed:")
  for (const failure of failures) console.error(`- ${failure}`)
  exit(1)
}
