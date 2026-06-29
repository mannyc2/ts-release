import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd, exit } from "node:process"

const root = cwd()
const currentCommitSelector = "HEAD"
const placeholderCommits = new Set(["replace-with-release-commit", "0000000"])
const appPackagePath = "apps/release-ts/package.json"
const releaseConfigPath = "apps/release-ts/release.config.json"
const releaseCliRecipeId = "release-ts-cli"
const releaseCliEntrypoint = "apps/release-ts/src/cli/main.ts"
const pypiWheelArtifactPrefix = "pypi-wheel"

interface ExpectedRecipeOutput {
  readonly id: string
  readonly target: string
  readonly path: string
  readonly downloadUrl: string
  readonly consumers: ReadonlyArray<string>
}

interface ExpectedPyPiWheelBinary {
  readonly os: string
  readonly arch: string
  readonly sourcePath: string
  readonly wheelPath: string
}

interface ExpectedPyPiWheelRecipe {
  readonly id: string
  readonly path: string
  readonly wheelTag: string
  readonly binary: ExpectedPyPiWheelBinary
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"))

const readText = (path: string): string | undefined => {
  try {
    return readFileSync(resolve(root, path), "utf8")
  } catch {
    return undefined
  }
}

const field = (record: Record<string, unknown>, name: string): unknown =>
  record[name]

const stringField = (record: Record<string, unknown>, name: string, failures: Array<string>): string | undefined => {
  const value = field(record, name)
  if (typeof value !== "string" || value.length === 0) {
    failures.push(`${name} must be a non-empty string`)
    return undefined
  }
  return value
}

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const readCurrentGitCommit = async (): Promise<string | undefined> => {
  const subprocess = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore"
  })
  const stdout = await streamText(subprocess.stdout)
  const exitCode = await subprocess.exited
  return exitCode === 0 ? stdout.trim() : undefined
}

const readTrackedGitStatus = async (): Promise<string | undefined> => {
  const subprocess = Bun.spawn(["git", "status", "--porcelain", "--untracked-files=no"], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore"
  })
  const stdout = await streamText(subprocess.stdout)
  const exitCode = await subprocess.exited
  return exitCode === 0 ? stdout.trim() : undefined
}

const collectTokenEnvNames = (targets: ReadonlyArray<unknown>): ReadonlyArray<string> => {
  const names = new Set<string>()
  for (const target of targets) {
    if (isRecord(target) && typeof target.tokenEnv === "string" && target.tokenEnv.length > 0) {
      names.add(target.tokenEnv)
    }
    if (isRecord(target) && typeof target.usernameEnv === "string" && target.usernameEnv.length > 0) {
      names.add(target.usernameEnv)
    }
    if (isRecord(target) && typeof target.passwordEnv === "string" && target.passwordEnv.length > 0) {
      names.add(target.passwordEnv)
    }
  }
  return [...names].sort()
}

const stringArrayIncludes = (value: unknown, expected: string): boolean =>
  Array.isArray(value) && value.some((item) => item === expected)

const normalizedTemplatePackageName = (name: string): string => {
  const withoutScopePrefix = name.startsWith("@") ? name.slice(1) : name
  return withoutScopePrefix.replaceAll("/", "-")
}

const expandReleaseTemplate = (value: string, packageName: string, packageVersion: string): string =>
  value
    .split("{version}").join(packageVersion)
    .split("{name}").join(packageName)
    .split("{normalizedName}").join(normalizedTemplatePackageName(packageName))

const collectArtifactRecords = (
  artifacts: ReadonlyArray<unknown>,
  failures: Array<string>
): Map<string, Record<string, unknown>> => {
  const records = new Map<string, Record<string, unknown>>()
  for (const artifact of artifacts) {
    if (!isRecord(artifact)) {
      failures.push("release artifacts must be objects")
      continue
    }
    const id = artifact.id
    if (typeof id !== "string" || id.length === 0) {
      failures.push("release artifact id must be a non-empty string")
      continue
    }
    records.set(id, artifact)
  }
  return records
}

