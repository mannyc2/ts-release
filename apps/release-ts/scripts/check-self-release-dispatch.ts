import { readFileSync, realpathSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  assertNoToolTransportEnvironment, pinnedNpmExecutable, pinnedNpmReleaseTool,
  pinnedNpmClosedEnvironment, reauthenticatePinnedNpm, releaseBunExecutable,
  releaseNodeExecutable, runExactExecutable
} from "./install-self-release-npm.js"

export const selfReleaseModes = [
  "prepare-exact-sha",
  "create-tag",
  "publish-npm",
  "publish-github"
] as const
export type SelfReleaseMode = typeof selfReleaseModes[number]

const exactRepository = "mannyc2/ts-release"
const exactRef = "refs/heads/main"
const exactTagRef = "refs/tags/v0.3.0"
const exactRemoteUrls = new Set([
  "https://github.com/mannyc2/ts-release",
  "https://github.com/mannyc2/ts-release.git"
])
const gitSha = /^[a-f0-9]{40}$/u
const preparedPattern = /^prepared:gha:mannyc2\/ts-release\/runs\/([1-9][0-9]*)\/attempts\/([1-9][0-9]*)\/artifacts\/ts-release-prepared-\2-([a-f0-9]{64})#sha256-([a-f0-9]{64})$/u
const forbiddenEnvironment = new Set([
  "npm_token",
  "npm_id_token",
  "node_auth_token",
  "npm_config__authtoken",
  "npm_config__auth",
  "npm_config_username",
  "npm_config_password",
  "prefix",
  "destdir"
])

const fail = (reason: string): never => { throw new Error(`Self-release dispatch refused: ${reason}`) }

export const assertNoForbiddenNpmEnvironment = (
  environment: Readonly<Record<string, string | undefined>>
): void => {
  for (const [name, value] of Object.entries(environment)) {
    const normalized = name.toLocaleLowerCase("en-US")
    if (value !== undefined && value.length > 0 &&
        (forbiddenEnvironment.has(normalized) || normalized.startsWith("npm_config_"))) {
      fail(`${name} must be absent`)
    }
  }
}

export interface SelfReleaseCoordinateInput {
  readonly mode: SelfReleaseMode
  readonly candidateSha: string
  readonly preparedRef: string
  readonly npmPreparedRef: string
  readonly repository: string
  readonly ref: string
  readonly workflowSha: string
  readonly checkoutSha: string
  readonly remoteMainSha: string
  readonly remoteUrl: string
  readonly environment: Readonly<Record<string, string | undefined>>
}

export interface AdmittedSelfReleaseCoordinates {
  readonly mode: SelfReleaseMode
  readonly candidateSha: string
  readonly preparedDigest?: string
  readonly npmPreparedDigest?: string
}

