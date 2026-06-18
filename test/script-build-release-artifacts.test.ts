import { describe, expect, test } from "bun:test"
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
} from "../scripts/build-release-artifacts.js"

describe("build release artifacts script", () => {
  test("derives package artifact names from scoped package identity", () => {
    const identity = {
      name: "@mannyc1/ts-release",
      version: "0.0.2"
    }

    expect(packageArtifactPrefix(identity)).toBe("mannyc1-ts-release-0.0.2")
    expect(packageTarballArtifactPath(identity)).toBe(".release/artifacts/mannyc1-ts-release-0.0.2.tgz")
  })

  test("defines the standalone CLI target matrix", () => {
    expect(releaseCliArtifactTargets("0.0.2")).toEqual([
      {
        id: "cli-linux-x64",
        bunTarget: "bun-linux-x64-baseline",
        outfile: ".release/artifacts/ts-release-0.0.2-linux-x64"
      },
      {
        id: "cli-linux-arm64",
        bunTarget: "bun-linux-arm64",
        outfile: ".release/artifacts/ts-release-0.0.2-linux-arm64"
      },
      {
        id: "cli-darwin-x64",
        bunTarget: "bun-darwin-x64",
        outfile: ".release/artifacts/ts-release-0.0.2-darwin-x64"
      },
      {
        id: "cli-darwin-arm64",
        bunTarget: "bun-darwin-arm64",
        outfile: ".release/artifacts/ts-release-0.0.2-darwin-arm64"
      },
      {
        id: "cli-windows-x64",
        bunTarget: "bun-windows-x64-baseline",
        outfile: ".release/artifacts/ts-release-0.0.2-windows-x64.exe"
      }
    ])
  })

  test("refuses to prepare unsafe artifact directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-artifacts-root-"))
    try {
      const accepted = await Effect.runPromise(assertSafeReleaseArtifactsDirectory(root))
      expect(accepted).toBe(resolve(root, ".release", "artifacts"))

      const outside = await Effect.runPromise(
        assertSafeReleaseArtifactsDirectory(root, resolve(root, "..", "outside")).pipe(Effect.flip)
      )
      expect(outside).toBeInstanceOf(UnsafeReleaseArtifactsPathError)

      const parent = await Effect.runPromise(
        assertSafeReleaseArtifactsDirectory(root, ".release").pipe(Effect.flip)
      )
      expect(parent).toBeInstanceOf(UnsafeReleaseArtifactsPathError)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
