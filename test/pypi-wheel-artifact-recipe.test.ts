import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { stageAllArtifactRecipes } from "../src/artifacts/registry.js"
import { PyPiWheelArtifactRecipe } from "../src/domain/artifact.js"
import { ReleaseIdentity } from "../src/domain/release.js"
import { makeBunArtifactRecipeRegistryLayer } from "../apps/release-ts/src/runtime.js"

const identity = ReleaseIdentity.make({
  name: "@mannyc1/ts-release",
  version: "1.2.3",
  commit: "abc123",
  tag: "v1.2.3"
})

describe("PyPI wheel artifact recipe adapter", () => {
  test("builds a platform wheel that embeds one staged CLI binary", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-pypi-wheel-recipe-"))
    try {
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "ts-release-1.2.3-linux-x64"), "linux binary\n")

      const recipe = PyPiWheelArtifactRecipe.make({
        id: "pypi-wheel-linux-x64",
        path: "dist/ts_release-{version}-py3-none-manylinux2014_x86_64.whl",
        wheelTag: "py3-none-manylinux2014_x86_64",
        packageName: "ts-release",
        moduleName: "ts_release",
        consoleScript: "ts-release",
        summary: "Portable artifact and package-manager distribution planning for TypeScript projects.",
        homepage: "https://github.com/mannyc2/ts-release",
        license: "MIT",
        requiresPython: ">=3.8",
        binaries: [
          {
            os: "linux",
            arch: "x64",
            sourcePath: "artifacts/ts-release-{version}-linux-x64",
            wheelPath: "ts_release/bin/ts-release-linux-x64"
          }
        ],
        consumers: ["pypi"]
      })

      const results = await Effect.runPromise(
        stageAllArtifactRecipes([recipe], {
          root,
          identity
        }).pipe(Effect.provide(Layer.mergeAll(
          makeBunArtifactRecipeRegistryLayer(),
          BunServices.layer
        )))
      )

      expect(results[0]?.artifacts[0]?.path).toBe("dist/ts_release-1.2.3-py3-none-manylinux2014_x86_64.whl")
      const wheelPath = join(root, "dist", "ts_release-1.2.3-py3-none-manylinux2014_x86_64.whl")
      expect(await Bun.file(wheelPath).exists()).toBe(true)
      const wheelText = await Bun.file(wheelPath).text()
      expect(wheelText).toContain("Root-Is-Purelib: false")
      expect(wheelText).toContain("Tag: py3-none-manylinux2014_x86_64")
      expect(wheelText).toContain("ts-release = ts_release.cli:main")
      expect(wheelText).toContain("ts_release/bin/ts-release-linux-x64")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
