import { expect, test } from "bun:test"
import { Effect } from "effect"
import { rmSync } from "node:fs"
import { CommitInput, FileEdit } from "../../../packages/ts-release/src/Git.js"
import { canonical } from "../../../packages/ts-release/src/internal/Identity.js"
import { openGitRuntime } from "../../../packages/ts-release/src/platform/GitProcess.js"
import {
  construct,
  exportObjects,
  importObjects,
  verifyGraph,
  verifyManagedCommit,
} from "../../../packages/ts-release/src/platform/GitObjects.js"
import { contentFixture, identity, limit, native, processOptions, seed } from "./git-fixture.js"

const rejects = Effect.fn(function* (effect: Effect.Effect<unknown, unknown>) {
  expect((yield* Effect.exit(effect))._tag).toBe("Failure")
})
for (const format of ["sha1", "sha256"] as const) {
  test(`native ${format} deterministic catalog commit survives producer deletion with exact graph, modes and unmanaged content`, async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime(processOptions),
            original = yield* runtime.repository(format),
            builder = yield* runtime.repository(format),
            restart = yield* runtime.repository(format),
            content = contentFixture(),
            expectedOld = seed(original.directory)
          const baseObjects = content.put(yield* exportObjects(original.run, expectedOld, limit))
          const files = [
            new FileEdit({
              path: "Formula/tool.rb",
              mode: "100644",
              content: content.put("class Tool < Formula\nend\n"),
            }),
            new FileEdit({
              path: "bin/check",
              mode: "100755",
              content: content.put("#!/bin/sh\nexit 0\n"),
            }),
          ]
          const input = new CommitInput({
            remote: "https://github.com/fixture/catalog.git",
            ref: "refs/heads/main",
            principal: "publisher",
            scope: "catalog",
            expectedOld,
            baseObjects,
            files,
            message: "Release\n",
            author: identity,
            committer: identity,
          })
          const built = yield* construct(builder.run, content.read, input, limit)
          expect(built.objectFormat).toBe(format)
          expect(built.desiredNew).toHaveLength(format === "sha1" ? 40 : 64)
          expect(
            native(builder.directory, ["show", `${built.desiredNew}:README.md`]).toString(),
          ).toBe("preserved unmanaged README\n")
          const copy = yield* construct(
            (yield* runtime.repository(format)).run,
            content.read,
            input,
            limit,
          )
          expect(copy).toEqual(built)
          for (const path of ["untouched-empty", "Formula/empty"]) {
            expect(native(builder.directory, ["ls-tree", built.desiredNew, path])).toEqual(
              native(original.directory, ["ls-tree", expectedOld, path]),
            )
          }
          rmSync(original.directory, { recursive: true })
          rmSync(builder.directory, { recursive: true })
          const ids = yield* importObjects(restart.run, built.objectSetBytes, format, limit)
          yield* verifyGraph(restart.run, built.desiredNew, ids)
          yield* verifyManagedCommit(
            restart.run,
            content.read,
            expectedOld,
            built.desiredNew,
            files,
            limit,
          )
          const treeRows = native(restart.directory, ["ls-tree", "-z", built.desiredNew])
            .toString()
            .split("\0")
            .filter(Boolean)
          const droppedTree = native(
            restart.directory,
            ["mktree", "-z"],
            Buffer.from(
              treeRows.filter((row) => !row.endsWith("\tuntouched-empty")).join("\0") + "\0",
            ),
          )
            .toString()
            .trim()
          const malicious = native(
            restart.directory,
            ["commit-tree", droppedTree, "-p", expectedOld],
            Buffer.from("Dropped unrelated empty tree\n"),
          )
            .toString()
            .trim()
          const maliciousGraph = yield* exportObjects(restart.run, malicious, limit)
          const fresh = yield* runtime.repository(format),
            maliciousIds = yield* importObjects(fresh.run, maliciousGraph, format, limit)
          yield* verifyGraph(fresh.run, malicious, maliciousIds)
          yield* rejects(
            verifyManagedCommit(fresh.run, content.read, expectedOld, malicious, files, limit),
          )
          expect(
            native(restart.directory, ["show", `${built.desiredNew}:bin/check`]).toString(),
          ).toBe("#!/bin/sh\nexit 0\n")
          expect(
            native(restart.directory, ["ls-tree", built.desiredNew, "bin/check"]).toString(),
          ).toMatch(/^100755 blob /)
          expect(
            native(restart.directory, ["rev-list", "--parents", "-n", "1", built.desiredNew])
              .toString()
              .trim(),
          ).toBe(`${built.desiredNew} ${expectedOld}`)
          yield* rejects(
            verifyManagedCommit(
              restart.run,
              content.read,
              expectedOld,
              built.desiredNew,
              [files[0]!],
              limit,
            ),
          )
          yield* rejects(
            verifyManagedCommit(
              restart.run,
              content.read,
              expectedOld,
              built.desiredNew,
              [files[0]!, new FileEdit({ ...files[1]!, mode: "100644" })],
              limit,
            ),
          )
          yield* rejects(
            verifyManagedCommit(
              restart.run,
              content.read,
              built.desiredNew,
              expectedOld,
              files,
              limit,
            ),
          )
          const duplicate = JSON.parse(Buffer.from(built.objectSetBytes).toString())
          duplicate.objects.push(duplicate.objects.at(-1))
          yield* rejects(
            importObjects(restart.run, Buffer.from(canonical(duplicate)), format, limit),
          )
          const extra = JSON.parse(Buffer.from(built.objectSetBytes).toString())
          extra.objects.push({
            type: "blob",
            bytesBase64: Buffer.from("unreachable injected object").toString("base64"),
          })
          extra.objects.sort(
            (a: { type: string; bytesBase64: string }, b: { type: string; bytesBase64: string }) =>
              `${a.type}:${a.bytesBase64}` < `${b.type}:${b.bytesBase64}` ? -1 : 1,
          )
          const imported = yield* importObjects(
            restart.run,
            Buffer.from(canonical(extra)),
            format,
            limit,
          )
          yield* rejects(verifyGraph(restart.run, built.desiredNew, imported))
          yield* rejects(
            importObjects(restart.run, Buffer.from(JSON.stringify(extra, null, 2)), format, limit),
          )
          yield* rejects(
            importObjects(
              restart.run,
              built.objectSetBytes,
              format,
              built.objectSetBytes.length - 1,
            ),
          )
          const damaged = content.stored.get(files[0]!.content.sha256)!
          damaged[0] = damaged[0]! ^ 1
          yield* rejects(
            verifyManagedCommit(
              restart.run,
              content.read,
              expectedOld,
              built.desiredNew,
              files,
              limit,
            ),
          )
        }),
      ),
    )
  }, 30000)
}