const collectRecipeRecords = (
  recipes: ReadonlyArray<unknown>,
  failures: Array<string>
): Map<string, Record<string, unknown>> => {
  const records = new Map<string, Record<string, unknown>>()
  for (const recipe of recipes) {
    if (!isRecord(recipe)) {
      failures.push("artifact recipes must be objects")
      continue
    }
    const id = recipe.id
    if (typeof id !== "string" || id.length === 0) {
      failures.push("artifact recipe id must be a non-empty string")
      continue
    }
    records.set(id, recipe)
  }
  return records
}

const collectOutputRecords = (
  outputs: ReadonlyArray<unknown>,
  recipeId: string,
  failures: Array<string>
): Map<string, Record<string, unknown>> => {
  const records = new Map<string, Record<string, unknown>>()
  for (const output of outputs) {
    if (!isRecord(output)) {
      failures.push(`artifact recipe ${recipeId} outputs must be objects`)
      continue
    }
    const id = output.id
    if (typeof id !== "string" || id.length === 0) {
      failures.push(`artifact recipe ${recipeId} output id must be a non-empty string`)
      continue
    }
    records.set(id, output)
  }
  return records
}

const checkArtifactPath = (
  artifact: Record<string, unknown> | undefined,
  id: string,
  expectedPath: string,
  expectedFormat: string,
  expectedConsumers: ReadonlyArray<string>,
  packageName: string,
  packageVersion: string,
  failures: Array<string>
): void => {
  if (artifact === undefined) {
    failures.push(`release config must include artifact ${id}`)
    return
  }
  if (typeof artifact.path !== "string" || artifact.path.length === 0) {
    failures.push(`artifact ${id} path must be a non-empty string`)
    return
  }
  const expandedPath = expandReleaseTemplate(artifact.path, packageName, packageVersion)
  if (expandedPath !== expectedPath) {
    failures.push(`artifact ${id} path ${artifact.path} expands to ${expandedPath}; expected ${expectedPath}`)
  }
  if (artifact.path.startsWith(".release/artifacts/") && !artifact.path.includes("{version}")) {
    failures.push(`artifact ${id} path ${artifact.path} must use {version}`)
  }
  if (artifact.format !== expectedFormat) {
    failures.push(`artifact ${id} format ${String(artifact.format)} must equal ${expectedFormat}`)
  }
  for (const consumer of expectedConsumers) {
    if (!stringArrayIncludes(artifact.consumers, consumer)) {
      failures.push(`artifact ${id} must be consumed by ${consumer}`)
    }
  }
}

const expectedRecipeOutputs = (version: string): ReadonlyArray<ExpectedRecipeOutput> => [
  {
    id: "cli-linux-x64",
    target: "bun-linux-x64-baseline",
    path: `.release/artifacts/ts-release-${version}-linux-x64`,
    downloadUrl: `https://github.com/mannyc2/ts-release/releases/download/v${version}/ts-release-${version}-linux-x64`,
    consumers: ["github"]
  },
  {
    id: "cli-linux-arm64",
    target: "bun-linux-arm64",
    path: `.release/artifacts/ts-release-${version}-linux-arm64`,
    downloadUrl: `https://github.com/mannyc2/ts-release/releases/download/v${version}/ts-release-${version}-linux-arm64`,
    consumers: ["github"]
  },
  {
    id: "cli-darwin-x64",
    target: "bun-darwin-x64",
    path: `.release/artifacts/ts-release-${version}-darwin-x64`,
    downloadUrl: `https://github.com/mannyc2/ts-release/releases/download/v${version}/ts-release-${version}-darwin-x64`,
    consumers: ["github", "homebrew"]
  },
  {
    id: "cli-darwin-arm64",
    target: "bun-darwin-arm64",
    path: `.release/artifacts/ts-release-${version}-darwin-arm64`,
    downloadUrl: `https://github.com/mannyc2/ts-release/releases/download/v${version}/ts-release-${version}-darwin-arm64`,
    consumers: ["github", "homebrew"]
  },
  {
    id: "cli-windows-x64",
    target: "bun-windows-x64-baseline",
    path: `.release/artifacts/ts-release-${version}-windows-x64.exe`,
    downloadUrl: `https://github.com/mannyc2/ts-release/releases/download/v${version}/ts-release-${version}-windows-x64.exe`,
    consumers: ["github", "scoop"]
  }
]

