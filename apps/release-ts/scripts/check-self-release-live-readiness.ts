import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd, exit } from "node:process"
import * as Schema from "effect/Schema"
import { ReleaseConfig } from "../../../src/config/schema.js"

const root = cwd()
const packagePath = "package.json"
const releaseConfigPath = "apps/release-ts/release.config.json"
const workflowPath = ".github/workflows/release.yml"
const installSmokeWorkflowPath = ".github/workflows/install-smoke.yml"
const githubApiBase = process.env.SELF_RELEASE_GITHUB_API_BASE ?? "https://api.github.com"
const npmRegistryBase = process.env.SELF_RELEASE_NPM_REGISTRY ?? "https://registry.npmjs.org"
const pypiApiBase = process.env.SELF_RELEASE_PYPI_API_BASE ?? "https://pypi.org/pypi"
const skipGitHubSecretCheck = process.env.SELF_RELEASE_SKIP_GITHUB_SECRET_CHECK === "1"
const requiredGitHubSecrets = ["TS_RELEASE_CATALOG_TOKEN"] as const

interface Check {
  readonly id: string
  readonly ok: boolean
  readonly message: string
}

type JsonRecord = Record<string, unknown>

const workflowNeedles = [
  ["workflow:release-env", "environment: release", "Release execution is protected by the release environment."],
  ["workflow:github-token", "GH_TOKEN: ${{ github.token }}", "Workflow provides GH_TOKEN for GitHub release commands."],
  ["workflow:catalog-token", "secrets.TS_RELEASE_CATALOG_TOKEN", "Workflow references TS_RELEASE_CATALOG_TOKEN for catalog checkouts."],
  ["workflow:id-token", "id-token: write", "Workflow grants id-token: write for trusted publishing."],
  ["workflow:twine-version", "twine>=6.2.0", "Workflow installs a Twine version with trusted-publishing support."],
  ["workflow:catalog-render", "bun run release:catalogs", "Workflow renders package manager catalogs before artifact validation."],
  ["workflow:artifact-check", "bun run check:self-release-artifacts", "Workflow validates release artifacts before publication."]
] as const

const workflowBans = [
  ["workflow:no-twine-username-secret", "secrets.TWINE_USERNAME", "Workflow does not require TWINE_USERNAME for PyPI upload."],
  ["workflow:no-twine-password-secret", "secrets.TWINE_PASSWORD", "Workflow does not require TWINE_PASSWORD for PyPI upload."]
] as const

const smokeNeedles = [
  ["smoke:workflow-dispatch", "workflow_dispatch:", "Install smoke workflow can be dispatched manually after publication."],
  ["smoke:permissions-read", "contents: read", "Install smoke workflow uses read-only repository permissions."],
  ["smoke:npm-package", "@mannyc1/ts-release@$VERSION", "Install smoke workflow installs the published npm package."],
  ["smoke:github-asset-linux-x64", "ts-release-$VERSION-linux-x64", "Install smoke workflow downloads the Linux x64 GitHub Release asset."],
  ["smoke:github-asset-linux-arm64", "ts-release-$VERSION-linux-arm64", "Install smoke workflow downloads the Linux arm64 GitHub Release asset."],
  ["smoke:github-asset-darwin-x64", "ts-release-$VERSION-darwin-x64", "Install smoke workflow downloads the macOS x64 GitHub Release asset."],
  ["smoke:github-asset-darwin-arm64", "ts-release-$VERSION-darwin-arm64", "Install smoke workflow downloads the macOS arm64 GitHub Release asset."],
  ["smoke:github-asset-windows-x64", "ts-release-$VERSION-windows-x64.exe", "Install smoke workflow downloads the Windows x64 GitHub Release asset."],
  ["smoke:pypi-package", "ts-release==$VERSION", "Install smoke workflow installs the PyPI CLI wrapper."],
  ["smoke:homebrew-tap", "homebrew-ts-release", "Install smoke workflow installs from the Homebrew tap."],
  ["smoke:homebrew-trust", "brew trust mannyc2/ts-release", "Install smoke workflow trusts the custom Homebrew tap before installing."],
  ["smoke:scoop-bucket", "scoop-ts-release", "Install smoke workflow installs from the Scoop bucket."],
  ["smoke:version-assertion", "v$VERSION", "Install smoke workflow asserts the installed CLI version."]
] as const

