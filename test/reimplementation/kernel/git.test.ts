import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import {
  GitCas,
  GitReceipt,
  makeCoreGitTransport,
  makeRequest,
  runRelease,
  type HostShape,
  type Operation,
  type RequestFacts,
} from "./kernel.js"
import { evaluatorNames, makeFixture, providerFor, runWithHost, startEvents } from "./fixtures.js"

const git = (args: ReadonlyArray<string>) => {
  const result = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}

for (const candidate of evaluatorNames)
  for (const competitor of [false, true]) {
    test(`${candidate}: real native conditional Git replay ${competitor ? "rejects a competing update" : "confirms an already committed update"}`, async () => {
      const directory = mkdtempSync(join(tmpdir(), "machine-git-"))
      const source = join(directory, "source")
      const remote = join(directory, "remote.git")
      try {
        git(["init", "--quiet", source])
        git(["-C", source, "config", "user.name", "Research fixture"])
        git(["-C", source, "config", "user.email", "fixture@example.invalid"])
        git(["init", "--quiet", "--bare", remote])
        git(["--git-dir", remote, "config", "core.logAllRefUpdates", "true"])
        const commit = (content: string) => {
          writeFileSync(join(source, "artifact"), content)
          git(["-C", source, "add", "artifact"])
          git(["-C", source, "commit", "--quiet", "-m", content])
          return git(["-C", source, "rev-parse", "HEAD"])
        }
        const initial = commit("initial")
        const desired = commit("desired")
        const competing = commit("competing")
        const ref = "refs/heads/release"
        git(["-C", source, "push", "--quiet", remote, `${initial}:${ref}`])
        const provider = {
          ...providerFor(),
          receiptVersion: "git-push/1",
          receiptCodec: GitReceipt,
          receiptCorresponds: (_operation: Operation, request: RequestFacts, native: unknown) => {
            const receipt = native as GitReceipt
            return (
              request.replay._tag === "GitCas" &&
              receipt.ref === request.replay.ref &&
              receipt.desiredNew === request.replay.desiredNew
            )
          },
          prepare: () =>
            makeRequest({
              transport: "core.git/1",
              endpoint: remote,
              method: "update-ref",
              headers: [],
              body: new Uint8Array(),
              principal: "local-fixture",
              scope: ref,
              replay: new GitCas({ ref, expectedOld: initial, desiredNew: desired }),
            }),
        }
        const fixture = await makeFixture(provider, candidate)
        const commands: Array<ReadonlyArray<string>> = []
        const host: HostShape = {
          ...fixture.host,
          transport: makeCoreGitTransport({
            principal: "local-fixture",
            scope: ref,
            execute: (args) =>
              Effect.sync(() => {
                commands.push(args)
                const result = Bun.spawnSync(["git", "-C", source, ...args], {
                  stdout: "pipe",
                  stderr: "pipe",
                })
                // Actual remote update happens; only the first acknowledgment is lost.
                return commands.length === 1
                  ? { exitCode: 1, stdout: "" }
                  : { exitCode: result.exitCode, stdout: result.stdout.toString() }
              }),
          }),
        }
        expect(
          (await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true })))
            .operations[0]?.status,
        ).toBe("Inconclusive")
        expect(git(["--git-dir", remote, "rev-parse", ref])).toBe(desired)
        if (competitor) git(["-C", source, "push", "--quiet", remote, `${competing}:${ref}`])
        const resumed = await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
        expect(resumed.operations[0]?.status).toBe(competitor ? "Inconclusive" : "Satisfied")
        expect(git(["--git-dir", remote, "rev-parse", ref])).toBe(competitor ? competing : desired)
        expect(commands).toHaveLength(2)
        expect(commands[0]).toEqual(commands[1])
        expect(commands[0]).toContain(`--force-with-lease=${ref}:${initial}`)
        expect(
          readFileSync(join(remote, "logs", ref), "utf8")
            .trim()
            .split("\n"),
        ).toHaveLength(competitor ? 3 : 2)
        expect((await startEvents(fixture.store, fixture.plan))[1]?.body).toMatchObject({
          basis: { _tag: "ProtectedReplay" },
        })
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    })
  }
