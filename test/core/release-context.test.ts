import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { parseSha256Hex, sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, SafeRelativePath, Version, WorkspaceRoot } from "../../src/model/primitives.js"
import { makeSourceObserver, ReleaseContextError, type SourceObserverRuntime, VerifiedPackage, VerifiedReleaseContext, VerifiedSource, verifySource } from "../../src/release/context.js"
import { materializeGitSource } from "../../src/platform/source-observer.js"

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
      digest: (bytes) => Effect.sync(() => sha256Digest(bytes)),
      materialize: (workspace, source, destination) => Effect.try({
        try: () => materializeGitSource(workspace, source, destination), catch: (cause) => cause
      })
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

  test("refuses tracked changes and excludes untracked bytes from verified source", async () => {
    const tracked = repository()
    writeFileSync(join(tracked.root, "package.json"), JSON.stringify({ name: "@fixture/release", version: "9.9.9" }))
    await expect(Effect.runPromise(tracked.observer.observe(
      WorkspaceRoot.make(tracked.root), SafeRelativePath.make("package.json")
    ))).rejects.toMatchObject({ _tag: "ReleaseContextError", field: "source.clean" })

    const untracked = repository()
    writeFileSync(join(untracked.root, "untracked.txt"), "not ignored")
    const observed = await Effect.runPromise(untracked.observer.observe(
      WorkspaceRoot.make(untracked.root), SafeRelativePath.make("package.json")
    ))
    expect(observed.source.clean).toBe(true)
    expect(observed.source.packageManifestDigest.hex).toBe(
      sha256Digest(new Uint8Array(readFileSync(join(untracked.root, "package.json")))).hex
    )
  })

  test("materializes exact commit blobs, modes, and contained links without workspace extras", async () => {
    const fixture = repository()
    const destination = mkdtempSync(join(tmpdir(), "ts-release-context-stage-"))
    try {
      writeFileSync(join(fixture.root, "tool.sh"), "#!/bin/sh\nexit 0\n")
      chmodSync(join(fixture.root, "tool.sh"), 0o755)
      symlinkSync("tool.sh", join(fixture.root, "tool-link"))
      git(fixture.root, "add", "tool.sh", "tool-link")
      git(fixture.root, "commit", "-qm", "add exact source kinds")
      writeFileSync(join(fixture.root, "workspace-only.txt"), "untracked\n")
      mkdirSync(join(fixture.root, ".release"), { recursive: true })
      writeFileSync(join(fixture.root, ".release", "ignored.txt"), "ignored\n")
      const observed = await Effect.runPromise(fixture.observer.observe(
        WorkspaceRoot.make(fixture.root), SafeRelativePath.make("package.json")
      ))
      const snapshot = await Effect.runPromise(fixture.observer.materialize(
        observed.workspace, observed.source, WorkspaceRoot.make(destination)
      ))
      expect(readFileSync(join(destination, "tool.sh"), "utf8")).toContain("exit 0")
      expect(lstatSync(join(destination, "tool.sh")).mode & 0o111).not.toBe(0)
      expect(readlinkSync(join(destination, "tool-link"))).toBe("tool.sh")
      expect(existsSync(join(destination, "workspace-only.txt"))).toBe(false)
      expect(existsSync(join(destination, ".release"))).toBe(false)
      expect(snapshot.entries.some((entry) => entry.path.toString() === "tool-link" && entry.kind === "symlink")).toBe(true)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
      rmSync(destination, { recursive: true, force: true })
    }
  })

  test("rejects case-colliding and escaping Git tree paths", async () => {
    for (const kind of ["case", "link"] as const) {
      const fixture = repository()
      const destination = mkdtempSync(join(tmpdir(), "ts-release-context-unsafe-stage-"))
      try {
        if (kind === "case") {
          // Construct both index entries directly so the witness does not depend
          // on whether the host worktree filesystem is case-sensitive.
          writeFileSync(join(fixture.root, "Case.txt"), "collision\n")
          writeFileSync(join(fixture.root, "case.txt"), "collision\n")
          const blob = git(fixture.root, "hash-object", "-w", "Case.txt").trim()
          git(fixture.root, "config", "core.ignorecase", "false")
          git(fixture.root, "update-index", "--add", "--cacheinfo", "100644", blob, "Case.txt")
          git(fixture.root, "update-index", "--add", "--cacheinfo", "100644", blob, "case.txt")
          expect(git(fixture.root, "ls-files", "Case.txt", "case.txt").trim().split("\n")).toEqual(["Case.txt", "case.txt"])
        } else {
          symlinkSync("../outside", join(fixture.root, "escape"))
          git(fixture.root, "add", "escape")
        }
        git(fixture.root, "commit", "-qm", `unsafe ${kind}`)
        const observed = await Effect.runPromise(fixture.observer.observe(
          WorkspaceRoot.make(fixture.root), SafeRelativePath.make("package.json")
        ))
        await expect(Effect.runPromise(fixture.observer.materialize(
          observed.workspace, observed.source, WorkspaceRoot.make(destination)
        ))).rejects.toMatchObject({ _tag: "SourceMaterializationError" })
      } finally {
        rmSync(fixture.root, { recursive: true, force: true })
        rmSync(destination, { recursive: true, force: true })
      }
    }
  })
})
