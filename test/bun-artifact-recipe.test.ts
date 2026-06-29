import { describe, expect, it, layer } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { stageAllArtifactRecipes } from "../src/artifacts/registry.js"
import { parseReleaseIntent } from "../src/config/load.js"
import { BunExecutableArtifactRecipe } from "../src/domain/artifact.js"
import { ReleaseIdentity } from "../src/domain/release.js"
import {
  BunExecutableBuildInput,
  makeBunArtifactRecipeRegistryLayer
} from "../apps/release-ts/src/runtime.js"

const identity = ReleaseIdentity.make({
  name: "release",
  version: "0.1.0",
  commit: "abc123",
  tag: "v0.1.0"
})

const recipe = BunExecutableArtifactRecipe.make({
  id: "release-cli",
  entrypoint: "src/cli.ts",
  minify: true,
  outputs: [
    {
      id: "cli-linux-x64",
      target: "bun-linux-x64-baseline",
      path: "dist/release-{version}-linux-x64",
      consumers: ["github"]
    },
    {
      id: "cli-darwin-arm64",
      target: "bun-darwin-arm64",
      path: "dist/release-{version}-darwin-arm64",
      consumers: ["github"]
    }
  ]
})

const stageRecipe = () =>
  stageAllArtifactRecipes([recipe], {
    root: "/workspace",
    identity,
    configPath: "release.config.json"
  })

describe("Bun executable artifact recipe adapter", () => {
  const calls: Array<BunExecutableBuildInput> = []
  const TestLayer = Layer.mergeAll(
    makeBunArtifactRecipeRegistryLayer(async (input) => {
      calls.push(input)
      return { success: true, logs: [] }
    }),
    BunServices.layer
  )

  layer(TestLayer)((it) => {
    it.effect("calls the injected builder for each output", () =>
      Effect.gen(function*() {
        calls.length = 0
        const results = yield* stageRecipe()

        expect(results).toHaveLength(1)
        expect(results[0]?.artifacts.map((artifact) => artifact.path)).toEqual([
          "dist/release-0.1.0-linux-x64",
          "dist/release-0.1.0-darwin-arm64"
        ])
        expect(calls).toEqual([
          {
            entrypoint: "/workspace/src/cli.ts",
            target: "bun-linux-x64-baseline",
            outfile: "/workspace/dist/release-0.1.0-linux-x64",
            minify: true
          },
          {
            entrypoint: "/workspace/src/cli.ts",
            target: "bun-darwin-arm64",
            outfile: "/workspace/dist/release-0.1.0-darwin-arm64",
            minify: true
          }
        ])
      }))

    it.effect("rejects unsafe paths before invoking the builder", () =>
      Effect.gen(function*() {
        calls.length = 0
        const unsafeRecipe = BunExecutableArtifactRecipe.make({
          id: "release-cli",
          entrypoint: "src/cli.ts",
          outputs: [
            {
              id: "cli-linux-x64",
              target: "bun-linux-x64-baseline",
              path: "../dist/release-linux-x64",
              consumers: ["github"]
            }
          ]
        })

        const error = yield* stageAllArtifactRecipes([unsafeRecipe], {
          root: "/workspace",
          identity,
          configPath: "release.config.json"
        }).pipe(Effect.flip)

        expect(error._tag).toBe("ArtifactRecipeStageError")
        if (error._tag === "ArtifactRecipeStageError") {
          expect(error.artifactId).toBe("cli-linux-x64")
          expect(error.path).toBe("../dist/release-linux-x64")
        }
        expect(calls).toHaveLength(0)
      }))
  })

  layer(Layer.mergeAll(
    makeBunArtifactRecipeRegistryLayer(async () => ({
      success: false,
      logs: ["compile failed"]
    })),
    BunServices.layer
  ))((it) => {
    it.effect("preserves Bun build log text on failed builds", () =>
      Effect.gen(function*() {
        const error = yield* stageRecipe().pipe(Effect.flip)

        expect(error._tag).toBe("ArtifactRecipeStageError")
        if (error._tag === "ArtifactRecipeStageError") {
          expect(error.recipeId).toBe("release-cli")
          expect(error.artifactId).toBe("cli-linux-x64")
          expect(error.reason).toBe("compile failed")
        }
      }))
  })

  const rejectedBuildCause = new Error("builder unavailable")
  layer(Layer.mergeAll(
    makeBunArtifactRecipeRegistryLayer(async () => {
      throw rejectedBuildCause
    }),
    BunServices.layer
  ))((it) => {
    it.effect("preserves rejected builder causes", () =>
      Effect.gen(function*() {
        const error = yield* stageRecipe().pipe(Effect.flip)

        expect(error._tag).toBe("ArtifactRecipeStageError")
        if (error._tag === "ArtifactRecipeStageError") {
          expect(error.cause).toBe(rejectedBuildCause)
          expect(error.reason).toBe("Bun.build rejected while compiling cli-linux-x64.")
        }
      }))
  })

  it.effect("accepts the self-release Bun compile target strings in config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(JSON.stringify({
        identity: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        artifacts: [],
        artifactRecipes: [
          {
            _tag: "BunExecutableArtifactRecipe",
            id: "release-cli",
            entrypoint: "src/cli.ts",
            outputs: [
              {
                id: "cli-linux-x64",
                target: "bun-linux-x64-baseline",
                path: "dist/release-linux-x64",
                consumers: ["github"]
              },
              {
                id: "cli-linux-arm64",
                target: "bun-linux-arm64",
                path: "dist/release-linux-arm64",
                consumers: ["github"]
              },
              {
                id: "cli-darwin-x64",
                target: "bun-darwin-x64",
                path: "dist/release-darwin-x64",
                consumers: ["github"]
              },
              {
                id: "cli-darwin-arm64",
                target: "bun-darwin-arm64",
                path: "dist/release-darwin-arm64",
                consumers: ["github"]
              },
              {
                id: "cli-windows-x64",
                target: "bun-windows-x64-baseline",
                path: "dist/release-windows-x64.exe",
                consumers: ["github"]
              }
            ]
          }
        ],
        targets: []
      }))

      expect(intent.artifactRecipes?.[0]?._tag).toBe("BunExecutableArtifactRecipe")
    }))
})
