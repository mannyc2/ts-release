import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { exit } from "node:process"
import type { ReleaseConfigHomebrewPublish } from "../../../src/features/catalog/homebrew.js"
import type { ReleaseConfigScoopPublish } from "../../../src/features/catalog/scoop.js"
import type { ReleaseConfigPyPiPublish } from "../../../src/features/publish/pypi.js"
import {
  binaryArtifactFacts,
  check,
  configuredCliBuild,
  decodeReleaseConfig,
  identityFor,
  isJsonObject,
  packagePath,
  printChecks,
  readJson,
  readText,
  releaseConfigPath,
  root,
  runCommand,
  stringField,
  wheelArtifactFacts,
  type Check,
  type WheelArtifactFact
} from "./self-release-facts.js"

const defaultTwinePython = ".release/twine-venv/bin/python"
const maxPyPiArtifactBytes = 100 * 1024 * 1024
const skipTwineCheck = process.env.SELF_RELEASE_SKIP_TWINE_CHECK === "1"

const fileBytes = (path: string): number | undefined => {
  const resolved = resolve(root, path)
  if (!existsSync(resolved)) return undefined
  const stat = statSync(resolved)
  return stat.isFile() ? stat.size : undefined
}

const fileCheck = (id: string, path: string, label: string): Check =>
  check(id, fileBytes(path) !== undefined, `${label} exists at ${path}.`, `${label} must exist at ${path}.`)

const fileSizeCheck = (id: string, path: string, maxBytes: number, label: string): Check => {
  const bytes = fileBytes(path)
  return bytes === undefined
    ? check(id, false, "", `${label} must exist at ${path} before size can be checked.`)
    : check(id, bytes <= maxBytes, `${label} is ${bytes} bytes, within the ${maxBytes} byte limit.`, `${label} is ${bytes} bytes, above the ${maxBytes} byte limit.`)
}

const pythonExecutable = (pypiTarget: ReleaseConfigPyPiPublish | undefined): string => {
  const explicit = process.env.SELF_RELEASE_PYTHON
  if (explicit !== undefined && explicit.length > 0) return explicit
  if (existsSync(resolve(root, defaultTwinePython))) return defaultTwinePython
  const configured = pypiTarget?.pythonExecutable
  return configured !== undefined && configured.length > 0 ? configured : "python3"
}

const twineCheck = async (pypiTarget: ReleaseConfigPyPiPublish | undefined, wheels: ReadonlyArray<WheelArtifactFact>): Promise<Check> => {
  if (skipTwineCheck) return check("pypi:twine-check", true, "Twine metadata check skipped by SELF_RELEASE_SKIP_TWINE_CHECK=1.")
  if (wheels.length === 0) return check("pypi:twine-check", false, "", "No PyPI wheel artifacts were found to check with Twine.")
  const result = await runCommand([pythonExecutable(pypiTarget), "-m", "twine", "check", ...wheels.map((wheel) => wheel.path)])
  return check(
    "pypi:twine-check",
    result.exitCode === 0,
    "Twine accepted all generated PyPI wheel metadata.",
    `Twine rejected generated PyPI wheel metadata: ${(result.stderr || result.stdout).trim()}`
  )
}

const wheelMetadataChecks = (index: number, wheel: WheelArtifactFact): ReadonlyArray<Check> => {
  if (fileBytes(wheel.path) === undefined) return []
  const contents = readFileSync(resolve(root, wheel.path), "utf8")
  return [
    check("pypi:wheel-root-is-purelib:" + index, contents.includes("Root-Is-Purelib: false"), "PyPI wheel declares platform-library installation metadata.", "PyPI wheel must declare Root-Is-Purelib: false because it bundles a platform-specific CLI binary."),
    check("pypi:wheel-tag:" + index, wheel.wheelTag.length > 0 && contents.includes(`Tag: ${wheel.wheelTag}`), `PyPI wheel metadata declares tag ${wheel.wheelTag}.`, "PyPI wheel metadata must declare the configured wheelTag.")
  ]
}

const contentChecks = (checks: ReadonlyArray<readonly [string, boolean, string, string]>): ReadonlyArray<Check> =>
  checks.map(([id, ok, okMessage, failMessage]) => check(id, ok, okMessage, failMessage))

