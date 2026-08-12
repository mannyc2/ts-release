import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { parseSha256Hex, sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, SafeRelativePath, Version, WorkspaceRoot } from "../../src/model/primitives.js"
import { makeSourceObserver, ReleaseContextError, type SourceObserverRuntime, VerifiedPackage, VerifiedReleaseContext, VerifiedSource, verifySource } from "../../src/release/context.js"

const context = (commit = "abc123", clean: true = true) => VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(process.cwd()),
  source: VerifiedSource.make({
    commit: NonEmptyName.make(commit), tree: NonEmptyName.make("tree123"), clean,
    packageManifestPath: SafeRelativePath.make("package.json"),
    packageManifestDigest: parseSha256Hex("a".repeat(64)),
    headTags: []
  }),
  package: VerifiedPackage.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
    path: SafeRelativePath.make("package.json"), digest: parseSha256Hex("a".repeat(64)) })
})

describe("verified release context", () => {
  test("accepts a clean source and an agreeing expected commit", async () => {
    await expect(Effect.runPromise(verifySource(context(), NonEmptyName.make("abc123")))).resolves.toBeTruthy()
  })

  test("refuses an expected commit disagreement as structured data", async () => {
    await expect(Effect.runPromise(verifySource(context(), NonEmptyName.make("other")))).rejects.toMatchObject({
      _tag: "ReleaseContextError", field: "source.commit"
    } satisfies Partial<ReleaseContextError>)
  })

  const git = (root: string, ...argv: string[]) => {
    const result = spawnSync("git", argv, { cwd: root, encoding: "utf8" })
    if (result.status !== 0) throw new Error(result.stderr)
    return result.stdout
  }
  const repository = () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-context-"))
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@fixture/release", version: "1.2.3", repository: "fixture/release" }))
    writeFileSync(join(root, ".gitignore"), ".release/\n")
    git(root, "init", "-q")
    git(root, "config", "user.email", "fixture@example.test")
    git(root, "config", "user.name", "fixture")
    git(root, "add", "package.json", ".gitignore")
    git(root, "commit", "-qm", "fixture")
    git(root, "tag", "v1.2.3")
    const runtime: SourceObserverRuntime = {
      canonicalRoot: (workspace) => Effect.sync(() => realpathSync(workspace)),
      read: (workspace, path) => Effect.sync(() => new Uint8Array(readFileSync(join(workspace, path)))),
      command: (workspace, argv) => Effect.try({ try: () => git(workspace, ...argv), catch: (cause) => cause }),
      digest: (bytes) => Effect.sync(() => sha256Digest(bytes))
    }
    return { root, observer: makeSourceObserver(runtime) }
  }

  test("observes one clean checkout, package facts, tree, tags, and ignored release output", async () => {
    const fixture = repository()
    mkdirSync(join(fixture.root, ".release"))
    writeFileSync(join(fixture.root, ".release", "derived.json"), "ignored")
    const result = await Effect.runPromise(fixture.observer.observe(
      WorkspaceRoot.make(fixture.root), SafeRelativePath.make("package.json"), NonEmptyName.make(git(fixture.root, "rev-parse", "HEAD").trim())
    ))
    expect(result.workspace.toString()).toBe(realpathSync(fixture.root))
    expect(result.source.clean).toBe(true)
    expect(result.source.tree.length).toBeGreaterThan(0)
    expect(result.source.headTags.map(String)).toEqual(["v1.2.3"])
    expect(result.package.name.toString()).toBe("@fixture/release")
  })

  test("refuses tracked and untracked source changes before creating verified context", async () => {
    const tracked = repository()
    writeFileSync(join(tracked.root, "package.json"), JSON.stringify({ name: "@fixture/release", version: "9.9.9" }))
    await expect(Effect.runPromise(tracked.observer.observe(
      WorkspaceRoot.make(tracked.root), SafeRelativePath.make("package.json")
    ))).rejects.toMatchObject({ _tag: "ReleaseContextError", field: "source.clean" })

    const untracked = repository()
    writeFileSync(join(untracked.root, "untracked.txt"), "not ignored")
    await expect(Effect.runPromise(untracked.observer.observe(
      WorkspaceRoot.make(untracked.root), SafeRelativePath.make("package.json")
    ))).rejects.toMatchObject({ _tag: "ReleaseContextError", field: "source.clean" })
  })
})
