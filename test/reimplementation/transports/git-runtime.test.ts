import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { Effect, Cause } from "effect"
import { tmpdir } from "node:os"
import { ReleaseError } from "../../../packages/ts-release/src/index.js"
import { makeGitCatalogHost, openGitJournal } from "../../../packages/ts-release/src/Node.js"
import type { Credentials } from "../../../packages/ts-release/src/Git.js"
import { nativeGit, processOptions } from "./git-fixture.js"

test("Git catalog and journal sanitize failing, thrown and defective credential acquisition and preserve interruption", async () => {
  const marker = "synthetic-credential-error-marker"
  const error = new ReleaseError({ code: "custom", message: marker })
  const choices: (() => Effect.Effect<Credentials, ReleaseError>)[] = [
    () => Effect.fail(error),
    () => {
      throw error
    },
    () => Effect.die(error),
    () => Effect.interrupt,
  ]
  for (const credentials of choices) {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const coordinate = {
            remote: "https://github.com/fixture/catalog.git",
            ref: "refs/heads/catalog",
            principal: "publisher",
            scope: "catalog",
          }
          const host = yield* makeGitCatalogHost({
            ...processOptions,
            readContent: () => Effect.succeed(new Uint8Array()),
            credentials,
          })
          const journal = yield* openGitJournal({
            ...processOptions,
            ...coordinate,
            cacheDirectory: tmpdir(),
            credentials,
          })
          const calls: Effect.Effect<unknown, ReleaseError>[] = [
            host.observeRef(coordinate),
            journal.read("fixture"),
          ]
          for (const call of calls) {
            const exit = yield* Effect.exit(call)
            expect(exit._tag).toBe("Failure")
            if (exit._tag === "Failure") {
              expect(Cause.hasInterrupts(exit.cause)).toBe(credentials === choices.at(-1))
              expect(String(exit.cause)).not.toContain(marker)
              if (credentials !== choices.at(-1))
                expect(String(exit.cause)).toContain("Git credentials could not be acquired")
            }
          }
        }),
      ),
    )
  }
})

test("public Node and Bun Git host/journal entries execute native SHA1/SHA256 release and reopened-history consumers", async () => {
  for (const executable of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
    const child = Bun.spawn(
      [executable, fileURLToPath(new URL("./git-native-consumer.mjs", import.meta.url)), nativeGit],
      { stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" })
    expect(JSON.parse(stdout).assertions).toBe(15)
  }
}, 30000)

test("native Git subprocess deadline and interruption close the whole process group on Node and Bun", async () => {
  const node = process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node"
  for (const executable of [node, process.execPath]) {
    const child = Bun.spawn(
      [
        executable,
        fileURLToPath(new URL("./git-process-consumer.mjs", import.meta.url)),
        nativeGit,
        node,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, TS_RELEASE_SYNTHETIC_CREDENTIAL: "fixture-only-not-inherited" },
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" })
    expect(JSON.parse(stdout).assertions).toBe(18)
  }
}, 30000)
