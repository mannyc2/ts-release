import { describe, expect, test } from "bun:test"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

interface ProcessTrace {
  readonly credentialRequests: ReadonlyArray<{
    readonly subject: string
    readonly provider: string
    readonly audience: string
    readonly purpose: string
    readonly strategy: Readonly<Record<string, string>>
  }>
  readonly consumedCredentialRefs: ReadonlyArray<string>
  readonly mutationRequests: ReadonlyArray<unknown>
  readonly httpExchanges: ReadonlyArray<{
    readonly subject: string
    readonly method: string
    readonly url: string
    readonly grant: string
    readonly credentialRef?: string
  }>
  readonly sourceCommands: ReadonlyArray<ReadonlyArray<string>>
  readonly preparationCommands: ReadonlyArray<{
    readonly argv: ReadonlyArray<string>
    readonly environmentNames: ReadonlyArray<string>
  }>
  readonly failure?: {
    readonly tag: string
    readonly status?: string
    readonly message: string
  }
}

interface ProcessResult {
  readonly exitCode: number
  readonly timedOut: boolean
  readonly stdout: string
  readonly stderr: string
  readonly trace: ProcessTrace
}

const repositoryRoot = process.cwd()
const fixtureScript = join(repositoryRoot, "test", "fixtures", "cli-process-plan224.ts")

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const run = (
  argv: ReadonlyArray<string>,
  cwd: string
): string => {
  const result = Bun.spawnSync([...argv], {
    cwd,
    env: { PATH: process.env.PATH ?? "" },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 20_000
  })
  const stdout = text(result.stdout)
  const stderr = text(result.stderr)
  if (result.exitCode !== 0 || result.exitedDueToTimeout === true) {
    throw new Error(`Command failed: ${argv.join(" ")}\n${stdout}\n${stderr}`)
  }
  return stdout
}

const initializeRepository = (workspace: string): void => {
  run(["git", "init", "--quiet"], workspace)
  run(["git", "add", "--all"], workspace)
  run([
    "git",
    "-c",
    "user.name=Plan 224 Fixture",
    "-c",
    "user.email=plan224@example.test",
    "commit",
    "--quiet",
    "-m",
    "fixture"
  ], workspace)
  expect(run(["git", "status", "--porcelain=v1", "--untracked-files=all"], workspace)).toBe("")
}

const workspaceFixture = (
  name: string,
  config?: unknown
): { readonly root: string, readonly workspace: string, readonly store: string } => {
  const root = mkdtempSync(join(tmpdir(), `ts-release-plan224-${name}-`))
  const workspace = join(root, "workspace")
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, "package.json"), `${JSON.stringify({
    name: "plan224-fixture",
    version: "1.0.0",
    repository: "https://github.com/owner/fixture.git",
    files: ["payload.txt"]
  }, null, 2)}\n`)
  writeFileSync(join(workspace, "payload.txt"), "exact Plan 224 fixture bytes\n")
  if (config !== undefined) {
    writeFileSync(join(workspace, "release.config.json"), `${JSON.stringify(config, null, 2)}\n`)
  }
  initializeRepository(workspace)
  return { root, workspace, store: join(root, "prepared-store") }
}

const runCliProcess = (
  fixture: { readonly root: string, readonly workspace: string },
  name: string,
  argv: ReadonlyArray<string>,
  credentials: Readonly<Record<string, string>> = {}
): ProcessResult => {
  const tracePath = join(fixture.root, `${name}-trace.json`)
  const result = Bun.spawnSync([
    process.execPath,
    fixtureScript,
    fixture.workspace,
    tracePath,
    ...argv
  ], {
    cwd: repositoryRoot,
    env: {
      PATH: process.env.PATH ?? "",
      TMPDIR: process.env.TMPDIR ?? tmpdir(),
      ...credentials
    },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000
  })
  return {
    exitCode: result.exitCode,
    timedOut: result.exitedDueToTimeout === true,
    stdout: text(result.stdout),
    stderr: text(result.stderr),
    trace: JSON.parse(readFileSync(tracePath, "utf8")) as ProcessTrace
  }
}

const releaseArgs = (store: string): ReadonlyArray<string> => [
  "release",
  "--config",
  "release.config.json",
  "--root",
  ".",
  "--store",
  store
]

