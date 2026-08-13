import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeReleaseApi } from "../../src/index.js"
import { zip } from "../../src/drivers/archive.js"
import type { RunCommand } from "../../src/drivers/process.js"
import { encodeCanonicalJson } from "../../src/model/canonical.js"
import { makeLocalPreparedReleaseStore } from "../../src/release/prepared-store.js"
import { runtimeLayer } from "./runtime-fixture.js"

const cardinality = (count: number) => ({
  kind: "bounded" as const,
  minimum: count,
  maximum: count
})

const config = (input: {
  readonly count: number
  readonly artifactKind?: "archive" | "digest" | "executable"
  readonly pathSuffix?: ".zip" | ".sha256" | ".bin"
  readonly mediaType?: "application/zip" | "text/plain" | "application/octet-stream"
  readonly selectedMediaType?: "application/zip" | "application/gzip" | "text/plain" | "application/octet-stream"
}) => {
  const artifactKind = input.artifactKind ?? "archive"
  const pathSuffix = input.pathSuffix ?? ".zip"
  const mediaType = input.mediaType ?? "application/zip"
  const expected = cardinality(input.count)
  return {
    project: {
      name: "fixture",
      version: "1.0.0",
      tag: "v1.0.0",
      repository: "owner/fixture"
    },
    preparations: [{
      kind: "artifact" as const,
      id: "generated-assets",
      run: ["generate-collection", "{collection:generated-assets}"],
      collection: {
        root: ".release/generated-assets",
        artifactKind,
        pathSuffix,
        mediaType,
        cardinality: expected
      }
    }],
    publish: {
      github: {
        repository: "owner/fixture",
        ids: [],
        collections: [{
          collection: "generated-assets",
          artifactKind,
          pathSuffix,
          mediaType: input.selectedMediaType ?? mediaType,
          cardinality: expected
        }]
      }
    }
  }
}

const workspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-collection-"))
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }))
  return root
}

const archive = (name: string): Uint8Array => zip([{
  path: "payload.txt",
  data: new TextEncoder().encode(`${name}\n`),
  mode: 0o100644
}])

const archiveRun = (
  names: ReadonlyArray<string>,
  customize?: (root: string) => void
): RunCommand => ({ argv, cwd, environmentNames, network }) => Effect.sync(() => {
  expect(argv.slice(0, 2)).toEqual(["generate-collection", ".release/generated-assets"])
  expect(environmentNames).toEqual([])
  expect(network).toBe("deny")
  const root = join(cwd, argv[1]!)
  mkdirSync(root, { recursive: true })
  for (const name of names) {
    const path = join(root, name)
    mkdirSync(join(path, ".."), { recursive: true })
    writeFileSync(path, archive(name))
  }
  customize?.(root)
  return { exitCode: 0, stdout: "", stderr: "" }
})

