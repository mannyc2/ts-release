// `--from-git` is the only path where the CLI observes anything, so these cases
// run against a REAL temporary git repository: a mocked observer would prove
// only that the mock agrees with itself.
import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeCli, type CliIo } from "../../apps/release-ts/src/cli/command.js"
import type { ReleaseApi } from "../../src/api/api.js"
import { makeReleaseApi } from "../../src/api/api.js"
import { LocalApprovalSignerLayer } from "../../src/apply/approval.js"
import { makeFileRunStore, RunStore } from "../../src/apply/store.js"
import { CredentialStore, DriverCatalog, ReadResult, WorkspaceStore } from "../../src/drivers/services.js"
import { makeNodeWorkspaceStore } from "../../src/drivers/workspace.js"

const releaseLayer = Layer.mergeAll(
  Layer.succeed(RunStore)(makeFileRunStore()),
  Layer.succeed(WorkspaceStore)(makeNodeWorkspaceStore()),
  Layer.succeed(DriverCatalog)({
    structured: () => Effect.succeed({ outcome: "observed", outputs: [] }),
    publish: () => Effect.die("unused"),
    reconcile: () => Effect.succeed(ReadResult.make({ found: false }))
  }),
  Layer.succeed(CredentialStore)({
    getRead: () => Effect.die("unused"),
    getPublish: () => Effect.die("unused")
  }),
  LocalApprovalSignerLayer
)

const run = (workspace: string, argv: ReadonlyArray<string>): string => {
  const result = spawnSync(argv[0]!, argv.slice(1), {
    cwd: workspace, encoding: "utf8", stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid"
    }
  })
  if (result.status !== 0) throw new Error(`${argv.join(" ")} failed: ${result.stderr}`)
  return result.stdout.trim()
}

const authored = {
  project: { name: "@scope/fixture" },
  artifacts: [{ id: "fixture", path: "dist/fixture", format: "file" }],
  versionFrom: "git-tag",
  publish: {}
}

const repository = (config: unknown, manifest?: unknown) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-from-git-")))
  mkdirSync(join(root, "dist"))
  writeFileSync(join(root, "dist/fixture"), "fixture")
  writeFileSync(join(root, "release.config.json"), JSON.stringify(config, null, 2))
  if (manifest !== undefined) {
    writeFileSync(join(root, "package.json"), JSON.stringify(manifest, null, 2))
  }
  run(root, ["git", "init", "-q", "-b", "main"])
  run(root, ["git", "add", "-A"])
  run(root, ["git", "commit", "-q", "-m", "fixture"])
  run(root, ["git", "tag", "v0.1.0"])
  return { root, head: run(root, ["git", "rev-parse", "HEAD"]) }
}

const io = (logs: Array<string>): CliIo => ({
  read: (path: string) => readFileSync(path, "utf8"),
  write: (path: string, value: string) => {
    mkdirSync(join(path, ".."), { recursive: true })
    writeFileSync(path, value)
  },
  log: (value: string) => logs.push(value)
})

const invoke = (
  api: ReleaseApi, cwd: string, cliIo: CliIo, argv: ReadonlyArray<string>
): Promise<void> =>
  Effect.runPromise(
    Command.runWith(makeCli(api, cwd, cliIo), { version: "0.0.0-test" })(argv).pipe(
      Effect.provide(BunServices.layer)
    )
  )

describe("plan --from-git", () => {
  test("plans the repository's own facts and writes the resolved config", async () => {
    const { head, root } = repository(authored)
    const api = makeReleaseApi(releaseLayer)
    const logs: Array<string> = []
    try {
      await invoke(api, root, io(logs), ["plan", "--from-git", "--out", "release-plan.json"])
      const plan = JSON.parse(readFileSync(join(root, "release-plan.json"), "utf8"))
      // The identity is what the repository says, not what someone typed.
      expect(plan.identity.commit).toBe(head)
      expect(plan.identity.version).toBe("0.1.0")
      expect(plan.identity.tag).toBe("v0.1.0")

      const resolved = JSON.parse(readFileSync(join(root, ".release/resolved.config.json"), "utf8"))
      expect(resolved.project.commit).toBe(head)
      expect(resolved.versionFrom).toBeUndefined()
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("a manifest that disagrees with the author refuses, naming both", async () => {
    const { root } = repository(
      { ...authored, versionFrom: "manifest", project: { name: "@scope/fixture", version: "0.9.9" } },
      { name: "@scope/fixture", version: "0.1.0" }
    )
    const api = makeReleaseApi(releaseLayer)
    try {
      await expect(invoke(api, root, io([]), ["plan", "--from-git"]))
        .rejects.toThrow(/"0\.9\.9".*"0\.1\.0".*package manifest/su)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("without --from-git an authoring directive is refused by the core", async () => {
    const { root } = repository({
      ...authored,
      project: { name: "@scope/fixture", version: "0.1.0", tag: "v0.1.0", commit: "abc123" }
    })
    const api = makeReleaseApi(releaseLayer)
    try {
      // The canonical config has never heard of versionFrom, and the excess
      // property names itself in the refusal.
      await expect(invoke(api, root, io([]), ["plan"])).rejects.toThrow(/versionFrom/u)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