const homebrewChecks = (target: ReleaseConfigHomebrewPublish | undefined, packageVersion: string): ReadonlyArray<Check> => {
  const formulaPath = target?.formulaPath
  if (formulaPath === undefined) return [check("homebrew:formula-path", false, "", "Homebrew formulaPath must be configured.")]
  const exists = fileCheck("homebrew:formula-file", formulaPath, "Homebrew formula")
  if (!exists.ok) return [exists]
  const contents = readText(formulaPath)
  return [
    exists,
    ...contentChecks([
      ["homebrew:formula-version", contents.includes(`version "${packageVersion}"`), `Homebrew formula references version ${packageVersion}.`, `Homebrew formula must reference version ${packageVersion}.`],
      ["homebrew:formula-downloads", contents.includes(`/download/v${packageVersion}/`), `Homebrew formula URLs reference GitHub release v${packageVersion}.`, `Homebrew formula URLs must reference GitHub release v${packageVersion}.`],
      ["homebrew:formula-executable-bit", contents.includes("chmod 0755"), "Homebrew formula ensures the installed CLI is executable.", "Homebrew formula must ensure the installed CLI is executable."],
      ["homebrew:formula-test", contents.includes("test do") && contents.includes("File.executable?"), "Homebrew formula includes an install smoke test for the CLI.", "Homebrew formula must include an install smoke test for the CLI."]
    ])
  ]
}

const scoopChecks = (target: ReleaseConfigScoopPublish | undefined, packageVersion: string): ReadonlyArray<Check> => {
  const manifestPath = target?.manifestPath
  if (manifestPath === undefined) return [check("scoop:manifest-path", false, "", "Scoop manifestPath must be configured.")]
  const exists = fileCheck("scoop:manifest-file", manifestPath, "Scoop manifest")
  if (!exists.ok) return [exists]
  const parsed = readJson(manifestPath)
  if (!isJsonObject(parsed)) return [exists, check("scoop:manifest-json", false, "", "Scoop manifest must be a JSON object.")]
  const version = stringField(parsed, "version")
  const url = stringField(parsed, "url")
  const hash = stringField(parsed, "hash")
  return [
    exists,
    ...contentChecks([
      ["scoop:manifest-version", version === packageVersion, `Scoop manifest references version ${packageVersion}.`, `Scoop manifest version must be ${packageVersion}.`],
      ["scoop:manifest-download", url !== undefined && url.includes(`/download/v${packageVersion}/`), `Scoop manifest URL references GitHub release v${packageVersion}.`, `Scoop manifest URL must reference GitHub release v${packageVersion}.`],
      ["scoop:manifest-sha256", hash !== undefined && /^[a-f0-9]{64}$/.test(hash), "Scoop manifest has a sha256 hash.", "Scoop manifest must have a 64-character sha256 hash."]
    ])
  ]
}

const checks: Array<Check> = []
const manifest = readJson(packagePath)
const { config, error: configError } = decodeReleaseConfig()

if (!isJsonObject(manifest)) checks.push(check("manifest:shape", false, "", `${packagePath} must be a JSON object.`))
if (config === undefined) {
  checks.push(check("config:schema", false, "", `${releaseConfigPath} failed release config schema validation: ${configError ?? "unknown decode error"}`))
}

if (isJsonObject(manifest) && config !== undefined) {
  const packageName = stringField(manifest, "name")
  const packageVersion = stringField(manifest, "version")
  if (packageName === undefined) checks.push(check("manifest:name", false, "", `${packagePath} name must be configured.`))
  if (packageVersion === undefined) checks.push(check("manifest:version", false, "", `${packagePath} version must be configured.`))

  if (packageName !== undefined && packageVersion !== undefined) {
    const identity = identityFor(packageName, packageVersion)
    const build = configuredCliBuild(config)
    const binaries = build === undefined ? [] : binaryArtifactFacts(build, identity)
    const wheels = wheelArtifactFacts(config, identity)
    for (const [index, { path }] of binaries.entries()) checks.push(fileCheck(`github:binary:${index}`, path, "CLI binary artifact"))
    for (const [index, wheel] of wheels.entries()) {
      checks.push(
        fileCheck(`pypi:wheel:${index}`, wheel.path, "PyPI wheel artifact"),
        fileSizeCheck(`pypi:wheel-size:${index}`, wheel.path, maxPyPiArtifactBytes, "PyPI wheel artifact"),
        ...wheelMetadataChecks(index, wheel)
      )
    }
    const pypiTarget = typeof config.publish.pypi === "object" ? config.publish.pypi : undefined
    checks.push(
      ...homebrewChecks(config.publish.homebrew, packageVersion),
      ...scoopChecks(config.publish.scoop, packageVersion),
      await twineCheck(pypiTarget, wheels)
    )
  }
}

printChecks(checks)
if (checks.some((item) => !item.ok)) exit(1)
