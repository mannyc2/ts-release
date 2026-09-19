import { expect, test } from "bun:test"
import { Effect, Redacted } from "effect"
import { existsSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
import {
  checked,
  credentialEnvironment,
  openGitRuntime,
} from "../../../packages/ts-release/src/platform/GitProcess.js"

const gitExecutable = realpathSync(Bun.which("git")!)
const options = {
  gitExecutable,
  temporaryRoot: tmpdir(),
  timeoutMilliseconds: 5000,
  maximumOutputBytes: 1024 * 1024,
}
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes).trim()

test("native Git owns SHA1/SHA256 object hashing in private repositories and removes them on scope exit", async () => {
  const directories: string[] = []
  for (const format of ["sha1", "sha256"] as const) {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime(options),
            repository = yield* runtime.repository(format)
          directories.push(repository.directory)
          expect(text(yield* checked(repository.run, ["rev-parse", "--show-object-format"]))).toBe(
            format,
          )
          const bytes = Uint8Array.from([0, 1, 2, 255, 10, 13])
          const oid = text(
            yield* checked(repository.run, ["hash-object", "-t", "blob", "-w", "--stdin"], bytes),
          )
          expect(oid).toBe(
            createHash(format).update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),
          )
          expect(yield* checked(repository.run, ["cat-file", "blob", oid])).toEqual(bytes)
          expect(existsSync(repository.directory)).toBe(true)
        }),
      ),
    )
  }
  expect(directories.every((directory) => !existsSync(directory))).toBe(true)
})

test("native credential configuration retains hooks/TLS/redirect protection without inheriting ambient Git config", async () => {
  const before = {
    count: process.env.GIT_CONFIG_COUNT,
    key: process.env.GIT_CONFIG_KEY_0,
    value: process.env.GIT_CONFIG_VALUE_0,
  }
  process.env.GIT_CONFIG_COUNT = "1"
  process.env.GIT_CONFIG_KEY_0 = "http.followRedirects"
  process.env.GIT_CONFIG_VALUE_0 = "true"
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime(options),
            repository = yield* runtime.repository("sha1")
          const remote = "https://github.com/fixture/release.git"
          const environment = credentialEnvironment(
            { remote, ref: "refs/heads/release", principal: "publisher", scope: "catalog" },
            { _tag: "Bearer", token: Redacted.make("fixture-native-git-token") },
          )
          for (const [name, expected] of [
            ["http.followRedirects", "false"],
            ["http.sslVerify", "true"],
            ["credential.helper", ""],
            [`http.${remote}.extraHeader`, "Authorization: Bearer fixture-native-git-token"],
          ]) {
            expect(
              text(
                yield* checked(repository.run, ["config", "--get", name!], undefined, environment),
              ),
            ).toBe(expected!)
          }
          const hooks = text(
            yield* checked(
              repository.run,
              ["config", "--get", "core.hooksPath"],
              undefined,
              environment,
            ),
          )
          expect(hooks.endsWith("/no-hooks")).toBe(true)
          expect(existsSync(hooks)).toBe(false)
        }),
      ),
    )
  } finally {
    for (const [key, value] of [
      ["GIT_CONFIG_COUNT", before.count],
      ["GIT_CONFIG_KEY_0", before.key],
      ["GIT_CONFIG_VALUE_0", before.value],
    ] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("native output bounds fail with a fixed diagnostic; Git credentials reject wrong transport and malformed values", async () => {
  await expect(
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime({ ...options, maximumOutputBytes: 64 }),
            repository = yield* runtime.repository("sha1")
          yield* checked(repository.run, ["config", "--list"])
        }),
      ),
    ),
  ).rejects.toThrow("complete bounded output")
  const coordinate = {
    remote: "file:///tmp/fixture.git",
    ref: "refs/heads/release",
    principal: "publisher",
    scope: "catalog",
  }
  expect(() =>
    credentialEnvironment(coordinate, { _tag: "Bearer", token: Redacted.make("fixture") }),
  ).toThrow()
  for (const token of ["", "space here", "line\nbreak"])
    expect(() =>
      credentialEnvironment(
        { ...coordinate, remote: "https://github.com/fixture/release.git" },
        { _tag: "Bearer", token: Redacted.make(token) },
      ),
    ).toThrow()
})