export const admitSelfReleaseCoordinates = (
  input: SelfReleaseCoordinateInput
): AdmittedSelfReleaseCoordinates => {
  if (!(selfReleaseModes as ReadonlyArray<string>).includes(input.mode)) fail("unknown authority mode")
  if (!gitSha.test(input.candidateSha)) fail("candidate_sha must be one lowercase 40-hex commit")
  if (input.repository !== exactRepository || input.ref !== exactRef) fail("repository/ref is not canonical main")
  if (input.workflowSha !== input.candidateSha) fail("workflow revision differs from candidate_sha")
  if (input.checkoutSha !== input.candidateSha) fail("checked-out revision differs from candidate_sha")
  if (input.remoteMainSha !== input.candidateSha) fail("candidate_sha is no longer current origin/main")
  if (!exactRemoteUrls.has(input.remoteUrl)) fail("origin is not the canonical public HTTPS repository")

  assertNoForbiddenNpmEnvironment(input.environment)
  assertNoToolTransportEnvironment(input.environment)
  if (input.mode === "prepare-exact-sha" || input.mode === "create-tag") {
    if (input.preparedRef !== "" || input.npmPreparedRef !== "") {
      fail(`${input.mode} rejects every prepared reference`)
    }
    for (const name of ["ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]) {
      if ((input.environment[name] ?? "").length > 0) fail(`${input.mode} rejects npm OIDC material ${name}`)
    }
    return { mode: input.mode, candidateSha: input.candidateSha }
  }
  const prepared = preparedPattern.exec(input.preparedRef)
  if (prepared === null) return fail("publication requires one canonical repository-owned content-addressed prepared reference")
  const preparedDigest = prepared[3]
  if (preparedDigest === undefined || preparedDigest !== prepared[4]) {
    return fail("publication requires one canonical repository-owned content-addressed prepared reference")
  }
  if (input.mode === "publish-npm") {
    if (input.npmPreparedRef !== "") fail("npm publication accepts only its npm prepared reference")
    return { mode: input.mode, candidateSha: input.candidateSha, preparedDigest }
  }
  const npmPrepared = preparedPattern.exec(input.npmPreparedRef)
  const npmPreparedDigest = npmPrepared?.[3]
  if (npmPrepared === null || npmPreparedDigest === undefined || npmPreparedDigest !== npmPrepared[4] ||
      npmPreparedDigest === preparedDigest) {
    return fail("GitHub publication requires a distinct canonical npm prepared reference")
  }
  return { mode: input.mode, candidateSha: input.candidateSha, preparedDigest, npmPreparedDigest }
}

const commandOutput = (
  command: string,
  args: ReadonlyArray<string>,
  environment: NodeJS.ProcessEnv = process.env
): string => {
  const result = spawnSync(command, [...args], { encoding: "utf8", stdio: "pipe", env: environment })
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed before admission`)
  return result.stdout.trim()
}

export const assertSelectedPinnedNpm = (selected: string, pinned: string): void => {
  const selectedCanonical = realpathSync(selected)
  const pinnedCanonical = realpathSync(pinned)
  const metadata = statSync(selectedCanonical)
  if (selectedCanonical !== pinnedCanonical || !metadata.isFile() || (metadata.mode & 0o111) === 0) {
    fail("PATH does not select the audited npm archive")
  }
}

const assertToolchain = (
  environment: Readonly<Record<string, string>>,
  nodeExecutable: string,
  bunExecutable: string
): void => {
  const identities = [
    [nodeExecutable, ["--version"], "v22.22.2"],
    [bunExecutable, ["--version"], "1.3.14"],
    [pinnedNpmExecutable(), ["--version"], pinnedNpmReleaseTool.version]
  ] as const
  for (const [command, args, expected] of identities) {
    if (runExactExecutable(command, args, environment) !== expected) {
      fail(`${command} is not the exact ${expected} release tool`)
    }
  }
  const selectedNpm = commandOutput("/usr/bin/which", ["npm"], environment)
  assertSelectedPinnedNpm(selectedNpm, pinnedNpmExecutable())
}

export const npmConfigHasActiveContent = (value: string): boolean => value
  .replace(/^\uFEFF/u, "")
  .split(/\r?\n/u)
  .some((line) => {
    const trimmed = line.trim()
    return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith(";")
  })

export const assertNoNpmConfigurationFiles = (paths: ReadonlyArray<string>): void => {
  for (const path of [...new Set(paths.map((value) => resolve(value)))]) {
    try {
      if (npmConfigHasActiveContent(readFileSync(path, "utf8"))) {
        fail(`release-host npm configuration must be empty or absent: ${path}`)
      }
    } catch (cause) {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") continue
      throw cause
    }
  }
}

const assertNoNpmConfiguration = (
  environment: Readonly<Record<string, string | undefined>>,
  nodeExecutable: string
): void => {
  const nodePrefix = dirname(dirname(resolve(nodeExecutable)))
  const userHome = environment.HOME === undefined || environment.HOME.length === 0
    ? homedir()
    : environment.HOME
  assertNoNpmConfigurationFiles([
    resolve(".npmrc"),
    resolve(userHome, ".npmrc"),
    join(nodePrefix, "etc", "npmrc"),
    "/etc/npmrc",
    "/usr/local/etc/npmrc"
  ])
}

const main = (): void => {
  const environment = process.env
  assertNoForbiddenNpmEnvironment(environment)
  assertNoToolTransportEnvironment(environment)
  const nodeExecutable = releaseNodeExecutable(environment)
  const bunExecutable = releaseBunExecutable(environment)
  reauthenticatePinnedNpm(process.cwd(), nodeExecutable)
  assertNoNpmConfiguration(environment, nodeExecutable)
  const closedEnvironment = pinnedNpmClosedEnvironment(process.cwd(), environment.PATH ?? "")
  const gitEnvironment = {
    ...closedEnvironment,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0"
  }
  const candidateSha = environment.CANDIDATE_SHA ?? ""
  const remote = commandOutput("/usr/bin/git", ["remote", "get-url", "origin"], gitEnvironment)
  const checkout = commandOutput("/usr/bin/git", ["rev-parse", "HEAD"], gitEnvironment)
  const remoteLine = commandOutput("/usr/bin/git", ["ls-remote", remote, exactRef], gitEnvironment)
  const remoteMatch = /^([a-f0-9]{40})\trefs\/heads\/main$/u.exec(remoteLine)
  if (remoteMatch === null) return fail("origin/main did not resolve to exactly one canonical commit")
  const remoteMainSha = remoteMatch[1]
  if (remoteMainSha === undefined) return fail("origin/main did not resolve to one canonical commit")
  const releaseMode = (environment.RELEASE_MODE ?? "") as SelfReleaseMode
  if (releaseMode === "publish-npm" || releaseMode === "publish-github") {
    const tagLine = commandOutput("/usr/bin/git", ["ls-remote", remote, exactTagRef], gitEnvironment)
    if (tagLine !== `${candidateSha}\t${exactTagRef}`) {
      fail("lightweight v0.3.0 tag is absent, annotated, moved, or differs from candidate_sha")
    }
  }
  assertToolchain(closedEnvironment, nodeExecutable, bunExecutable)
  const admitted = admitSelfReleaseCoordinates({
    mode: releaseMode,
    candidateSha,
    preparedRef: environment.PREPARED_REF ?? "",
    npmPreparedRef: environment.NPM_PREPARED_REF ?? "",
    repository: environment.GITHUB_REPOSITORY ?? "",
    ref: environment.GITHUB_REF ?? "",
    workflowSha: environment.GITHUB_WORKFLOW_SHA ?? "",
    checkoutSha: checkout,
    remoteMainSha,
    remoteUrl: remote,
    environment
  })
  console.log(JSON.stringify({
    schemaVersion: "ts-release/self-release-dispatch/v1",
    status: "admitted",
    mode: admitted.mode,
    candidateSha: admitted.candidateSha,
    ...(admitted.preparedDigest === undefined ? {} : { preparedDigest: admitted.preparedDigest }),
    ...(admitted.npmPreparedDigest === undefined ? {} : { npmPreparedDigest: admitted.npmPreparedDigest })
  }))
}

if (import.meta.main) main()
