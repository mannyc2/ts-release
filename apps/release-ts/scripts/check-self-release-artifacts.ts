import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { cwd, exit } from "node:process"

const root = cwd()
const packagePath = "package.json"
const releaseConfigPath = "apps/release-ts/release.config.json"
const defaultTwinePython = ".release/twine-venv/bin/python"
const maxPyPiArtifactBytes = 100 * 1024 * 1024
const skipTwineCheck = process.env.SELF_RELEASE_SKIP_TWINE_CHECK === "1"

interface Check {
  readonly id: string
  readonly ok: boolean
  readonly message: string
}

interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"))

const readText = (path: string): string =>
  readFileSync(resolve(root, path), "utf8")

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const stringField = (record: Record<string, unknown>, name: string): string | undefined => {
  const value = record[name]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

const normalizedTemplatePackageName = (name: string): string => {
  const withoutScopePrefix = name.startsWith("@") ? name.slice(1) : name
  return withoutScopePrefix.replaceAll("/", "-")
}

const expandReleaseTemplate = (value: string, packageName: string, packageVersion: string): string =>
  value
    .split("{version}").join(packageVersion)
    .split("{name}").join(packageName)
    .split("{normalizedName}").join(normalizedTemplatePackageName(packageName))

const fileCheck = (id: string, path: string, label: string): Check => ({
  id,
  ok: existsSync(resolve(root, path)) && statSync(resolve(root, path)).isFile(),
  message: existsSync(resolve(root, path)) && statSync(resolve(root, path)).isFile()
    ? `${label} exists at ${path}.`
    : `${label} must exist at ${path}.`
})

const fileSizeCheck = (id: string, path: string, maxBytes: number, label: string): Check => {
  const resolved = resolve(root, path)
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    return {
      id,
      ok: false,
      message: `${label} must exist at ${path} before size can be checked.`
    }
  }
  const bytes = statSync(resolved).size
  return {
    id,
    ok: bytes <= maxBytes,
    message: bytes <= maxBytes
      ? `${label} is ${bytes} bytes, within the ${maxBytes} byte limit.`
      : `${label} is ${bytes} bytes, above the ${maxBytes} byte limit.`
  }
}

