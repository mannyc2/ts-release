import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  assertSafeReleaseArtifactsDirectory,
  packageArtifactPrefix,
  packageTarballArtifactPath,
  releaseCliArtifactTargets,
  UnsafeReleaseArtifactsPathError
} from "../apps/release-ts/scripts/build-release-artifacts.js"

const runScriptEffect = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>
): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))

const runScriptFailure = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>
): Promise<E> => runScriptEffect(effect.pipe(Effect.flip))

describe("build release artifacts script", () => {
  test("derives package artifact names from scoped package identity", () => {
    const identity = {
      name: "@mannyc1/ts-release",
      version: "0.0.3"
    }

    expect(packageArtifactPrefix(identity)).toBe("mannyc1-ts-release-0.0.3")
    expect(packageTarballArtifactPath(identity)).toBe(".release/artifacts/mannyc1-ts-release-0.0.3.tgz")
  })

  test("defines the standalone CLI target matrix", () => {
    expect(releaseCliArtifactTargets("0.0.3")).toEqual([
      {
        id: "cli-linux-x64",
        bunTarget: "bun-linux-x64-baseline",
        outfile: ".release/artifacts/ts-release-0.0.3-linux-x64"
      },
      {
        id: "cli-linux-arm64",
        bunTarget: "bun-linux-arm64",
        outfile: ".release/artifacts/ts-release-0.0.3-linux-arm64"
      },
      {
        id: "cli-darwin-x64",
        bunTarget: "bun-darwin-x64",
        outfile: ".release/artifacts/ts-release-0.0.3-darwin-x64"
      },
      {
        id: "cli-darwin-arm64",
        bunTarget: "bun-darwin-arm64",
        outfile: ".release/artifacts/ts-release-0.0.3-darwin-arm64"
      },
      {
        id: "cli-windows-x64",
        bunTarget: "bun-windows-x64-baseline",
        outfile: ".release/artifacts/ts-release-0.0.3-windows-x64.exe"
      }
    ])
  })

  test("refuses to prepare unsafe artifact directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-artifacts-root-"))
    try {
      const accepted = await runScriptEffect(assertSafeReleaseArtifactsDirectory(root))
      expect(accepted).toBe(resolve(root, ".release", "artifacts"))
      expect(await runScriptEffect(assertSafeReleaseArtifactsDirectory(root, ".release/artifacts"))).toBe(accepted)

      const outside = await runScriptFailure(assertSafeReleaseArtifactsDirectory(root, resolve(root, "..", "outside")))
      expect(outside).toBeInstanceOf(UnsafeReleaseArtifactsPathError)

      const parent = await runScriptFailure(assertSafeReleaseArtifactsDirectory(root, ".release"))
      expect(parent).toBeInstanceOf(UnsafeReleaseArtifactsPathError)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