const expectedPyPiWheelRecipes = (version: string): ReadonlyArray<ExpectedPyPiWheelRecipe> => [
  {
    id: "pypi-wheel-linux-x64",
    path: `.release/artifacts/ts_release-${version}-py3-none-manylinux2014_x86_64.whl`,
    wheelTag: "py3-none-manylinux2014_x86_64",
    binary: {
      os: "linux",
      arch: "x64",
      sourcePath: `.release/artifacts/ts-release-${version}-linux-x64`,
      wheelPath: "ts_release/bin/ts-release-linux-x64"
    }
  },
  {
    id: "pypi-wheel-linux-arm64",
    path: `.release/artifacts/ts_release-${version}-py3-none-manylinux2014_aarch64.whl`,
    wheelTag: "py3-none-manylinux2014_aarch64",
    binary: {
      os: "linux",
      arch: "arm64",
      sourcePath: `.release/artifacts/ts-release-${version}-linux-arm64`,
      wheelPath: "ts_release/bin/ts-release-linux-arm64"
    }
  },
  {
    id: "pypi-wheel-darwin-x64",
    path: `.release/artifacts/ts_release-${version}-py3-none-macosx_10_15_x86_64.whl`,
    wheelTag: "py3-none-macosx_10_15_x86_64",
    binary: {
      os: "darwin",
      arch: "x64",
      sourcePath: `.release/artifacts/ts-release-${version}-darwin-x64`,
      wheelPath: "ts_release/bin/ts-release-darwin-x64"
    }
  },
  {
    id: "pypi-wheel-darwin-arm64",
    path: `.release/artifacts/ts_release-${version}-py3-none-macosx_11_0_arm64.whl`,
    wheelTag: "py3-none-macosx_11_0_arm64",
    binary: {
      os: "darwin",
      arch: "arm64",
      sourcePath: `.release/artifacts/ts-release-${version}-darwin-arm64`,
      wheelPath: "ts_release/bin/ts-release-darwin-arm64"
    }
  },
  {
    id: "pypi-wheel-windows-x64",
    path: `.release/artifacts/ts_release-${version}-py3-none-win_amd64.whl`,
    wheelTag: "py3-none-win_amd64",
    binary: {
      os: "windows",
      arch: "x64",
      sourcePath: `.release/artifacts/ts-release-${version}-windows-x64.exe`,
      wheelPath: "ts_release/bin/ts-release-windows-x64.exe"
    }
  }
]

const checkRecipeOutput = (
  output: Record<string, unknown> | undefined,
  expected: ExpectedRecipeOutput,
  packageName: string,
  packageVersion: string,
  failures: Array<string>
): void => {
  if (output === undefined) {
    failures.push(`artifact recipe ${releaseCliRecipeId} must include output ${expected.id}`)
    return
  }
  if (output.target !== expected.target) {
    failures.push(`artifact recipe output ${expected.id} target ${String(output.target)} must equal ${expected.target}`)
  }
  if (typeof output.path !== "string" || output.path.length === 0) {
    failures.push(`artifact recipe output ${expected.id} path must be a non-empty string`)
    return
  }
  const expandedPath = expandReleaseTemplate(output.path, packageName, packageVersion)
  if (expandedPath !== expected.path) {
    failures.push(`artifact recipe output ${expected.id} path ${output.path} expands to ${expandedPath}; expected ${expected.path}`)
  }
  if (output.path.startsWith(".release/artifacts/") && !output.path.includes("{version}")) {
    failures.push(`artifact recipe output ${expected.id} path ${output.path} must use {version}`)
  }
  if (typeof output.downloadUrl !== "string" || output.downloadUrl.length === 0) {
    failures.push(`artifact recipe output ${expected.id} downloadUrl must be a non-empty string`)
  } else {
    const expandedDownloadUrl = expandReleaseTemplate(output.downloadUrl, packageName, packageVersion)
    if (expandedDownloadUrl !== expected.downloadUrl) {
      failures.push(
        `artifact recipe output ${expected.id} downloadUrl ${output.downloadUrl} expands to ${expandedDownloadUrl}; expected ${expected.downloadUrl}`
      )
    }
  }
  for (const consumer of expected.consumers) {
    if (!stringArrayIncludes(output.consumers, consumer)) {
      failures.push(`artifact recipe output ${expected.id} must be consumed by ${consumer}`)
    }
  }
}

