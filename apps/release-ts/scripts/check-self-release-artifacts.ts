import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { cwd, exit } from "node:process"

const root = cwd()
const packagePath = "package.json"
const releaseConfigPath = "apps/release-ts/release.config.json"
const defaultTwinePython = ".release/twine-venv/bin/python"
const maxPyPiArtifactBytes = 100 * 1024 * 1024
const skipTwineCheck = process.env.SELF_RELEASE_SKIP_TWINE_CHECK === "1"

type JsonRecord = Record<string, unknown>

interface Check {
  readonly id: string
  readonly ok: boolean
  readonly message: string
}

interface WheelArtifact {
  readonly path: string
  readonly wheelTag: string | undefined
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"))

const readText = (path: string): string =>
  readFileSync(resolve(root, path), "utf8")

const field = (record: JsonRecord, key: string): string | undefined => {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

const record = (value: JsonRecord, key: string): JsonRecord | undefined =>
  isRecord(value[key]) ? value[key] : undefined

const check = (id: string, ok: boolean, okMessage: string, failMessage = okMessage): Check => ({
  id,
  ok,
  message: ok ? okMessage : failMessage
})

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

const normalizedName = (name: string): string =>
  (name.startsWith("@") ? name.slice(1) : name).replaceAll("/", "-")

const expand = (value: string, packageName: string, packageVersion: string): string =>
  value
    .split("{version}").join(packageVersion)
    .split("{name}").join(packageName)
    .split("{normalizedName}").join(normalizedName(packageName))

const buildOutput = (value: string, packageName: string, packageVersion: string, target: string): string =>
  expand(value, packageName, packageVersion)
    .split("{targetTriple}").join(target)
    .split("{ext}").join(target === "windows-x64" ? ".exe" : "")

const singleOrManyRecords = (value: unknown): ReadonlyArray<JsonRecord> =>
  Array.isArray(value) ? value.filter(isRecord) : isRecord(value) ? [value] : []

const publishTarget = (publish: JsonRecord, id: string): JsonRecord | undefined =>
  record(publish, id)

const collectArtifactPaths = (
  config: JsonRecord,
  packageName: string,
  packageVersion: string
): { readonly binaries: ReadonlyArray<string>; readonly wheels: ReadonlyArray<WheelArtifact> } => {
  const binaries: Array<string> = []
  const wheels: Array<WheelArtifact> = []
  for (const build of singleOrManyRecords(config.builds)) {
    const output = field(build, "output")
    const targets = Array.isArray(build.targets) ? build.targets : []
    if (build.builder !== "bun" || output === undefined) continue
    for (const target of targets) {
      if (typeof target === "string") binaries.push(buildOutput(output, packageName, packageVersion, target))
    }
  }
  for (const wheel of singleOrManyRecords(config.pypiWheel)) {
    const path = field(wheel, "path")
    if (path !== undefined) wheels.push({ path: expand(path, packageName, packageVersion), wheelTag: field(wheel, "wheelTag") })
  }
  return { binaries, wheels }
}

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const runCommand = async (args: ReadonlyArray<string>): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> => {
  const subprocess = Bun.spawn([...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  const stdout = streamText(subprocess.stdout)
  const stderr = streamText(subprocess.stderr)
  const exitCode = await subprocess.exited
  return { exitCode, stdout: await stdout, stderr: await stderr }
}

const pythonExecutable = (pypiTarget: JsonRecord | undefined): string => {
  const explicit = process.env.SELF_RELEASE_PYTHON
  if (explicit !== undefined && explicit.length > 0) return explicit
  if (existsSync(resolve(root, defaultTwinePython))) return defaultTwinePython
  return pypiTarget === undefined ? "python3" : field(pypiTarget, "pythonExecutable") ?? "python3"
}

const twineCheck = async (pypiTarget: JsonRecord | undefined, wheels: ReadonlyArray<WheelArtifact>): Promise<Check> => {
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

const wheelMetadataChecks = (index: number, wheel: WheelArtifact): ReadonlyArray<Check> => {
  if (fileBytes(wheel.path) === undefined) return []
  const contents = readFileSync(resolve(root, wheel.path), "utf8")
  return [
    check("pypi:wheel-root-is-purelib:" + index, contents.includes("Root-Is-Purelib: false"), "PyPI wheel declares platform-library installation metadata.", "PyPI wheel must declare Root-Is-Purelib: false because it bundles a platform-specific CLI binary."),
    check("pypi:wheel-tag:" + index, wheel.wheelTag !== undefined && contents.includes(`Tag: ${wheel.wheelTag}`), `PyPI wheel metadata declares tag ${wheel.wheelTag}.`, "PyPI wheel metadata must declare the configured wheelTag.")
  ]
}

const contentChecks = (checks: ReadonlyArray<readonly [string, boolean, string, string]>): ReadonlyArray<Check> =>
  checks.map(([id, ok, okMessage, failMessage]) => check(id, ok, okMessage, failMessage))

const homebrewChecks = (target: JsonRecord | undefined, packageVersion: string): ReadonlyArray<Check> => {
  const formulaPath = target === undefined ? undefined : field(target, "formulaPath")
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

const scoopChecks = (target: JsonRecord | undefined, packageVersion: string): ReadonlyArray<Check> => {
  const manifestPath = target === undefined ? undefined : field(target, "manifestPath")
  if (manifestPath === undefined) return [check("scoop:manifest-path", false, "", "Scoop manifestPath must be configured.")]
  const exists = fileCheck("scoop:manifest-file", manifestPath, "Scoop manifest")
  if (!exists.ok) return [exists]
  const parsed = readJson(manifestPath)
  if (!isRecord(parsed)) return [exists, check("scoop:manifest-json", false, "", "Scoop manifest must be a JSON object.")]
  const version = field(parsed, "version")
  const url = field(parsed, "url")
  const hash = field(parsed, "hash")
  return [
    exists,
    ...contentChecks([
      ["scoop:manifest-version", version === packageVersion, `Scoop manifest references version ${packageVersion}.`, `Scoop manifest version must be ${packageVersion}.`],
      ["scoop:manifest-download", url !== undefined && url.includes(`/download/v${packageVersion}/`), `Scoop manifest URL references GitHub release v${packageVersion}.`, `Scoop manifest URL must reference GitHub release v${packageVersion}.`],
      ["scoop:manifest-sha256", hash !== undefined && /^[a-f0-9]{64}$/.test(hash), "Scoop manifest has a sha256 hash.", "Scoop manifest must have a 64-character sha256 hash."]
    ])
  ]
}

const printChecks = (checks: ReadonlyArray<Check>): void => {
  for (const item of checks) console.log(`${item.ok ? "ok  " : "fail"} ${item.id}: ${item.message}`)
}

const checks: Array<Check> = []
const manifest = readJson(packagePath)
const config = readJson(releaseConfigPath)

if (!isRecord(manifest)) checks.push(check("manifest:shape", false, "", `${packagePath} must be a JSON object.`))
if (!isRecord(config)) checks.push(check("config:shape", false, "", `${releaseConfigPath} must be a JSON object.`))

if (isRecord(manifest) && isRecord(config)) {
  const packageName = field(manifest, "name")
  const packageVersion = field(manifest, "version")
  const publish = config.publish
  if (packageName === undefined) checks.push(check("manifest:name", false, "", `${packagePath} name must be configured.`))
  if (packageVersion === undefined) checks.push(check("manifest:version", false, "", `${packagePath} version must be configured.`))
  if (!isRecord(publish)) checks.push(check("config:publish", false, "", `${releaseConfigPath} publish must be an object.`))

  if (packageName !== undefined && packageVersion !== undefined && isRecord(publish)) {
    const artifacts = collectArtifactPaths(config, packageName, packageVersion)
    for (const [index, path] of artifacts.binaries.entries()) checks.push(fileCheck(`github:binary:${index}`, path, "CLI binary artifact"))
    for (const [index, wheel] of artifacts.wheels.entries()) {
      checks.push(
        fileCheck(`pypi:wheel:${index}`, wheel.path, "PyPI wheel artifact"),
        fileSizeCheck(`pypi:wheel-size:${index}`, wheel.path, maxPyPiArtifactBytes, "PyPI wheel artifact"),
        ...wheelMetadataChecks(index, wheel)
      )
    }
    checks.push(
      ...homebrewChecks(publishTarget(publish, "homebrew"), packageVersion),
      ...scoopChecks(publishTarget(publish, "scoop"), packageVersion),
      await twineCheck(publishTarget(publish, "pypi"), artifacts.wheels)
    )
  }
}

printChecks(checks)
if (checks.some((item) => !item.ok)) exit(1)
