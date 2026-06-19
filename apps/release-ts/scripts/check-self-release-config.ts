import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd, exit } from "node:process"
import { packageTarballArtifactPath, releaseCliArtifactTargets } from "./build-release-artifacts.js"

const root = cwd()
const currentCommitSelector = "HEAD"
const placeholderCommits = new Set(["replace-with-release-commit", "0000000"])
const appPackagePath = "apps/release-ts/package.json"
const appVersionPath = "apps/release-ts/src/version.ts"
const releaseConfigPath = "apps/release-ts/release.config.json"

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

const readReleaseVersion = (
  path: string,
  failures: Array<string>
): string | undefined => {
  const contents = readText(path)
  if (contents === undefined) {
    failures.push(`${path} must define RELEASE_VERSION`)
    return undefined
  }
  const match = contents.match(/export\s+const\s+RELEASE_VERSION\s*=\s*"([^"]+)"/)
  if (match === null || match[1] === undefined || match[1].length === 0) {
    failures.push(`${path} must export RELEASE_VERSION as a non-empty string literal`)
    return undefined
  }
  return match[1]
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
  }
  return [...names].sort()
}

const stringArrayIncludes = (value: unknown, expected: string): boolean =>
  Array.isArray(value) && value.some((item) => item === expected)

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

const checkArtifactPath = (
  artifact: Record<string, unknown> | undefined,
  id: string,
  expectedPath: string,
  expectedFormat: string,
  failures: Array<string>
): void => {
  if (artifact === undefined) {
    failures.push(`release config must include artifact ${id}`)
    return
  }
  if (artifact.path !== expectedPath) {
    failures.push(`artifact ${id} path ${String(artifact.path)} must equal ${expectedPath}`)
  }
  if (artifact.format !== expectedFormat) {
    failures.push(`artifact ${id} format ${String(artifact.format)} must equal ${expectedFormat}`)
  }
  if (!stringArrayIncludes(artifact.consumers, "github")) {
    failures.push(`artifact ${id} must be consumed by github`)
  }
}

const envExampleDocuments = (contents: string, name: string): boolean =>
  contents.split(/\r?\n/).some((line) => {
    const trimmed = line.trim()
    return trimmed === name || trimmed.startsWith(`${name}=`)
  })

const failures: Array<string> = []
const manifest = readJson("package.json")
const appManifest = readJson(appPackagePath)
const config = readJson(releaseConfigPath)
const appSourceVersion = readReleaseVersion(appVersionPath, failures)
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
  if (appVersion !== undefined && appSourceVersion !== undefined && appVersion !== appSourceVersion) {
    failures.push(`${appVersionPath} RELEASE_VERSION ${appSourceVersion} must match app package version ${appVersion}`)
  }
  if (packageName === "release") {
    failures.push("package name `release` is already published on npm; use the confirmed scoped package name")
  }
  const identity = field(config, "identity")
  if (!isRecord(identity)) {
    failures.push(`${releaseConfigPath} identity must be an object`)
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
    if (commit === currentCommitSelector && currentGitCommit !== undefined && trackedGitStatus !== undefined && trackedGitStatus.length > 0) {
      failures.push("release identity commit HEAD requires a clean tracked working tree")
    }
    if (commit !== undefined && commit !== currentCommitSelector && currentGitCommit !== undefined && commit !== currentGitCommit) {
      failures.push(`release identity commit ${commit} must match current git commit ${currentGitCommit}`)
    }
    if (releaseVersion !== undefined && tag !== undefined && tag !== `v${releaseVersion}`) {
      failures.push(`release identity tag ${tag} must match v${releaseVersion}`)
    }
  }

  const artifacts = field(config, "artifacts")
  if (!Array.isArray(artifacts)) {
    failures.push(`${releaseConfigPath} artifacts must be an array`)
  } else if (packageName !== undefined && packageVersion !== undefined) {
    const artifactRecords = collectArtifactRecords(artifacts, failures)
    for (const artifact of artifactRecords.values()) {
      const artifactPath = artifact.path
      if (
        typeof artifactPath === "string" &&
        artifactPath.startsWith(".release/artifacts/") &&
        !artifactPath.includes(packageVersion)
      ) {
        failures.push(`artifact path ${artifactPath} must include package version ${packageVersion}`)
      }
    }
    checkArtifactPath(
      artifactRecords.get("package-tarball"),
      "package-tarball",
      packageTarballArtifactPath({ name: packageName, version: packageVersion }),
      "tarball",
      failures
    )
    for (const target of releaseCliArtifactTargets(packageVersion)) {
      checkArtifactPath(
        artifactRecords.get(target.id),
        target.id,
        target.outfile,
        "file",
        failures
      )
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
    for (const target of targets) {
      if (!isRecord(target)) {
        failures.push("release targets must be objects")
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