describe("Plan 224 real CLI process", () => {
  test("a clean build-only release completes without any credential capability", () => {
    const fixture = workspaceFixture("build-only", {
      project: { name: "plan224-fixture", version: "1.0.0", tag: "v1.0.0" },
      artifacts: [{ id: "payload", path: "payload.txt", format: "file" }],
      publish: {}
    })
    try {
      const result = runCliProcess(fixture, "build-only", releaseArgs(fixture.store))

      expect(result.timedOut).toBe(false)
      expect(result.exitCode, result.stderr).toBe(0)
      expect(result.stdout).toMatch(/"prepared":"prepared:local:sha256-[a-f0-9]{64}"/u)
      expect(result.stdout).toContain('"status":"complete"')
      expect(result.trace.failure).toBeUndefined()
      expect(result.trace.credentialRequests).toEqual([])
      expect(result.trace.consumedCredentialRefs).toEqual([])
      expect(result.trace.mutationRequests).toEqual([])
      expect(result.trace.httpExchanges).toEqual([])
      expect(result.trace.sourceCommands.length).toBeGreaterThan(0)

      const prepared = /"prepared":"(prepared:local:sha256-[a-f0-9]{64})"/u.exec(result.stdout)?.[1]
      expect(prepared).toBeDefined()
      const inspected = runCliProcess(fixture, "build-only-inspect", [
        "inspect",
        prepared!,
        "--store",
        fixture.store
      ])
      expect(inspected.exitCode, inspected.stderr).toBe(0)
      expect(JSON.parse(inspected.stdout)).toMatchObject({
        artifacts: [{ id: "payload", kind: "file" }]
      })
      expect(Array.isArray((JSON.parse(inspected.stdout) as { artifacts: unknown }).artifacts)).toBe(true)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  }, 30_000)

  test("a blocked GitHub prerequisite prevents every npm capability request", () => {
    const fixture = workspaceFixture("provider-capabilities", {
      project: {
        name: "plan224-fixture",
        version: "1.0.0",
        tag: "v1.0.0",
        repository: "owner/fixture"
      },
      npmPackage: { path: "." },
      publish: {
        npm: {
          registry: "https://registry.example.test/",
          authentication: {
            strategy: "token",
            credential: "PLAN224_NPM_TOKEN"
          },
          provenance: "disabled"
        },
        github: {
          repository: "owner/fixture",
          tokenEnv: "PLAN224_GITHUB_TOKEN",
          ids: []
        }
      }
    })
    const sentinels = {
      PLAN224_NPM_TOKEN: "sentinel:PLAN224_NPM_TOKEN",
      PLAN224_GITHUB_TOKEN: "sentinel:PLAN224_GITHUB_TOKEN",
      DECOY_PROVIDER_TOKEN: "sentinel:DECOY_PROVIDER_TOKEN"
    }
    try {
      const result = runCliProcess(
        fixture,
        "provider-capabilities",
        releaseArgs(fixture.store),
        sentinels
      )

      expect(result.timedOut).toBe(false)
      expect(result.exitCode).toBe(1)
      expect(result.trace.failure).toMatchObject({
        tag: "ReleaseIncompleteError",
        status: "blocked"
      })
      expect(result.stdout).toContain('"status":"blocked"')
      expect(result.stdout).toMatch(/Resume: ts-release publish prepared:local:sha256-[a-f0-9]{64}/u)
      expect(result.trace.credentialRequests).toEqual([
        {
          subject: "github:owner/fixture#v1.0.0",
          provider: "github",
          audience: "https://api.github.com/repos/owner/fixture",
          purpose: "observe",
          strategy: { kind: "anonymous" }
        },
        {
          subject: "github:owner/fixture#v1.0.0",
          provider: "github",
          audience: "https://api.github.com/repos/owner/fixture",
          purpose: "observe",
          strategy: { kind: "token", credential: "PLAN224_GITHUB_TOKEN" }
        }
      ])
      expect(result.trace.consumedCredentialRefs).toEqual(["PLAN224_GITHUB_TOKEN"])
      expect(result.trace.httpExchanges).toEqual([
        {
          subject: "github:owner/fixture#v1.0.0",
          method: "GET",
          url: "https://api.github.com/repos/owner/fixture",
          grant: "AnonymousAccess"
        },
        {
          subject: "github:owner/fixture#v1.0.0",
          method: "GET",
          url: "https://api.github.com/repos/owner/fixture",
          grant: "ScopedSecret",
          credentialRef: "PLAN224_GITHUB_TOKEN"
        }
      ])
      expect(result.trace.mutationRequests).toEqual([])
      expect(result.trace.preparationCommands.some(({ argv }) => argv.slice(0, 2).join(" ") === "npm pack")).toBe(true)
      expect(result.trace.preparationCommands.every(({ environmentNames }) => environmentNames.length === 0)).toBe(true)
      const output = `${result.stdout}\n${result.stderr}\n${JSON.stringify(result.trace)}`
      expect(output).not.toContain(sentinels.PLAN224_NPM_TOKEN)
      expect(output).not.toContain(sentinels.PLAN224_GITHUB_TOKEN)
      expect(output).not.toContain(sentinels.DECOY_PROVIDER_TOKEN)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  }, 30_000)

  test("the noninteractive preset compiles, runs, and stops at conservative observation", () => {
    const fixture = workspaceFixture("preset")
    try {
      const init = runCliProcess(fixture, "preset-init", [
        "init",
        "--preset",
        "bun-npm-github",
        "--config",
        "release.config.json",
        "--root",
        ".",
        "--store",
        fixture.store
      ])

      expect(init.timedOut).toBe(false)
      expect(init.exitCode, init.stderr).toBe(0)
      expect(init.trace.failure).toBeUndefined()
      expect(init.trace.credentialRequests).toEqual([])
      expect(init.trace.httpExchanges).toEqual([])
      expect(JSON.parse(readFileSync(join(fixture.workspace, "release.config.json"), "utf8")))
        .toEqual({
          project: { repository: "owner/fixture" },
          versionFrom: "manifest",
          npmPackage: { path: "." },
          publish: {
            npm: {
              registry: "https://registry.npmjs.org/",
              authentication: {
                strategy: "trusted-publishing",
                attestation: {
                  provider: "github-actions",
                  runner: "github-hosted",
                  repository: "owner/fixture",
                  workflow: "release.yml",
                  workflowRef: "refs/heads/main",
                  allowedAction: "npm-publish-direct"
                }
              },
              access: "public",
              provenance: "automatic"
            },
            github: {
              repository: "owner/fixture",
              tokenEnv: "GITHUB_TOKEN",
              draft: true,
              prerelease: false
            }
          }
        })

      run(["git", "add", "release.config.json"], fixture.workspace)
      run([
        "git",
        "-c",
        "user.name=Plan 224 Fixture",
        "-c",
        "user.email=plan224@example.test",
        "commit",
        "--quiet",
        "-m",
        "generated preset"
      ], fixture.workspace)
      expect(run([
        "git",
        "status",
        "--porcelain=v1",
        "--untracked-files=all"
      ], fixture.workspace)).toBe("")

      const release = runCliProcess(
        fixture,
        "preset-release",
        releaseArgs(fixture.store),
        { GITHUB_TOKEN: "sentinel:GITHUB_TOKEN" }
      )

      expect(release.timedOut).toBe(false)
      expect(release.exitCode).toBe(1)
      expect(release.trace.failure).toMatchObject({
        tag: "ReleaseIncompleteError",
        status: "blocked"
      })
      expect(release.stdout).toContain('"status":"blocked"')
      expect(release.trace.credentialRequests.map(({ provider, purpose, strategy }) => ({
        provider,
        purpose,
        kind: strategy.kind
      }))).toEqual([
        { provider: "github", purpose: "observe", kind: "anonymous" },
        { provider: "github", purpose: "observe", kind: "token" }
      ])
      expect(release.trace.consumedCredentialRefs).toEqual(["GITHUB_TOKEN"])
      expect(release.trace.mutationRequests).toEqual([])
      expect(release.trace.httpExchanges.every(({ method }) => method === "GET")).toBe(true)
      expect(release.trace.preparationCommands.some(({ argv }) => argv.slice(0, 2).join(" ") === "npm pack")).toBe(true)
      expect(release.trace.preparationCommands.every(({ environmentNames }) => environmentNames.length === 0)).toBe(true)
      expect(`${release.stdout}\n${release.stderr}\n${JSON.stringify(release.trace)}`)
        .not.toContain("sentinel:GITHUB_TOKEN")
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  }, 45_000)
})
