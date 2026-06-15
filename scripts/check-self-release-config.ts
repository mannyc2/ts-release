import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd, exit } from "node:process"

const root = cwd()
const currentCommitSelector = "HEAD"
const placeholderCommits = new Set(["replace-with-release-commit", "0000000"])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"))

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

const failures: Array<string> = []
const manifest = readJson("package.json")
const config = readJson("release.config.json")
const currentGitCommit = await readCurrentGitCommit()

if (!isRecord(manifest)) {
  failures.push("package.json must be a JSON object")
}
if (!isRecord(config)) {
  failures.push("release.config.json must be a JSON object")
}

if (isRecord(manifest) && isRecord(config)) {
  const packageName = stringField(manifest, "name", failures)
  const packageVersion = stringField(manifest, "version", failures)
  if (packageName === "release") {
    failures.push("package name `release` is already published on npm; use the confirmed scoped package name")
  }
  const identity = field(config, "identity")
  if (!isRecord(identity)) {
    failures.push("release.config.json identity must be an object")
  } else {
    const releaseName = stringField(identity, "name", failures)
    const releaseVersion = stringField(identity, "version", failures)
    const commit = stringField(identity, "commit", failures)
    const tag = stringField(identity, "tag", failures)

    if (packageName !== undefined && releaseName !== undefined && packageName !== releaseName) {
      failures.push(`release identity name ${releaseName} must match package name ${packageName}`)
    }
    if (packageVersion !== undefined && releaseVersion !== undefined && packageVersion !== releaseVersion) {
      failures.push(`release identity version ${releaseVersion} must match package version ${packageVersion}`)
    }
    if (commit !== undefined && placeholderCommits.has(commit)) {
      failures.push("release identity commit must not use a placeholder value")
    }
    if (commit === currentCommitSelector && currentGitCommit === undefined) {
      failures.push("release identity commit HEAD requires a committed Git checkout")
    }
    if (commit !== undefined && commit !== currentCommitSelector && currentGitCommit !== undefined && commit !== currentGitCommit) {
      failures.push(`release identity commit ${commit} must match current git commit ${currentGitCommit}`)
    }
    if (releaseVersion !== undefined && tag !== undefined && tag !== `v${releaseVersion}`) {
      failures.push(`release identity tag ${tag} must match v${releaseVersion}`)
    }
  }

  const targets = field(config, "targets")
  if (!Array.isArray(targets)) {
    failures.push("release.config.json targets must be an array")
  } else {
    for (const target of targets) {
      if (!isRecord(target)) {
        failures.push("release targets must be objects")
        continue
      }
      if (target._tag === "GitHubReleaseTarget" && target.repository === "owner/repo") {
        failures.push("GitHub release target repository must not use owner/repo placeholder")
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