const checkPyPiWheelPath = (
  recipe: Record<string, unknown>,
  expected: ExpectedPyPiWheelRecipe,
  packageName: string,
  packageVersion: string,
  failures: Array<string>
): void => {
  if (typeof recipe.path !== "string" || recipe.path.length === 0) {
    failures.push(`artifact recipe ${expected.id} path must be a non-empty string`)
    return
  }
  const expandedPath = expandReleaseTemplate(recipe.path, packageName, packageVersion)
  if (expandedPath !== expected.path) {
    failures.push(`artifact recipe ${expected.id} path ${recipe.path} expands to ${expandedPath}; expected ${expected.path}`)
  }
  if (recipe.path.startsWith(".release/artifacts/") && !recipe.path.includes("{version}")) {
    failures.push(`artifact recipe ${expected.id} path ${recipe.path} must use {version}`)
  }
  if (recipe.wheelTag !== expected.wheelTag) {
    failures.push(`artifact recipe ${expected.id} wheelTag ${String(recipe.wheelTag)} must equal ${expected.wheelTag}`)
  }
}

const checkPyPiWheelBinary = (
  recipeId: string,
  binary: Record<string, unknown> | undefined,
  key: string,
  expected: ExpectedPyPiWheelBinary,
  packageName: string,
  packageVersion: string,
  failures: Array<string>
): void => {
  if (binary === undefined) {
    failures.push(`artifact recipe ${recipeId} must include binary ${key}`)
    return
  }
  if (binary.os !== expected.os) {
    failures.push(`artifact recipe ${recipeId} binary ${key} os ${String(binary.os)} must equal ${expected.os}`)
  }
  if (binary.arch !== expected.arch) {
    failures.push(`artifact recipe ${recipeId} binary ${key} arch ${String(binary.arch)} must equal ${expected.arch}`)
  }
  if (typeof binary.sourcePath !== "string" || binary.sourcePath.length === 0) {
    failures.push(`artifact recipe ${recipeId} binary ${key} sourcePath must be a non-empty string`)
  } else {
    const expandedSourcePath = expandReleaseTemplate(binary.sourcePath, packageName, packageVersion)
    if (expandedSourcePath !== expected.sourcePath) {
      failures.push(
        `artifact recipe ${recipeId} binary ${key} sourcePath ${binary.sourcePath} expands to ${expandedSourcePath}; expected ${expected.sourcePath}`
      )
    }
    if (binary.sourcePath.startsWith(".release/artifacts/") && !binary.sourcePath.includes("{version}")) {
      failures.push(`artifact recipe ${recipeId} binary ${key} sourcePath ${binary.sourcePath} must use {version}`)
    }
  }
  if (binary.wheelPath !== expected.wheelPath) {
    failures.push(`artifact recipe ${recipeId} binary ${key} wheelPath ${String(binary.wheelPath)} must equal ${expected.wheelPath}`)
  }
}