describe("runtime artifact collections", () => {
  test("root API links, captures, publishes, stores, and reloads stable collection members", async () => {
    const root = workspace()
    const store = makeLocalPreparedReleaseStore(join(root, "prepared-store"))
    const run = archiveRun(["nested/b.zip", "a.zip"])
    const api = makeReleaseApi(runtimeLayer(undefined, store, run))
    try {
      const graphInspection = await api.inspect({ config: config({ count: 2 }), workspace: root })
      expect(("collections" in graphInspection ? graphInspection.collections : []).map((collection) => ({
        id: collection.id.toString(),
        producer: collection.producer.toString(),
        root: collection.root.toString()
      }))).toEqual([{ id: "generated-assets", producer: "preparation:generated-assets", root: ".release/generated-assets" }])

      const first = await api.prepare({ config: config({ count: 2 }), workspace: root })
      const second = await api.prepare({ config: config({ count: 2 }), workspace: root })
      expect(second).toEqual(first)

      const bundle = await Effect.runPromise(store.load(first))
      const collection = bundle.manifest.collections[0]!
      expect(collection.contract).toMatchObject({
        id: "generated-assets",
        producer: "preparation:generated-assets",
        root: ".release/generated-assets",
        artifactKind: "archive",
        pathSuffix: ".zip",
        mediaType: "application/zip",
        cardinality: { kind: "bounded", minimum: 2, maximum: 2 }
      })
      expect(collection.members.map((member) => member.key.toString())).toEqual([
        "a.zip",
        "nested/b.zip"
      ])
      const memberIds = collection.members.map((member) => member.artifactId.toString())
      expect(memberIds.every((id) => /^collection-sha256-[a-f0-9]{64}$/u.test(id))).toBe(true)
      expect([...bundle.blobs.keys()].sort()).toEqual([...memberIds].sort())
      const github = bundle.manifest.publications.find((publication) =>
        publication._tag === "PreparedGitHubPublication")
      expect(github?._tag).toBe("PreparedGitHubPublication")
      if (github?._tag === "PreparedGitHubPublication") {
        expect(github.assets.map((asset) => asset.name.toString())).toEqual(["a.zip", "b.zip"])
        expect(github.assets.map((asset) => asset.artifactId.toString())).toEqual(memberIds)
      }

      await api.dispose()
      const retryApi = makeReleaseApi(runtimeLayer(undefined, store, () =>
        Effect.die("Reload must not recompile or rerun the collection producer.")))
      try {
        const reloaded = await retryApi.inspect({ prepared: first })
        expect("collections" in reloaded ? reloaded.collections[0] : undefined).toMatchObject({
          id: "generated-assets",
          producer: "preparation:generated-assets",
          root: ".release/generated-assets",
          members: [
            { key: "a.zip", artifactId: memberIds[0] },
            { key: "nested/b.zip", artifactId: memberIds[1] }
          ]
        })
      } finally {
        await retryApi.dispose()
      }

      const manifestPath = join(bundle.directory, "prepared-release.json")
      const tampered = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        collections: Array<{ members: Array<{ artifactId: string }> }>
      }
      tampered.collections[0]!.members[0]!.artifactId = tampered.collections[0]!.members[1]!.artifactId
      chmodSync(manifestPath, 0o600)
      writeFileSync(manifestPath, encodeCanonicalJson(tampered))
      await Effect.runPromise(store.load(first)).then(
        () => { throw new Error("Expected tampered durable collection membership to fail reload.") },
        (error: unknown) => {
          expect(error).toMatchObject({ _tag: "PreparedStoreError" })
          expect((error as { readonly reason: string }).reason).toContain("invalid stable artifact id")
        }
      )
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test.each([0, 1, 3])("captures a deterministic collection with %i members", async (count) => {
    const root = workspace()
    const store = makeLocalPreparedReleaseStore(join(root, "prepared-store"))
    const names = Array.from({ length: count }, (_, index) => `member-${index}.zip`)
    const api = makeReleaseApi(runtimeLayer(undefined, store, archiveRun(names)))
    try {
      const prepared = await api.prepare({ config: config({ count }), workspace: root })
      const bundle = await Effect.runPromise(store.load(prepared))
      expect(bundle.manifest.collections[0]?.members).toHaveLength(count)
      expect(bundle.manifest.artifacts).toHaveLength(count)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("rejects a mismatched downstream selector before running the producer", async () => {
    const root = workspace()
    let runs = 0
    const run: RunCommand = () => Effect.sync(() => {
      runs += 1
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    const api = makeReleaseApi(runtimeLayer(
      undefined,
      makeLocalPreparedReleaseStore(join(root, "prepared-store")),
      run
    ))
    try {
      await expect(api.prepare({
        config: config({ count: 1, selectedMediaType: "application/gzip" }),
        workspace: root
      })).rejects.toMatchObject({
        _tag: "ReleaseInputError",
        reason: expect.stringContaining("must exactly match")
      })
      expect(runs).toBe(0)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("rejects cardinality, normalization, symlink, suffix, and archive-byte violations", async () => {
    const cases: ReadonlyArray<{
      readonly name: string
      readonly count: number
      readonly run: RunCommand
      readonly cause: string
    }> = [
      {
        name: "cardinality",
        count: 2,
        run: archiveRun(["only.zip"]),
        cause: "discovered 1 members outside its declared cardinality"
      },
      {
        name: "portable case collision",
        count: 2,
        run: archiveRun(["A.zip", "a.zip"]),
        cause: "collide under portable case folding"
      },
      {
        name: "unsafe path",
        count: 1,
        run: archiveRun(["bad\\name.zip"]),
        cause: "not portable ASCII POSIX form"
      },
      {
        name: "symlink",
        count: 2,
        run: archiveRun(["target.zip"], (collectionRoot) => {
          symlinkSync("target.zip", join(collectionRoot, "alias.zip"))
        }),
        cause: "forbidden symlink"
      },
      {
        name: "suffix",
        count: 1,
        run: archiveRun(["wrong.txt"]),
        cause: "does not match declared pathSuffix .zip"
      },
      {
        name: "archive bytes",
        count: 1,
        run: archiveRun([], (collectionRoot) => {
          writeFileSync(join(collectionRoot, "not-an-archive.zip"), "plain text")
        }),
        cause: "does not have a ZIP file signature"
      }
    ]

    for (const fixture of cases) {
      const root = workspace()
      const api = makeReleaseApi(runtimeLayer(
        undefined,
        makeLocalPreparedReleaseStore(join(root, "prepared-store")),
        fixture.run
      ))
      try {
        await api.prepare({ config: config({ count: fixture.count }), workspace: root }).then(
          () => { throw new Error(`Expected ${fixture.name} collection capture to fail.`) },
          (error: unknown) => {
            expect(error).toMatchObject({ _tag: "ReleasePreparationError" })
            expect((error as { readonly cause: string }).cause).toContain(fixture.cause)
          }
        )
      } finally {
        await api.dispose()
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  test("validates declared digest bytes and executable mode", async () => {
    const cases: ReadonlyArray<{
      readonly name: string
      readonly authored: ReturnType<typeof config>
      readonly run: RunCommand
      readonly cause: string
    }> = [
      {
        name: "digest bytes",
        authored: config({ count: 1, artifactKind: "digest", pathSuffix: ".sha256", mediaType: "text/plain" }),
        run: ({ argv, cwd }) => Effect.sync(() => {
          const root = join(cwd, argv[1]!)
          mkdirSync(root, { recursive: true })
          writeFileSync(join(root, "checksums.sha256"), "not-a-canonical-checksum\n")
          return { exitCode: 0, stdout: "", stderr: "" }
        }),
        cause: "does not contain canonical 64-hex checksum rows"
      },
      {
        name: "executable mode",
        authored: config({ count: 1, artifactKind: "executable", pathSuffix: ".bin", mediaType: "application/octet-stream" }),
        run: ({ argv, cwd }) => Effect.sync(() => {
          const root = join(cwd, argv[1]!)
          mkdirSync(root, { recursive: true })
          const path = join(root, "tool.bin")
          writeFileSync(path, "#!/bin/sh\n")
          chmodSync(path, 0o644)
          return { exitCode: 0, stdout: "", stderr: "" }
        }),
        cause: "does not match declared kind executable"
      }
    ]

    for (const fixture of cases) {
      const root = workspace()
      const api = makeReleaseApi(runtimeLayer(
        undefined,
        makeLocalPreparedReleaseStore(join(root, "prepared-store")),
        fixture.run
      ))
      try {
        await expect(api.prepare({ config: fixture.authored, workspace: root })).rejects.toMatchObject({
          _tag: "ReleasePreparationError",
          cause: expect.stringContaining(fixture.cause)
        })
      } finally {
        await api.dispose()
        rmSync(root, { recursive: true, force: true })
      }
    }
  })
})
