import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { basename, join, parse } from "node:path"
import {
  assertSafeRemovalPath,
  makeRepoScratchDirectory,
  makeSystemScratchDirectory,
  prepareScratchDirectory,
  UnsafeScratchPathError
} from "../scripts/lib/scratch-workspace.js"
import { rm } from "node:fs/promises"
import { withTempDirectoryPromise } from "./helpers.js"

const ScriptLayer = BunServices.layer

const runScriptEffect = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>
): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(ScriptLayer)))

const runScriptFailure = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>
): Promise<E> => runScriptEffect(effect.pipe(Effect.flip))

describe("script scratch workspace", () => {
  test("accepts generated repository scratch directories", async () => {
    await withTempDirectoryPromise("ts-release-scratch-root-", async (root) => {
      const scratch = await runScriptEffect(makeRepoScratchDirectory(".tmp-scratch-test-", root))
      expect(basename(scratch).startsWith(".tmp-scratch-test-")).toBe(true)
      await runScriptEffect(assertSafeRemovalPath(scratch, {
        expectedParent: root,
        allowedPrefixes: [".tmp-scratch-test-"]
      }))
    })
  })

  test("accepts generated system scratch directories", async () => {
    const scratch = await runScriptEffect(makeSystemScratchDirectory("ts-release-system-scratch-"))
    try {
      expect(basename(scratch).startsWith("ts-release-system-scratch-")).toBe(true)
      await runScriptEffect(assertSafeRemovalPath(scratch, {
        allowedPrefixes: ["ts-release-system-scratch-"]
      }))
    } finally {
      await rm(scratch, { recursive: true, force: true })
    }
  })

  test("rejects unsafe removal paths", async () => {
    const repoRootError = await runScriptFailure(assertSafeRemovalPath(process.cwd(), {
      allowedBasenames: [basename(process.cwd())]
    }))
    expect(repoRootError).toBeInstanceOf(UnsafeScratchPathError)

    const filesystemRoot = parse(process.cwd()).root
    const rootError = await runScriptFailure(assertSafeRemovalPath(filesystemRoot, {
      allowedBasenames: [basename(filesystemRoot)]
    }))
    expect(rootError).toBeInstanceOf(UnsafeScratchPathError)

    const home = process.env.HOME ?? process.env.USERPROFILE
    if (home !== undefined) {
      const homeError = await runScriptFailure(assertSafeRemovalPath(home, {
        allowedBasenames: [basename(home)]
      }))
      expect(homeError).toBeInstanceOf(UnsafeScratchPathError)
    }
  })

  test("rejects unexpected basenames", async () => {
    await withTempDirectoryPromise("ts-release-scratch-parent-", async (root) => {
      const unsafe = join(root, "not-allowed")
      const error = await runScriptFailure(assertSafeRemovalPath(unsafe, {
        expectedParent: root,
        allowedPrefixes: [".tmp-allowed-"]
      }))
      expect(error).toBeInstanceOf(UnsafeScratchPathError)
    })
  })

  test("prepares a safe scratch directory", async () => {
    await withTempDirectoryPromise("ts-release-prepare-parent-", async (root) => {
      const scratch = join(root, ".tmp-prepare-test")
      const prepared = await runScriptEffect(prepareScratchDirectory(scratch, {
        expectedParent: root,
        allowedPrefixes: [".tmp-prepare-"]
      }))
      expect(prepared).toBe(scratch)
    })
  })
})
