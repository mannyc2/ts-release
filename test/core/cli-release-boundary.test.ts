import * as BunServices from "@effect/platform-bun/BunServices"
import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  ReleasePreparationError,
  encodeCompletePreparedReleaseRef
} from "../../src/index.js"
import { makeCli } from "../../apps/release-ts/src/cli/command.js"
import {
  decodeLocalPreparedReference,
  defaultStoreDirectory,
  runObserve,
  runPrepare,
  runPublish,
  runRelease
} from "../../apps/release-ts/src/cli/commands.js"
import {
  blockedReport,
  cliApi,
  cliApiFactory,
  completeReport,
  hostedPrepared,
  ioFor,
  localPrepared,
  observationReport,
  uncertainReport
} from "./cli-fixture.js"

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-cli-boundary-"))
  const configPath = join(root, "release.config.json")
  writeFileSync(configPath, "{}\n")
  return { root, configPath, io: ioFor({ [configPath]: "{}\n" }) }
}

const scopeWarning =
  "publish re-observes every subject and mutates only what a provider decision authorizes; " +
  "conflicts and unobservable outcomes still require operator action."

const resume = `Resume: ts-release publish ${encodeCompletePreparedReleaseRef(localPrepared)}`

describe("CLI durable-reference boundary", () => {
  test("prepare prints only the canonical encoded complete reference", async () => {
    const { root, configPath, io } = fixture()
    await runPrepare(cliApi(), { config: configPath, root }, root, io)
    expect(io.logs).toEqual([encodeCompletePreparedReleaseRef(localPrepared)])
  })

  test("observe is read-only and forwards the decoded prepared reference", async () => {
    let observed = 0
    let published = 0
    const io = ioFor()
    await runObserve(cliApi({
      observe: async (input) => {
        observed += 1
        expect(input.prepared).toEqual(localPrepared)
        return observationReport
      },
      publish: async () => {
        published += 1
        return completeReport
      }
    }), { prepared: localPrepared }, process.cwd(), io)
    expect(observed).toBe(1)
    expect(published).toBe(0)
    expect(JSON.parse(io.logs[0]!)).toMatchObject({ status: "equivalent" })
  })

  test("noncomplete publish emits its report, scope warning, and final resume line before failing", async () => {
    for (const report of [blockedReport, uncertainReport]) {
      const io = ioFor()
      await expect(runPublish(cliApi({ publish: async () => report }), {
        prepared: localPrepared
      }, process.cwd(), io)).rejects.toMatchObject({
        _tag: "ReleaseIncompleteError",
        prepared: localPrepared,
        status: report.status
      })
      expect(JSON.parse(io.logs[0]!)).toMatchObject({ status: report.status })
      expect(io.logs.at(-2)).toBe(scopeWarning)
      expect(io.logs.at(-1)).toBe(resume)
    }
  })

  test("noncomplete release emits its reference/report and the same final resume line", async () => {
    const { root, configPath, io } = fixture()
    await expect(runRelease(cliApi({
      release: async () => ({ prepared: localPrepared, report: blockedReport })
    }), { config: configPath, root }, root, io)).rejects.toMatchObject({
      _tag: "ReleaseIncompleteError",
      status: "blocked"
    })
    expect(JSON.parse(io.logs[0]!)).toMatchObject({
      prepared: encodeCompletePreparedReleaseRef(localPrepared),
      report: { status: "blocked" }
    })
    expect(io.logs.at(-2)).toBe(scopeWarning)
    expect(io.logs.at(-1)).toBe(resume)
  })

  test("precommit preparation failure ends with the zero-mutation typed-error line", async () => {
    const { root, configPath, io } = fixture()
    await expect(runRelease(cliApi({
      release: async () => {
        throw new ReleasePreparationError({ cause: "artifact staging failed\nbefore commit" })
      }
    }), { config: configPath, root }, root, io)).rejects.toMatchObject({
      _tag: "ReleasePreparationError"
    })
    expect(io.logs.at(-1)).toBe(
      "No remote mutation was attempted. Fix ReleasePreparationError: " +
      "artifact staging failed before commit and rerun 'ts-release release'."
    )
  })

  test("hosted references are refused with workflow recovery guidance", async () => {
    const encoded = encodeCompletePreparedReleaseRef(hostedPrepared)
    await expect(decodeLocalPreparedReference(encoded)).rejects.toMatchObject({
      _tag: "HostedPreparedReferenceUnsupported",
      prepared: encoded,
      reason: expect.stringContaining("actions:read")
    })
    await expect(decodeLocalPreparedReference(encoded)).rejects.toMatchObject({
      reason: expect.stringContaining(`prepared-ref=${encoded}`)
    })
  })

  test("shared --store selects the host layer and defaults under cwd", async () => {
    const { root, configPath, io } = fixture()
    const stores: Array<string> = []
    const command = makeCli(cliApiFactory({}, (store) => stores.push(store)), root, io)
    const run = Command.runWith(command, { version: "0.0.0-test" })
    const selected = join(root, "alternate-store")

    await Effect.runPromise(run([
      "prepare",
      "--config",
      configPath,
      "--root",
      root,
      "--store",
      selected
    ]).pipe(Effect.provide(BunServices.layer)))
    await Effect.runPromise(run([
      "prepare",
      "--config",
      configPath,
      "--root",
      root
    ]).pipe(Effect.provide(BunServices.layer)))

    expect(stores).toEqual([
      resolve(selected),
      defaultStoreDirectory(root)
    ])
  })

  test("the command decoder rejects gha before constructing an API or touching a store", async () => {
    let opens = 0
    const encoded = encodeCompletePreparedReleaseRef(hostedPrepared)
    const command = makeCli((store) => {
      opens += 1
      return cliApiFactory()(store)
    }, process.cwd(), ioFor())

    await expect(Effect.runPromise(Command.runWith(command, { version: "0.0.0-test" })([
      "observe",
      encoded
    ]).pipe(Effect.provide(BunServices.layer)))).rejects.toMatchObject({
      _tag: "HostedPreparedReferenceUnsupported"
    })
    expect(opens).toBe(0)
  })
})