// Only for JSON the tool does not own a schema for (package.json, gh CLI output).
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"))

const readText = (path: string): string =>
  readFileSync(resolve(root, path), "utf8")

const readOptionalText = (path: string): string | undefined =>
  existsSync(resolve(root, path)) ? readText(path) : undefined

const field = (record: JsonRecord, key: string): string | undefined => {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

const check = (id: string, ok: boolean, okMessage: string, failMessage = okMessage): Check => ({
  id,
  ok,
  message: ok ? okMessage : failMessage
})

const contains = (path: string, contents: string, id: string, needle: string, message: string): Check =>
  check(id, contents.includes(needle), message, `${path} must include ${needle}.`)

const excludes = (path: string, contents: string, id: string, needle: string, message: string): Check =>
  check(id, !contents.includes(needle), message, `${path} must not include ${needle}.`)

const withBase = (base: string, path: string): string =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`

const statusName = (status: number): string =>
  status === 0 ? "network error" : String(status)

const fetchStatus = async (url: string, json = false): Promise<{ readonly status: number; readonly url: string; readonly body?: unknown }> => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ts-release-self-release-readiness"
      }
    })
    return {
      status: response.status,
      url,
      body: json ? await response.json().catch(() => undefined) : undefined
    }
  } catch {
    return { status: 0, url }
  }
}

const statusCheck = (
  id: string,
  observed: { readonly status: number; readonly url: string },
  expected: number,
  okMessage: string,
  failMessage: string
): Check =>
  check(id, observed.status === expected, okMessage, `${failMessage} (${observed.url} returned ${statusName(observed.status)}).`)

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const runCommand = async (args: ReadonlyArray<string>): Promise<{ readonly exitCode: number; readonly stdout: string }> => {
  const subprocess = Bun.spawn([...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  const stdout = streamText(subprocess.stdout)
  const stderr = streamText(subprocess.stderr)
  const exitCode = await subprocess.exited
  await stderr
  return { exitCode, stdout: await stdout }
}

const parseSecretNames = (stdout: string): ReadonlySet<string> | undefined => {
  try {
    const parsed: unknown = JSON.parse(stdout)
    if (!Array.isArray(parsed)) return undefined
    const names = new Set<string>()
    for (const item of parsed) {
      if (!isRecord(item)) return undefined
      const name = field(item, "name")
      if (name === undefined) return undefined
      names.add(name)
    }
    return names
  } catch {
    return undefined
  }
}

const readGitHubSecrets = async (
  repository: string,
  environment: string | undefined
): Promise<{ readonly ok: boolean; readonly names: ReadonlySet<string> }> => {
  const args = ["gh", "secret", "list", "--repo", repository, "--json", "name"]
  if (environment !== undefined) args.push("--env", environment)
  const result = await runCommand(args)
  const names = result.exitCode === 0 ? parseSecretNames(result.stdout) : undefined
  return { ok: names !== undefined, names: names ?? new Set() }
}

const gitHubSecretChecks = async (repository: string): Promise<ReadonlyArray<Check>> => {
  if (skipGitHubSecretCheck) {
    return [check("github:secrets", true, "GitHub secret existence check skipped by SELF_RELEASE_SKIP_GITHUB_SECRET_CHECK=1.")]
  }
  const [repo, env] = await Promise.all([
    readGitHubSecrets(repository, undefined),
    readGitHubSecrets(repository, "release")
  ])
  const names = new Set([...repo.names, ...env.names])
  return [
    check("github:repo-secrets-readable", repo.ok, `Repository secrets for ${repository} are readable.`, `Unable to list repository secrets for ${repository}; run gh auth status and ensure repo admin access.`),
    check("github:release-env-secrets-readable", env.ok, `Release environment secrets for ${repository} are readable.`, `Unable to list release environment secrets for ${repository}; ensure the release environment exists and gh has admin access.`),
    ...requiredGitHubSecrets.map((name) =>
      check(`github:secret:${name}`, names.has(name), `${name} is configured as a repository or release environment secret.`, `${name} must be configured as a repository or release environment secret.`)
    )
  ]
}

const installSmokeWorkflowChecks = (workflow: string | undefined): ReadonlyArray<Check> =>
  workflow === undefined
    ? [check("smoke:workflow-file", false, "", `${installSmokeWorkflowPath} must exist for post-release install checks.`)]
    : [
        check("smoke:workflow-file", true, `${installSmokeWorkflowPath} exists.`),
        ...smokeNeedles.map(([id, needle, message]) => contains(installSmokeWorkflowPath, workflow, id, needle, message))
      ]

const githubRepoChecks = (
  idPrefix: string,
  observed: { readonly status: number; readonly url: string; readonly body?: unknown },
  repository: string,
  purpose: string
): ReadonlyArray<Check> => {
  if (observed.status !== 200) {
    return [
      check(`${idPrefix}:public`, false, "", `${repository} must exist and be publicly reachable for ${purpose} (${observed.url} returned ${statusName(observed.status)}).`),
      check(`${idPrefix}:default-branch`, false, "", `${repository} must have a default branch before the release workflow can check it out.`)
    ]
  }
  const defaultBranch = isRecord(observed.body) ? field(observed.body, "default_branch") : undefined
  return [
    check(`${idPrefix}:public`, true, `${repository} is reachable.`),
    check(`${idPrefix}:default-branch`, defaultBranch !== undefined, `${repository} default branch is ${defaultBranch}.`, `${repository} must have a default branch before the release workflow can check it out.`)
  ]
}

const pypiTrustedPublishingChecks = (target: ReleaseConfig["publish"]["pypi"]): ReadonlyArray<Check> => {
  const pypi = typeof target === "object" ? target : undefined
  const trustedPublishing = typeof pypi?.trustedPublishing === "object" ? pypi.trustedPublishing : undefined
  if (pypi === undefined || trustedPublishing === undefined) {
    return [check("pypi:trusted-publishing-config", false, "", pypi === undefined ? "PyPI target must be configured." : "PyPI target must declare trustedPublishing for GitHub Actions OIDC upload.")]
  }
  return [
    check("pypi:trusted-publishing-provider", trustedPublishing.provider === "github-actions", "PyPI trusted publishing provider is GitHub Actions.", "PyPI trustedPublishing.provider must be github-actions."),
    check("pypi:trusted-publishing-workflow", trustedPublishing.workflow === "release.yml", "PyPI trusted publishing workflow is release.yml.", "PyPI trustedPublishing.workflow must be release.yml."),
    check("pypi:trusted-publisher-configured", trustedPublishing.publisherConfigured === true, "PyPI trusted publisher setup is acknowledged; verify the pending or existing publisher in PyPI before dispatch.", "PyPI trustedPublishing.publisherConfigured must be true after creating the pending or existing publisher in PyPI.")
  ]
}

const printChecks = (checks: ReadonlyArray<Check>): void => {
  for (const item of checks) console.log(`${item.ok ? "ok  " : "fail"} ${item.id}: ${item.message}`)
}

const decodeReleaseConfig = Schema.decodeUnknownSync(ReleaseConfig)

const decodedConfig = (): { readonly config?: ReleaseConfig; readonly error?: string } => {
  try {
    return { config: decodeReleaseConfig(readJson(releaseConfigPath)) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: message.split("\n").map((line) => line.trim()).filter((line) => line.length > 0).join(" | ") }
  }
}

const checks: Array<Check> = []
const manifest = readJson(packagePath)
const { config, error: configError } = decodedConfig()
const workflow = readText(workflowPath)
const installSmokeWorkflow = readOptionalText(installSmokeWorkflowPath)

if (!isRecord(manifest)) checks.push(check("manifest:shape", false, "", `${packagePath} must be a JSON object.`))
if (config === undefined) {
  checks.push(check("config:schema", false, "", `${releaseConfigPath} must decode against the release config schema: ${configError ?? "unknown decode error"}`))
}

if (isRecord(manifest) && config !== undefined) {
  const packageName = field(manifest, "name")
  const packageVersion = field(manifest, "version")
  const publish = config.publish
  if (packageName === undefined) checks.push(check("manifest:name", false, "", `${packagePath} name must be a non-empty string.`))
  if (packageVersion === undefined) checks.push(check("manifest:version", false, "", `${packagePath} version must be a non-empty string.`))

  if (packageName !== undefined && packageVersion !== undefined) {
    const github = typeof publish.github === "object" ? publish.github : undefined
    const githubRepository = github?.repository
    const homebrewRepository = publish.homebrew?.repository
    const scoopRepository = publish.scoop?.repository
    const wheelSection = config.pypiWheel
    const wheelItems = wheelSection === undefined ? [] : Array.isArray(wheelSection) ? wheelSection : [wheelSection]
    const pypiPackageName = wheelItems[0]?.packageName

    checks.push(
      ...workflowNeedles.map(([id, needle, message]) => contains(workflowPath, workflow, id, needle, message)),
      ...workflowBans.map(([id, needle, message]) => excludes(workflowPath, workflow, id, needle, message)),
      ...installSmokeWorkflowChecks(installSmokeWorkflow),
      ...pypiTrustedPublishingChecks(publish.pypi)
    )

    const npmStatus = await fetchStatus(withBase(npmRegistryBase, `${encodeURIComponent(packageName)}/${packageVersion}`))
    checks.push(statusCheck("npm:version-available", npmStatus, 404, `${packageName}@${packageVersion} is not published on npm yet.`, `${packageName}@${packageVersion} must not already exist on npm`))

    if (githubRepository === undefined) {
      checks.push(check("github:repository-config", false, "", "GitHub target repository must be configured."))
    } else {
      const [repoStatus, releaseStatus, secretChecks] = await Promise.all([
        fetchStatus(withBase(githubApiBase, `repos/${githubRepository}`)),
        fetchStatus(withBase(githubApiBase, `repos/${githubRepository}/releases/tags/v${packageVersion}`)),
        gitHubSecretChecks(githubRepository)
      ])
      checks.push(
        statusCheck("github:repository-public", repoStatus, 200, `${githubRepository} is reachable.`, `${githubRepository} must be reachable`),
        statusCheck("github:release-tag-available", releaseStatus, 404, `v${packageVersion} does not exist as a GitHub Release yet.`, `v${packageVersion} must not already exist as a GitHub Release`),
        ...secretChecks
      )
    }

    if (homebrewRepository === undefined) checks.push(check("homebrew:repository-config", false, "", "Homebrew target repository must be configured."))
    else checks.push(...githubRepoChecks("homebrew:tap", await fetchStatus(withBase(githubApiBase, `repos/${homebrewRepository}`), true), homebrewRepository, "Homebrew installs"))

    if (scoopRepository === undefined) checks.push(check("scoop:repository-config", false, "", "Scoop target repository must be configured."))
    else checks.push(...githubRepoChecks("scoop:bucket", await fetchStatus(withBase(githubApiBase, `repos/${scoopRepository}`), true), scoopRepository, "Scoop installs"))

    if (pypiPackageName === undefined) {
      checks.push(check("pypi:package-config", false, "", "PyPI wheel packageName must be configured."))
    } else {
      const pypiStatus = await fetchStatus(withBase(pypiApiBase, `${pypiPackageName}/${packageVersion}/json`))
      checks.push(statusCheck("pypi:version-available", pypiStatus, 404, `${pypiPackageName} ${packageVersion} is not published on PyPI yet.`, `${pypiPackageName} ${packageVersion} must not already exist on PyPI`))
    }
  }
}

printChecks(checks)
if (checks.some((item) => !item.ok)) exit(1)
