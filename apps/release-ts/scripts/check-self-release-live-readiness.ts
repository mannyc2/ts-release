import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd, exit } from "node:process"

const root = cwd()
const packagePath = "package.json"
const releaseConfigPath = "apps/release-ts/release.config.json"
const workflowPath = ".github/workflows/release.yml"
const installSmokeWorkflowPath = ".github/workflows/install-smoke.yml"
const githubApiBase = process.env.SELF_RELEASE_GITHUB_API_BASE ?? "https://api.github.com"
const npmRegistryBase = process.env.SELF_RELEASE_NPM_REGISTRY ?? "https://registry.npmjs.org"
const pypiApiBase = process.env.SELF_RELEASE_PYPI_API_BASE ?? "https://pypi.org/pypi"
const skipGitHubSecretCheck = process.env.SELF_RELEASE_SKIP_GITHUB_SECRET_CHECK === "1"
const requiredGitHubSecrets: ReadonlyArray<string> = ["TS_RELEASE_CATALOG_TOKEN"]

interface Check {
  readonly id: string
  readonly ok: boolean
  readonly message: string
}

interface HttpStatus {
  readonly status: number
  readonly url: string
}

interface HttpJson {
  readonly status: number
  readonly url: string
  readonly body: unknown
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

const readOptionalText = (path: string): string | undefined =>
  existsSync(resolve(root, path)) ? readText(path) : undefined

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const stringField = (
  record: Record<string, unknown>,
  name: string
): string | undefined => {
  const value = record[name]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

const withBase = (base: string, path: string): string =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`

const httpStatus = async (url: string): Promise<HttpStatus> => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ts-release-self-release-readiness"
      }
    })
    return { status: response.status, url }
  } catch {
    return { status: 0, url }
  }
}

const httpJson = async (url: string): Promise<HttpJson> => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ts-release-self-release-readiness"
      }
    })
    const body: unknown = await response.json().catch(() => undefined)
    return { status: response.status, url, body }
  } catch {
    return { status: 0, url, body: undefined }
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

const parseSecretNames = (stdout: string): ReadonlySet<string> | undefined => {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed)) {
    return undefined
  }
  const names = new Set<string>()
  for (const item of parsed) {
    if (!isRecord(item)) {
      return undefined
    }
    const name = stringField(item, "name")
    if (name === undefined) {
      return undefined
    }
    names.add(name)
  }
  return names
}

const readGitHubSecrets = async (
  repository: string,
  environment: string | undefined
): Promise<CommandResult & { readonly names?: ReadonlySet<string> }> => {
  const args = ["gh", "secret", "list", "--repo", repository, "--json", "name"]
  if (environment !== undefined) {
    args.push("--env", environment)
  }
  const result = await runCommand(args)
  if (result.exitCode !== 0) {
    return result
  }
  const names = parseSecretNames(result.stdout)
  return names === undefined ? result : { ...result, names }
}

const gitHubSecretChecks = async (repository: string): Promise<ReadonlyArray<Check>> => {
  if (skipGitHubSecretCheck) {
    return [
      {
        id: "github:secrets",
        ok: true,
        message: "GitHub secret existence check skipped by SELF_RELEASE_SKIP_GITHUB_SECRET_CHECK=1."
      }
    ]
  }

  const repoSecrets = await readGitHubSecrets(repository, undefined)
  const envSecrets = await readGitHubSecrets(repository, "release")
  const checks: Array<Check> = []

  if (repoSecrets.exitCode !== 0 || repoSecrets.names === undefined) {
    checks.push({
      id: "github:repo-secrets-readable",
      ok: false,
      message: `Unable to list repository secrets for ${repository}; run gh auth status and ensure repo admin access.`
    })
  } else {
    checks.push({
      id: "github:repo-secrets-readable",
      ok: true,
      message: `Repository secrets for ${repository} are readable.`
    })
  }

  if (envSecrets.exitCode !== 0 || envSecrets.names === undefined) {
    checks.push({
      id: "github:release-env-secrets-readable",
      ok: false,
      message: `Unable to list release environment secrets for ${repository}; ensure the release environment exists and gh has admin access.`
    })
  } else {
    checks.push({
      id: "github:release-env-secrets-readable",
      ok: true,
      message: `Release environment secrets for ${repository} are readable.`
    })
  }

  const allNames = new Set<string>([
    ...(repoSecrets.names ?? []),
    ...(envSecrets.names ?? [])
  ])
  for (const name of requiredGitHubSecrets) {
    checks.push({
      id: `github:secret:${name}`,
      ok: allNames.has(name),
      message: allNames.has(name)
        ? `${name} is configured as a repository or release environment secret.`
        : `${name} must be configured as a repository or release environment secret.`
    })
  }

  return checks
}

const statusCheck = (
  id: string,
  observed: HttpStatus,
  expected: number,
  okMessage: string,
  failMessage: string
): Check => ({
  id,
  ok: observed.status === expected,
  message: observed.status === expected
    ? okMessage
    : `${failMessage} (${observed.url} returned ${observed.status === 0 ? "network error" : observed.status}).`
})

const fileContains = (filePath: string, contents: string, id: string, needle: string, message: string): Check => ({
  id,
  ok: contents.includes(needle),
  message: contents.includes(needle) ? message : `${filePath} must include ${needle}.`
})

const fileExcludes = (filePath: string, contents: string, id: string, needle: string, message: string): Check => ({
  id,
  ok: !contents.includes(needle),
  message: contents.includes(needle) ? `${filePath} must not include ${needle}.` : message
})

const workflowContains = (workflow: string, id: string, needle: string, message: string): Check =>
  fileContains(workflowPath, workflow, id, needle, message)

const workflowExcludes = (workflow: string, id: string, needle: string, message: string): Check =>
  fileExcludes(workflowPath, workflow, id, needle, message)

const installSmokeWorkflowChecks = (workflow: string | undefined): ReadonlyArray<Check> => {
  if (workflow === undefined) {
    return [
      {
        id: "smoke:workflow-file",
        ok: false,
        message: `${installSmokeWorkflowPath} must exist for post-release install checks.`
      }
    ]
  }
  return [
    {
      id: "smoke:workflow-file",
      ok: true,
      message: `${installSmokeWorkflowPath} exists.`
    },
    fileContains(installSmokeWorkflowPath, workflow, "smoke:workflow-dispatch", "workflow_dispatch:", "Install smoke workflow can be dispatched manually after publication."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:permissions-read", "contents: read", "Install smoke workflow uses read-only repository permissions."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:npm-package", "@mannyc1/ts-release@$VERSION", "Install smoke workflow installs the published npm package."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:github-asset-linux-x64", "ts-release-$VERSION-linux-x64", "Install smoke workflow downloads the Linux x64 GitHub Release asset."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:github-asset-linux-arm64", "ts-release-$VERSION-linux-arm64", "Install smoke workflow downloads the Linux arm64 GitHub Release asset."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:github-asset-darwin-x64", "ts-release-$VERSION-darwin-x64", "Install smoke workflow downloads the macOS x64 GitHub Release asset."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:github-asset-darwin-arm64", "ts-release-$VERSION-darwin-arm64", "Install smoke workflow downloads the macOS arm64 GitHub Release asset."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:github-asset-windows-x64", "ts-release-$VERSION-windows-x64.exe", "Install smoke workflow downloads the Windows x64 GitHub Release asset."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:pypi-package", "ts-release==$VERSION", "Install smoke workflow installs the PyPI CLI wrapper."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:homebrew-tap", "homebrew-ts-release", "Install smoke workflow installs from the Homebrew tap."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:homebrew-trust", "brew trust mannyc2/ts-release", "Install smoke workflow trusts the custom Homebrew tap before installing."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:scoop-bucket", "scoop-ts-release", "Install smoke workflow installs from the Scoop bucket."),
    fileContains(installSmokeWorkflowPath, workflow, "smoke:version-assertion", "v$VERSION", "Install smoke workflow asserts the installed CLI version.")
  ]
}

const githubRepoChecks = (
  idPrefix: string,
  observed: HttpJson,
  repository: string,
  purpose: string
): ReadonlyArray<Check> => {
  if (observed.status !== 200) {
    return [
      {
        id: `${idPrefix}:public`,
        ok: false,
        message: `${repository} must exist and be publicly reachable for ${purpose} (${observed.url} returned ${observed.status === 0 ? "network error" : observed.status}).`
      },
      {
        id: `${idPrefix}:default-branch`,
        ok: false,
        message: `${repository} must have a default branch before the release workflow can check it out.`
      }
    ]
  }
  const defaultBranch = isRecord(observed.body) ? stringField(observed.body, "default_branch") : undefined
  return [
    {
      id: `${idPrefix}:public`,
      ok: true,
      message: `${repository} is reachable.`
    },
    {
      id: `${idPrefix}:default-branch`,
      ok: defaultBranch !== undefined,
      message: defaultBranch === undefined
        ? `${repository} must have a default branch before the release workflow can check it out.`
        : `${repository} default branch is ${defaultBranch}.`
    }
  ]
}

const publishTarget = (
  publish: Record<string, unknown>,
  id: string
): Record<string, unknown> | undefined => {
  const target = publish[id]
  return isRecord(target) ? target : undefined
}

const firstPyPiRecipePackageName = (build: Record<string, unknown>): string | undefined => {
  const pypiWheel = build.pypiWheel
  const recipes = Array.isArray(pypiWheel) ? pypiWheel : isRecord(pypiWheel) ? [pypiWheel] : []
  for (const recipe of recipes) {
    if (isRecord(recipe)) {
      return stringField(recipe, "packageName")
    }
  }
  return undefined
}

const pypiTrustedPublishingChecks = (target: Record<string, unknown> | undefined): ReadonlyArray<Check> => {
  if (target === undefined) {
    return [
      {
        id: "pypi:trusted-publishing-config",
        ok: false,
        message: "PyPI target must be configured."
      }
    ]
  }
  const trustedPublishing = target.trustedPublishing
  if (!isRecord(trustedPublishing)) {
    return [
      {
        id: "pypi:trusted-publishing-config",
        ok: false,
        message: "PyPI target must declare trustedPublishing for GitHub Actions OIDC upload."
      }
    ]
  }
  return [
    {
      id: "pypi:trusted-publishing-provider",
      ok: trustedPublishing.provider === "github-actions",
      message: trustedPublishing.provider === "github-actions"
        ? "PyPI trusted publishing provider is GitHub Actions."
        : "PyPI trustedPublishing.provider must be github-actions."
    },
    {
      id: "pypi:trusted-publishing-workflow",
      ok: trustedPublishing.workflow === "release.yml",
      message: trustedPublishing.workflow === "release.yml"
        ? "PyPI trusted publishing workflow is release.yml."
        : "PyPI trustedPublishing.workflow must be release.yml."
    },
    {
      id: "pypi:trusted-publisher-configured",
      ok: trustedPublishing.publisherConfigured === true,
      message: trustedPublishing.publisherConfigured === true
        ? "PyPI trusted publisher setup is acknowledged; verify the pending or existing publisher in PyPI before dispatch."
        : "PyPI trustedPublishing.publisherConfigured must be true after creating the pending or existing publisher in PyPI."
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
const workflow = readText(workflowPath)
const installSmokeWorkflow = readOptionalText(installSmokeWorkflowPath)

if (!isRecord(manifest)) {
  checks.push({ id: "manifest:shape", ok: false, message: `${packagePath} must be a JSON object.` })
}
if (!isRecord(config)) {
  checks.push({ id: "config:shape", ok: false, message: `${releaseConfigPath} must be a JSON object.` })
}

if (isRecord(manifest) && isRecord(config)) {
  const packageName = stringField(manifest, "name")
  const packageVersion = stringField(manifest, "version")
  const build = config.build
  const publish = config.publish

  if (packageName === undefined) {
    checks.push({ id: "manifest:name", ok: false, message: `${packagePath} name must be a non-empty string.` })
  }
  if (packageVersion === undefined) {
    checks.push({ id: "manifest:version", ok: false, message: `${packagePath} version must be a non-empty string.` })
  }
  if (!isRecord(build)) {
    checks.push({ id: "config:build", ok: false, message: `${releaseConfigPath} build must be an object.` })
  }
  if (!isRecord(publish)) {
    checks.push({ id: "config:publish", ok: false, message: `${releaseConfigPath} publish must be an object.` })
  }

  if (packageName !== undefined && packageVersion !== undefined && isRecord(build) && isRecord(publish)) {
    const githubTarget = publishTarget(publish, "github")
    const homebrewTarget = publishTarget(publish, "homebrew")
    const scoopTarget = publishTarget(publish, "scoop")
    const pypiTarget = publishTarget(publish, "pypi")
    const pypiPackageName = firstPyPiRecipePackageName(build)
    const githubRepository = githubTarget === undefined ? undefined : stringField(githubTarget, "repository")
    const homebrewRepository = homebrewTarget === undefined ? undefined : stringField(homebrewTarget, "repository")
    const scoopRepository = scoopTarget === undefined ? undefined : stringField(scoopTarget, "repository")

    checks.push(
      workflowContains(workflow, "workflow:release-env", "environment: release", "Release execution is protected by the release environment."),
      workflowContains(workflow, "workflow:github-token", "GH_TOKEN: ${{ github.token }}", "Workflow provides GH_TOKEN for GitHub release commands."),
      workflowContains(workflow, "workflow:catalog-token", "secrets.TS_RELEASE_CATALOG_TOKEN", "Workflow references TS_RELEASE_CATALOG_TOKEN for catalog checkouts."),
      workflowContains(workflow, "workflow:id-token", "id-token: write", "Workflow grants id-token: write for trusted publishing."),
      workflowContains(workflow, "workflow:twine-version", "twine>=6.2.0", "Workflow installs a Twine version with trusted-publishing support."),
      workflowContains(workflow, "workflow:artifact-check", "bun run check:self-release-artifacts", "Workflow validates release artifacts before release publication."),
      workflowExcludes(workflow, "workflow:no-twine-username-secret", "secrets.TWINE_USERNAME", "Workflow does not require TWINE_USERNAME for PyPI upload."),
      workflowExcludes(workflow, "workflow:no-twine-password-secret", "secrets.TWINE_PASSWORD", "Workflow does not require TWINE_PASSWORD for PyPI upload."),
      ...installSmokeWorkflowChecks(installSmokeWorkflow),
      ...pypiTrustedPublishingChecks(pypiTarget)
    )

    const npmStatus = await httpStatus(withBase(npmRegistryBase, `${encodeURIComponent(packageName)}/${packageVersion}`))
    checks.push(statusCheck(
      "npm:version-available",
      npmStatus,
      404,
      `${packageName}@${packageVersion} is not published on npm yet.`,
      `${packageName}@${packageVersion} must not already exist on npm`
    ))

    if (githubRepository === undefined) {
      checks.push({ id: "github:repository-config", ok: false, message: "GitHub target repository must be configured." })
    } else {
      const repoStatus = await httpStatus(withBase(githubApiBase, `repos/${githubRepository}`))
      const releaseStatus = await httpStatus(withBase(githubApiBase, `repos/${githubRepository}/releases/tags/v${packageVersion}`))
      checks.push(
        statusCheck("github:repository-public", repoStatus, 200, `${githubRepository} is reachable.`, `${githubRepository} must be reachable`),
        statusCheck("github:release-tag-available", releaseStatus, 404, `v${packageVersion} does not exist as a GitHub Release yet.`, `v${packageVersion} must not already exist as a GitHub Release`),
        ...await gitHubSecretChecks(githubRepository)
      )
    }

    if (homebrewRepository === undefined) {
      checks.push({ id: "homebrew:repository-config", ok: false, message: "Homebrew target repository must be configured." })
    } else {
      const repoStatus = await httpJson(withBase(githubApiBase, `repos/${homebrewRepository}`))
      checks.push(...githubRepoChecks("homebrew:tap", repoStatus, homebrewRepository, "Homebrew installs"))
    }

    if (scoopRepository === undefined) {
      checks.push({ id: "scoop:repository-config", ok: false, message: "Scoop target repository must be configured." })
    } else {
      const repoStatus = await httpJson(withBase(githubApiBase, `repos/${scoopRepository}`))
      checks.push(...githubRepoChecks("scoop:bucket", repoStatus, scoopRepository, "Scoop installs"))
    }

    if (pypiPackageName === undefined) {
      checks.push({ id: "pypi:package-config", ok: false, message: "PyPI wheel packageName must be configured." })
    } else {
      const pypiStatus = await httpStatus(withBase(pypiApiBase, `${pypiPackageName}/${packageVersion}/json`))
      checks.push(statusCheck(
        "pypi:version-available",
        pypiStatus,
        404,
        `${pypiPackageName} ${packageVersion} is not published on PyPI yet.`,
        `${pypiPackageName} ${packageVersion} must not already exist on PyPI`
      ))
    }
  }
}

printChecks(checks)

if (checks.some((check) => !check.ok)) {
  exit(1)
}
