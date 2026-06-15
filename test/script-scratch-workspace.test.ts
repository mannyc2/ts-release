import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, parse } from "node:path"
import {
  assertSafeRemovalPath,
  makeRepoScratchDirectory,
  makeSystemScratchDirectory,
  prepareScratchDirectory,
  UnsafeScratchPathError
} from "../scripts/lib/scratch-workspace.js"

const ScriptLayer = BunServices.layer

const runScriptEffect = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>
): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(ScriptLayer)))

const runScriptFailure = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>
): Promise<E> => runScriptEffect(effect.pipe(Effect.flip))

describe("script scratch workspace", () => {
  test("accepts generated repository scratch directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-scratch-root-"))
    try {
      const scratch = await runScriptEffect(makeRepoScratchDirectory(".tmp-scratch-test-", root))
      expect(basename(scratch).startsWith(".tmp-scratch-test-")).toBe(true)
      await runScriptEffect(assertSafeRemovalPath(scratch, {
        expectedParent: root,
        allowedPrefixes: [".tmp-scratch-test-"]
      }))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
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
    const root = await mkdtemp(join(tmpdir(), "ts-release-scratch-parent-"))
    const unsafe = join(root, "not-allowed")
    try {
      const error = await runScriptFailure(assertSafeRemovalPath(unsafe, {
        expectedParent: root,
        allowedPrefixes: [".tmp-allowed-"]
      }))
      expect(error).toBeInstanceOf(UnsafeScratchPathError)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("prepares a safe scratch directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-prepare-parent-"))
    const scratch = join(root, ".tmp-prepare-test")
    try {
      const prepared = await runScriptEffect(prepareScratchDirectory(scratch, {
        expectedParent: root,
        allowedPrefixes: [".tmp-prepare-"]
      }))
      expect(prepared).toBe(scratch)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