const runCommand = async (args: ReadonlyArray<string>): Promise<CommandResult> => {
  const subprocess = Bun.spawn([...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  const stdout = streamText(subprocess.stdout)
  const stderr = streamText(subprocess.stderr)
  const exitCode = await subprocess.exited
  return {
    exitCode,
    stdout: await stdout,
    stderr: await stderr
  }
}

const targetById = (targets: ReadonlyArray<unknown>, id: string): Record<string, unknown> | undefined =>
  targets.find((target): target is Record<string, unknown> => isRecord(target) && target.id === id)

const collectArtifactPaths = (
  recipes: ReadonlyArray<unknown>,
  packageName: string,
  packageVersion: string
): {
  readonly binaries: ReadonlyArray<string>
  readonly wheels: ReadonlyArray<{ readonly path: string; readonly wheelTag: string | undefined }>
} => {
  const binaries: Array<string> = []
  const wheels: Array<{ readonly path: string; readonly wheelTag: string | undefined }> = []
  for (const recipe of recipes) {
    if (!isRecord(recipe)) {
      continue
    }
    if (recipe._tag === "BunExecutableArtifactRecipe" && Array.isArray(recipe.outputs)) {
      for (const output of recipe.outputs) {
        if (!isRecord(output)) {
          continue
        }
        const path = stringField(output, "path")
        if (path !== undefined) {
          binaries.push(expandReleaseTemplate(path, packageName, packageVersion))
        }
      }
    }
    if (recipe._tag === "PyPiWheelArtifactRecipe") {
      const path = stringField(recipe, "path")
      if (path !== undefined) {
        wheels.push({
          path: expandReleaseTemplate(path, packageName, packageVersion),
          wheelTag: stringField(recipe, "wheelTag")
        })
      }
    }
  }
  return {
    binaries,
    wheels
  }
}

const pythonExecutable = (pypiTarget: Record<string, unknown> | undefined): string => {
  if (process.env.SELF_RELEASE_PYTHON !== undefined && process.env.SELF_RELEASE_PYTHON.length > 0) {
    return process.env.SELF_RELEASE_PYTHON
  }
  if (existsSync(resolve(root, defaultTwinePython))) {
    return defaultTwinePython
  }
  return pypiTarget === undefined ? "python3" : stringField(pypiTarget, "pythonExecutable") ?? "python3"
}

const twineCheck = async (
  pypiTarget: Record<string, unknown> | undefined,
  wheels: ReadonlyArray<{ readonly path: string }>
): Promise<Check> => {
  if (skipTwineCheck) {
    return {
      id: "pypi:twine-check",
      ok: true,
      message: "Twine metadata check skipped by SELF_RELEASE_SKIP_TWINE_CHECK=1."
    }
  }
  if (wheels.length === 0) {
    return {
      id: "pypi:twine-check",
      ok: false,
      message: "No PyPI wheel artifacts were found to check with Twine."
    }
  }
  const python = pythonExecutable(pypiTarget)
  const wheelPaths = wheels.map((wheel) => wheel.path)
  const result = await runCommand([python, "-m", "twine", "check", ...wheelPaths])
  return {
    id: "pypi:twine-check",
    ok: result.exitCode === 0,
    message: result.exitCode === 0
      ? "Twine accepted all generated PyPI wheel metadata."
      : `Twine rejected generated PyPI wheel metadata: ${(result.stderr || result.stdout).trim()}`
  }
}

const wheelMetadataChecks = (
  index: number,
  wheel: { readonly path: string; readonly wheelTag: string | undefined }
): ReadonlyArray<Check> => {
  const resolved = resolve(root, wheel.path)
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    return []
  }
  const contents = readFileSync(resolved, "utf8")
  return [
    {
      id: `pypi:wheel-root-is-purelib:${index}`,
      ok: contents.includes("Root-Is-Purelib: false"),
      message: contents.includes("Root-Is-Purelib: false")
        ? "PyPI wheel declares platform-library installation metadata."
        : "PyPI wheel must declare Root-Is-Purelib: false because it bundles a platform-specific CLI binary."
    },
    {
      id: `pypi:wheel-tag:${index}`,
      ok: wheel.wheelTag !== undefined && contents.includes(`Tag: ${wheel.wheelTag}`),
      message: wheel.wheelTag !== undefined && contents.includes(`Tag: ${wheel.wheelTag}`)
        ? `PyPI wheel metadata declares tag ${wheel.wheelTag}.`
        : "PyPI wheel metadata must declare the configured wheelTag."
    }
  ]
}

const homebrewChecks = (
  target: Record<string, unknown> | undefined,
  packageVersion: string
): ReadonlyArray<Check> => {
  const formulaPath = target === undefined ? undefined : stringField(target, "formulaPath")
  if (formulaPath === undefined) {
    return [
      {
        id: "homebrew:formula-path",
        ok: false,
        message: "Homebrew formulaPath must be configured."
      }
    ]
  }
  const exists = fileCheck("homebrew:formula-file", formulaPath, "Homebrew formula")
  if (!exists.ok) {
    return [exists]
  }
  const contents = readText(formulaPath)
  return [
    exists,
    {
      id: "homebrew:formula-version",
      ok: contents.includes(`version "${packageVersion}"`),
      message: contents.includes(`version "${packageVersion}"`)
        ? `Homebrew formula references version ${packageVersion}.`
        : `Homebrew formula must reference version ${packageVersion}.`
    },
    {
      id: "homebrew:formula-downloads",
      ok: contents.includes(`/download/v${packageVersion}/`),
      message: contents.includes(`/download/v${packageVersion}/`)
        ? `Homebrew formula URLs reference GitHub release v${packageVersion}.`
        : `Homebrew formula URLs must reference GitHub release v${packageVersion}.`
    },
    {
      id: "homebrew:formula-executable-bit",
      ok: contents.includes("chmod 0755"),
      message: contents.includes("chmod 0755")
        ? "Homebrew formula ensures the installed CLI is executable."
        : "Homebrew formula must ensure the installed CLI is executable."
    },
    {
      id: "homebrew:formula-test",
      ok: contents.includes("test do") && contents.includes("File.executable?"),
      message: contents.includes("test do") && contents.includes("File.executable?")
        ? "Homebrew formula includes an install smoke test for the CLI."
        : "Homebrew formula must include an install smoke test for the CLI."
    }
  ]
}

const scoopChecks = (
  target: Record<string, unknown> | undefined,
  packageVersion: string
): ReadonlyArray<Check> => {
  const manifestPath = target === undefined ? undefined : stringField(target, "manifestPath")
  if (manifestPath === undefined) {
    return [
      {
        id: "scoop:manifest-path",
        ok: false,
        message: "Scoop manifestPath must be configured."
      }
    ]
  }
  const exists = fileCheck("scoop:manifest-file", manifestPath, "Scoop manifest")
  if (!exists.ok) {
    return [exists]
  }
  const parsed: unknown = readJson(manifestPath)
  if (!isRecord(parsed)) {
    return [
      exists,
      {
        id: "scoop:manifest-json",
        ok: false,
        message: "Scoop manifest must be a JSON object."
      }
    ]
  }
  const version = stringField(parsed, "version")
  const url = stringField(parsed, "url")
  const hash = stringField(parsed, "hash")
  return [
    exists,
    {
      id: "scoop:manifest-version",
      ok: version === packageVersion,
      message: version === packageVersion
        ? `Scoop manifest references version ${packageVersion}.`
        : `Scoop manifest version must be ${packageVersion}.`
    },
    {
      id: "scoop:manifest-download",
      ok: url !== undefined && url.includes(`/download/v${packageVersion}/`),
      message: url !== undefined && url.includes(`/download/v${packageVersion}/`)
        ? `Scoop manifest URL references GitHub release v${packageVersion}.`
        : `Scoop manifest URL must reference GitHub release v${packageVersion}.`
    },
    {
      id: "scoop:manifest-sha256",
      ok: hash !== undefined && /^[a-f0-9]{64}$/.test(hash),
      message: hash !== undefined && /^[a-f0-9]{64}$/.test(hash)
        ? "Scoop manifest has a sha256 hash."
        : "Scoop manifest must have a 64-character sha256 hash."
    }
  ]
}

const printChecks = (checks: ReadonlyArray<Check>): void => {
  for (const check of checks) {
    console.log(`${check.ok ? "ok  " : "fail"} ${check.id}: ${check.message}`)
  }
}

const checks: Array<Check> = []
const manifest = readJson(packagePath)
const config = readJson(releaseConfigPath)

if (!isRecord(manifest)) {
  checks.push({ id: "manifest:shape", ok: false, message: `${packagePath} must be a JSON object.` })
}
if (!isRecord(config)) {
  checks.push({ id: "config:shape", ok: false, message: `${releaseConfigPath} must be a JSON object.` })
}

if (isRecord(manifest) && isRecord(config)) {
  const packageName = stringField(manifest, "name")
  const packageVersion = stringField(manifest, "version")
  const recipes = config.artifactRecipes
  const targets = config.targets

  if (packageName === undefined) {
    checks.push({ id: "manifest:name", ok: false, message: `${packagePath} name must be configured.` })
  }
  if (packageVersion === undefined) {
    checks.push({ id: "manifest:version", ok: false, message: `${packagePath} version must be configured.` })
  }
  if (!Array.isArray(recipes)) {
    checks.push({ id: "config:artifact-recipes", ok: false, message: `${releaseConfigPath} artifactRecipes must be an array.` })
  }
  if (!Array.isArray(targets)) {
    checks.push({ id: "config:targets", ok: false, message: `${releaseConfigPath} targets must be an array.` })
  }

  if (packageName !== undefined && packageVersion !== undefined && Array.isArray(recipes) && Array.isArray(targets)) {
    const artifacts = collectArtifactPaths(recipes, packageName, packageVersion)
    for (const [index, path] of artifacts.binaries.entries()) {
      checks.push(fileCheck(`github:binary:${index}`, path, "CLI binary artifact"))
    }
    for (const [index, wheel] of artifacts.wheels.entries()) {
      checks.push(
        fileCheck(`pypi:wheel:${index}`, wheel.path, "PyPI wheel artifact"),
        fileSizeCheck(`pypi:wheel-size:${index}`, wheel.path, maxPyPiArtifactBytes, "PyPI wheel artifact"),
        ...wheelMetadataChecks(index, wheel)
      )
    }
    checks.push(
      ...homebrewChecks(targetById(targets, "homebrew"), packageVersion),
      ...scoopChecks(targetById(targets, "scoop"), packageVersion),
      await twineCheck(targetById(targets, "pypi"), artifacts.wheels)
    )
  }
}

printChecks(checks)

if (checks.some((check) => !check.ok)) {
  exit(1)
}