const collectPyPiWheelBinaryRecords = (
  recipeId: string,
  binaries: ReadonlyArray<unknown>,
  failures: Array<string>
): Map<string, Record<string, unknown>> => {
  const records = new Map<string, Record<string, unknown>>()
  for (const binary of binaries) {
    if (!isRecord(binary)) {
      failures.push(`artifact recipe ${recipeId} binaries must be objects`)
      continue
    }
    if (typeof binary.os !== "string" || typeof binary.arch !== "string") {
      failures.push(`artifact recipe ${recipeId} binary os and arch must be non-empty strings`)
      continue
    }
    records.set(`${binary.os}-${binary.arch}`, binary)
  }
  return records
}

const envExampleDocuments = (contents: string, name: string): boolean =>
  contents.split(/\r?\n/).some((line) => {
    const trimmed = line.trim()
    return trimmed === name || trimmed.startsWith(`${name}=`)
  })

const collectTargetRecords = (
  targets: ReadonlyArray<unknown>,
  failures: Array<string>
): Map<string, Record<string, unknown>> => {
  const records = new Map<string, Record<string, unknown>>()
  for (const target of targets) {
    if (!isRecord(target)) {
      failures.push("release targets must be objects")
      continue
    }
    const id = target.id
    if (typeof id !== "string" || id.length === 0) {
      failures.push("release target id must be a non-empty string")
      continue
    }
    records.set(id, target)
  }
  return records
}

const checkTargetField = (
  target: Record<string, unknown> | undefined,
  targetId: string,
  fieldName: string,
  expected: unknown,
  failures: Array<string>
): void => {
  if (target === undefined) {
    failures.push(`self-release targets must include ${targetId}`)
    return
  }
  if (field(target, fieldName) !== expected) {
    failures.push(`self-release target ${targetId} ${fieldName} must equal ${String(expected)}`)
  }
}

const checkTargetArrayField = (
  target: Record<string, unknown> | undefined,
  targetId: string,
  fieldName: string,
  expected: ReadonlyArray<string>,
  failures: Array<string>
): void => {
  if (target === undefined) {
    failures.push(`self-release targets must include ${targetId}`)
    return
  }
  const value = field(target, fieldName)
  if (!Array.isArray(value) || value.length !== expected.length || expected.some((item, index) => value[index] !== item)) {
    failures.push(`self-release target ${targetId} ${fieldName} must equal ${expected.join(", ")}`)
  }
}

const failures: Array<string> = []
const manifest = readJson("package.json")
const appManifest = readJson(appPackagePath)
const config = readJson(releaseConfigPath)
const currentGitCommit = await readCurrentGitCommit()
const trackedGitStatus = await readTrackedGitStatus()

if (!isRecord(manifest)) {
  failures.push("package.json must be a JSON object")
}
if (!isRecord(appManifest)) {
  failures.push(`${appPackagePath} must be a JSON object`)
}
if (!isRecord(config)) {
  failures.push(`${releaseConfigPath} must be a JSON object`)
}

