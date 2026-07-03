import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeArtifactStagerLayer } from "../apps/release-ts/src/runtime.js"
import { parseReleaseIntent } from "../src/config/load.js"
import { stageArtifactOperations } from "../src/engine/stager.js"
import { pypiWheelPipe } from "../src/pipes/pypi-wheel.js"
import { StageArtifactOperation } from "../src/pipeline/operation.js"
import { emptyReleaseState, ReleaseIdentity } from "../src/pipeline/state.js"

const identity = ReleaseIdentity.make({
  name: "@mannyc1/ts-release",
  normalizedName: "mannyc1-ts-release",
  version: "1.2.3",
  commit: "abc123",
  shortCommit: "abc123",
  tag: "v1.2.3",
  versionSource: "config",
  snapshot: false
})

const isStageArtifactOperation = (operation: unknown): operation is StageArtifactOperation =>
  typeof operation === "object"
  && operation !== null
  && "_tag" in operation
  && operation._tag === "StageArtifactOperation"

describe("PyPI wheel build pipe", () => {
  test("builds a platform wheel that embeds one staged CLI binary", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-pypi-wheel-pipe-"))
    try {
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "ts-release-1.2.3-linux-x64"), "linux binary\n")

      const results = await Effect.runPromise(
        Effect.gen(function*() {
          const intent = yield* parseReleaseIntent(JSON.stringify({
            project: {
              name: "@mannyc1/ts-release",
              version: "1.2.3",
              commit: "abc123",
              tag: "v1.2.3"
            },
            pypiWheel: {
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
            },
            publish: {}
          }))
          const section = pypiWheelPipe.section(intent)
          expect(section).toBeDefined()
          if (section === undefined) {
            return []
          }
          const contribution = yield* pypiWheelPipe.plan(section, emptyReleaseState(identity, true))
          expect(contribution.artifacts[0]).toMatchObject({
            id: "pypi-wheel-linux-x64",
            kind: "wheel",
            path: "dist/ts_release-1.2.3-py3-none-manylinux2014_x86_64.whl",
            producedBy: "build:pypi-wheel"
          })
          const operations = contribution.operations.filter(isStageArtifactOperation)
          return yield* stageArtifactOperations(operations, {
            root,
            identity
          })
        }).pipe(Effect.provide(Layer.mergeAll(
          makeArtifactStagerLayer(),
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