test("native Git construction rejects invalid managed paths, identity, foreign base graph and case collisions", async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const runtime = yield* openGitRuntime(processOptions),
          repository = yield* runtime.repository("sha1"),
          content = contentFixture()
        const expectedOld = seed(repository.directory),
          baseObjects = content.put(yield* exportObjects(repository.run, expectedOld, limit))
        const file = new FileEdit({
          path: "Formula/tool.rb",
          mode: "100644",
          content: content.put("release\n"),
        })
        const input = new CommitInput({
          remote: "https://github.com/fixture/catalog.git",
          ref: "refs/heads/main",
          principal: "publisher",
          scope: "catalog",
          expectedOld,
          baseObjects,
          files: [file],
          message: "Release\n",
          author: identity,
          committer: identity,
        })
        for (const path of [
          "../escape",
          "/absolute",
          "a\\b",
          ".git/config",
          "a/../b",
          "a//b",
          "line\nbreak",
        ]) {
          yield* rejects(
            construct(
              repository.run,
              content.read,
              new CommitInput({ ...input, files: [new FileEdit({ ...file, path })] }),
              limit,
            ),
          )
        }
        for (const files of [
          [file, file],
          [file, new FileEdit({ ...file, path: "formula/TOOL.rb" })],
          [file, new FileEdit({ ...file, path: "Formula" })],
        ]) {
          yield* rejects(
            construct(repository.run, content.read, new CommitInput({ ...input, files }), limit),
          )
        }
        yield* rejects(
          construct(
            repository.run,
            content.read,
            new CommitInput({ ...input, author: { ...identity, timezone: "+9900" } }),
            limit,
          ),
        )
        yield* rejects(
          construct(
            repository.run,
            content.read,
            new CommitInput({ ...input, expectedOld: "1".repeat(40) }),
            limit,
          ),
        )
        yield* rejects(
          construct(
            repository.run,
            content.read,
            new CommitInput({ ...input, files: [new FileEdit({ ...file, path: "readme.md" })] }),
            limit,
          ),
        )
        expect(native(repository.directory, ["show", `${expectedOld}:README.md`]).toString()).toBe(
          "preserved unmanaged README\n",
        )
      }),
    ),
  )
}, 30000)