if (isRecord(manifest) && isRecord(appManifest) && isRecord(config)) {
  const packageName = stringField(manifest, "name", failures)
  const packageVersion = stringField(manifest, "version", failures)
  const appVersion = stringField(appManifest, "version", failures)
  if (packageVersion !== undefined && appVersion !== undefined && appVersion !== packageVersion) {
    failures.push(`${appPackagePath} version ${appVersion} must match package version ${packageVersion}`)
  }
  if (packageName === "release") {
    failures.push("package name `release` is already published on npm; use the confirmed scoped package name")
  }
  const identity = field(config, "identity")
  if (!isRecord(identity)) {
    failures.push(`${releaseConfigPath} identity must be an object`)
  } else {
    const sourceTag = stringField(identity, "_tag", failures)
    const commit = stringField(identity, "commit", failures)
    const tagTemplate = stringField(identity, "tagTemplate", failures)
    const packagePathValue = field(identity, "packagePath")

    if (sourceTag !== undefined && sourceTag !== "PackageManifestReleaseIdentitySource") {
      failures.push(`release identity source ${sourceTag} must be PackageManifestReleaseIdentitySource`)
    }
    if (field(identity, "name") !== undefined || field(identity, "version") !== undefined || field(identity, "tag") !== undefined) {
      failures.push("release identity must derive name, version, and tag from package manifest data")
    }
    if (packagePathValue !== undefined && packagePathValue !== "package.json") {
      failures.push(`release identity packagePath ${String(packagePathValue)} must be package.json or omitted`)
    }
    if (commit !== undefined && placeholderCommits.has(commit)) {
      failures.push("release identity commit must not use a placeholder value")
    }
    if (commit === currentCommitSelector && currentGitCommit === undefined) {
      failures.push("release identity commit HEAD requires a committed Git checkout")
    }
    if (commit === currentCommitSelector && currentGitCommit !== undefined && trackedGitStatus !== undefined && trackedGitStatus.length > 0) {
      failures.push("release identity commit HEAD requires a clean tracked working tree")
    }
    if (commit !== undefined && commit !== currentCommitSelector && currentGitCommit !== undefined && commit !== currentGitCommit) {
      failures.push(`release identity commit ${commit} must match current git commit ${currentGitCommit}`)
    }
    if (tagTemplate !== undefined && tagTemplate !== "v{version}") {
      failures.push(`release identity tagTemplate ${tagTemplate} must equal v{version}`)
    }
  }

  const artifacts = field(config, "artifacts")
  if (!Array.isArray(artifacts)) {
    failures.push(`${releaseConfigPath} artifacts must be an array`)
  } else if (packageName !== undefined && packageVersion !== undefined) {
    const artifactRecords = collectArtifactRecords(artifacts, failures)
    checkArtifactPath(
      artifactRecords.get("npm-package"),
      "npm-package",
      ".",
      "directory",
      ["npm"],
      packageName,
      packageVersion,
      failures
    )
    for (const artifactId of artifactRecords.keys()) {
      if (artifactId.startsWith("cli-") || artifactId.startsWith(pypiWheelArtifactPrefix)) {
        failures.push(`artifact ${artifactId} must be declared by artifactRecipes, not static artifacts`)
      } else if (artifactId !== "npm-package") {
        failures.push(`artifact ${artifactId} is not part of the self-release static artifact set`)
      }
    }
  }

  const artifactRecipes = field(config, "artifactRecipes")
  if (!Array.isArray(artifactRecipes)) {
    failures.push(`${releaseConfigPath} artifactRecipes must be an array`)
  } else if (packageName !== undefined && packageVersion !== undefined) {
    const recipes = collectRecipeRecords(artifactRecipes, failures)
    const expectedPyPiRecipes = expectedPyPiWheelRecipes(packageVersion)
    if (recipes.size !== 1 + expectedPyPiRecipes.length) {
      failures.push(`${releaseConfigPath} artifactRecipes must contain release-ts CLI and platform PyPI wheel recipes`)
    }
    const recipe = recipes.get(releaseCliRecipeId)
    if (recipe === undefined) {
      failures.push(`${releaseConfigPath} artifactRecipes must include recipe ${releaseCliRecipeId}`)
    } else {
      if (recipe._tag !== "BunExecutableArtifactRecipe") {
        failures.push(`artifact recipe ${releaseCliRecipeId} _tag must be BunExecutableArtifactRecipe`)
      }
      if (recipe.entrypoint !== releaseCliEntrypoint) {
        failures.push(`artifact recipe ${releaseCliRecipeId} entrypoint ${String(recipe.entrypoint)} must equal ${releaseCliEntrypoint}`)
      }
      const outputs = field(recipe, "outputs")
      if (!Array.isArray(outputs)) {
        failures.push(`artifact recipe ${releaseCliRecipeId} outputs must be an array`)
      } else {
        const outputRecords = collectOutputRecords(outputs, releaseCliRecipeId, failures)
        for (const expected of expectedRecipeOutputs(packageVersion)) {
          checkRecipeOutput(outputRecords.get(expected.id), expected, packageName, packageVersion, failures)
        }
        for (const outputId of outputRecords.keys()) {
          if (!expectedRecipeOutputs(packageVersion).some((expected) => expected.id === outputId)) {
            failures.push(`artifact recipe ${releaseCliRecipeId} has unexpected output ${outputId}`)
          }
        }
      }
    }
    for (const expected of expectedPyPiRecipes) {
      const pypiWheelRecipe = recipes.get(expected.id)
      if (pypiWheelRecipe === undefined) {
        failures.push(`${releaseConfigPath} artifactRecipes must include recipe ${expected.id}`)
        continue
      }
      if (pypiWheelRecipe._tag !== "PyPiWheelArtifactRecipe") {
        failures.push(`artifact recipe ${expected.id} _tag must be PyPiWheelArtifactRecipe`)
      }
      checkPyPiWheelPath(pypiWheelRecipe, expected, packageName, packageVersion, failures)
      if (pypiWheelRecipe.packageName !== "ts-release") {
        failures.push(`artifact recipe ${expected.id} packageName must equal ts-release`)
      }
      if (pypiWheelRecipe.moduleName !== "ts_release") {
        failures.push(`artifact recipe ${expected.id} moduleName must equal ts_release`)
      }
      if (pypiWheelRecipe.consoleScript !== "ts-release") {
        failures.push(`artifact recipe ${expected.id} consoleScript must equal ts-release`)
      }
      if (pypiWheelRecipe.summary !== "Portable artifact and package-manager distribution planning for TypeScript projects.") {
        failures.push(`artifact recipe ${expected.id} summary must match package description`)
      }
      if (pypiWheelRecipe.homepage !== "https://github.com/mannyc2/ts-release") {
        failures.push(`artifact recipe ${expected.id} homepage must equal https://github.com/mannyc2/ts-release`)
      }
      if (pypiWheelRecipe.license !== "MIT") {
        failures.push(`artifact recipe ${expected.id} license must equal MIT`)
      }
      if (pypiWheelRecipe.requiresPython !== ">=3.8") {
        failures.push(`artifact recipe ${expected.id} requiresPython must equal >=3.8`)
      }
      if (!stringArrayIncludes(pypiWheelRecipe.consumers, "pypi")) {
        failures.push(`artifact recipe ${expected.id} must be consumed by pypi`)
      }
      const binaries = field(pypiWheelRecipe, "binaries")
      if (!Array.isArray(binaries)) {
        failures.push(`artifact recipe ${expected.id} binaries must be an array`)
      } else {
        const binaryRecords = collectPyPiWheelBinaryRecords(expected.id, binaries, failures)
        const key = `${expected.binary.os}-${expected.binary.arch}`
        checkPyPiWheelBinary(expected.id, binaryRecords.get(key), key, expected.binary, packageName, packageVersion, failures)
        for (const binaryKey of binaryRecords.keys()) {
          if (binaryKey !== key) {
            failures.push(`artifact recipe ${expected.id} has unexpected binary ${binaryKey}`)
          }
        }
      }
    }
    for (const recipeId of recipes.keys()) {
      if (recipeId !== releaseCliRecipeId && !expectedPyPiRecipes.some((expected) => expected.id === recipeId)) {
        failures.push(`${releaseConfigPath} artifactRecipes has unexpected recipe ${recipeId}`)
      }
    }
  }

  const targets = field(config, "targets")
  if (!Array.isArray(targets)) {
    failures.push(`${releaseConfigPath} targets must be an array`)
  } else {
    const tokenEnvNames = collectTokenEnvNames(targets)
    const envExample = readText(".env.example")
    if (tokenEnvNames.length > 0 && envExample === undefined) {
      failures.push(".env.example must document release token environment variables")
    }
    if (envExample !== undefined) {
      for (const name of tokenEnvNames) {
        if (!envExampleDocuments(envExample, name)) {
          failures.push(`.env.example must document ${name}`)
        }
      }
    }
    const targetRecords = collectTargetRecords(targets, failures)
    for (const expectedTargetId of ["github", "homebrew", "npm", "pypi", "scoop"]) {
      if (!targetRecords.has(expectedTargetId)) {
        failures.push(`self-release targets must include ${expectedTargetId}`)
      }
    }
    for (const targetId of targetRecords.keys()) {
      if (!["github", "homebrew", "npm", "pypi", "scoop"].includes(targetId)) {
        failures.push(`self-release target ${targetId} is not expected yet`)
      }
    }
    checkTargetField(targetRecords.get("homebrew"), "homebrew", "_tag", "HomebrewTapTarget", failures)
    checkTargetField(targetRecords.get("homebrew"), "homebrew", "repository", "mannyc2/homebrew-ts-release", failures)
    checkTargetField(
      targetRecords.get("homebrew"),
      "homebrew",
      "description",
      "Portable artifact and package-manager distribution planning for TypeScript projects.",
      failures
    )
    checkTargetField(
      targetRecords.get("homebrew"),
      "homebrew",
      "formulaPath",
      ".release/catalogs/homebrew-ts-release/Formula/ts-release.rb",
      failures
    )
    checkTargetField(
      targetRecords.get("homebrew"),
      "homebrew",
      "tapDirectory",
      ".release/catalogs/homebrew-ts-release",
      failures
    )
    checkTargetArrayField(targetRecords.get("homebrew"), "homebrew", "artifactIds", ["cli-darwin-arm64", "cli-darwin-x64"], failures)
    checkTargetField(targetRecords.get("scoop"), "scoop", "_tag", "ScoopBucketTarget", failures)
    checkTargetField(targetRecords.get("scoop"), "scoop", "repository", "mannyc2/scoop-ts-release", failures)
    checkTargetField(
      targetRecords.get("scoop"),
      "scoop",
      "manifestPath",
      ".release/catalogs/scoop-ts-release/bucket/ts-release.json",
      failures
    )
    checkTargetField(targetRecords.get("scoop"), "scoop", "bucketDirectory", ".release/catalogs/scoop-ts-release", failures)
    checkTargetField(targetRecords.get("scoop"), "scoop", "artifactId", "cli-windows-x64", failures)
    checkTargetField(targetRecords.get("pypi"), "pypi", "_tag", "PyPiRegistryTarget", failures)
    checkTargetField(targetRecords.get("pypi"), "pypi", "repositoryUrl", "https://upload.pypi.org/legacy/", failures)
    checkTargetField(targetRecords.get("pypi"), "pypi", "pythonExecutable", "python3", failures)
    const pypiTarget = targetRecords.get("pypi")
    if (pypiTarget !== undefined) {
      if (field(pypiTarget, "usernameEnv") !== undefined || field(pypiTarget, "passwordEnv") !== undefined) {
        failures.push("pypi self-release target must use trusted publishing instead of TWINE_USERNAME/TWINE_PASSWORD")
      }
      const trustedPublishing = field(pypiTarget, "trustedPublishing")
      if (!isRecord(trustedPublishing)) {
        failures.push("pypi self-release target must declare trustedPublishing")
      } else {
        if (trustedPublishing.provider !== "github-actions") {
          failures.push("pypi trustedPublishing.provider must equal github-actions")
        }
        if (trustedPublishing.workflow !== "release.yml") {
          failures.push("pypi trustedPublishing.workflow must equal release.yml")
        }
        if (trustedPublishing.publisherConfigured !== true) {
          failures.push("pypi trustedPublishing.publisherConfigured must equal true")
        }
      }
    }
    for (const target of targets) {
      if (!isRecord(target)) {
        continue
      }
      if (target._tag === "GitHubReleaseTarget" && target.repository === "owner/repo") {
        failures.push("GitHub release target repository must not use owner/repo placeholder")
      }
      if (target._tag === "NpmRegistryTarget" && target.id === "npm" && target.provenance !== true) {
        failures.push("npm self-release target must enable provenance for GitHub Actions publishing")
      }
      if (target._tag === "NpmRegistryTarget" && target.id === "npm" && target.packageName !== packageName) {
        failures.push(`npm self-release target packageName ${String(target.packageName)} must match package name ${packageName}`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Self-release config checks failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  exit(1)
}
