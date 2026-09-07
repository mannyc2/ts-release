import { expect, test } from "bun:test"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
import { gzipSync, gunzipSync } from "node:zlib"
import { Effect, Schema } from "effect"
import { File, Content } from "@mannyc1/ts-release/bundle"
import {
  PublicPackage,
  PrivatePackage,
  PublishIntent,
  TokenAuthorization,
  NoProvenance,
  author,
  DistTagIntent,
  publish,
} from "../../../packages/npm/src/index.js"
import { parseJson, readManifest } from "../../../packages/npm/src/Native.js"

import { pack, artifact, intent } from "./fixtures.js"

test("npm reads the actual Bun tarball package manifest and rejects changed native bytes", () => {
  const bytes = pack({
    name: "@fixture/example",
    version: "1.2.3",
    description: "Native metadata",
    files: ["index.js"],
  })
  expect(readManifest(bytes)).toEqual({
    name: "@fixture/example",
    version: "1.2.3",
    description: "Native metadata",
    files: ["index.js"],
  })
  const tar = new Uint8Array(gunzipSync(bytes))
  tar[1] = tar[1]! ^ 1
  expect(() => readManifest(gzipSync(tar))).toThrow("checksum")
  expect(() => readManifest(bytes.subarray(0, bytes.length - 12))).toThrow()
})

test("npm native JSON rejects duplicate keys, ambiguous numbers and trailing input", () => {
  for (const text of [
    '{"name":"a","name":"b"}',
    '{"n":9007199254740993}',
    '{"n":1.0}',
    '{"n":1e3}',
    '{"n":-0}',
    '{"a":1,}',
    "[1,]",
    "{}true",
    '{"s":"e\\u0301"}',
    '{"s":"\\ud800"}',
  ])
    expect(() => parseJson(new TextEncoder().encode(text))).toThrow()
  expect(
    parseJson(new TextEncoder().encode(' {"a":[null,true,false,1,"x\\\"y"],"__proto__":{"x":1}} ')),
  ).toEqual(JSON.parse('{"a":[null,true,false,1,"x\\\"y"],"__proto__":{"x":1}}'))
})

test("npm three public workspaces remain three coordinates and private omission is structural", async () => {
  const a = intent("@fixture/a"),
    b = intent("@fixture/b"),
    c = intent("@fixture/c")
  const all = await Effect.runPromise(
    author({
      packages: [a, b, c].map((publication) => new PublicPackage({ publication })),
      tagMoves: [],
    }),
  )
  expect(all.operations).toHaveLength(3)
  expect(new Set(all.operations.map((op) => op.operationId)).size).toBe(3)
  expect(all.omittedPrivate).toEqual([])
  const privateC = new PrivatePackage({ name: c.name, version: c.version, tarball: c.tarball })
  const mixed = await Effect.runPromise(
    author({
      packages: [
        new PublicPackage({ publication: a }),
        new PublicPackage({ publication: b }),
        privateC,
      ],
      tagMoves: [],
    }),
  )
  expect(mixed.operations).toHaveLength(2)
  expect(
    mixed.operations.every((operation) => (operation.intent as PublishIntent).name !== c.name),
  ).toBe(true)
  expect(mixed.omittedPrivate.map((item) => item.name)).toEqual([c.name])
})

test("npm tag movement derives its publication dependency; unsafe authoring rejects before execution", async () => {
  const publication = intent()
  const move = new DistTagIntent({
    registry: publication.registry,
    name: publication.name,
    version: publication.version,
    tag: "stable",
    authorization: publication.authorization,
  })
  const result = await Effect.runPromise(
    author({ packages: [new PublicPackage({ publication })], tagMoves: [move] }),
  )
  expect(result.operations[1]?.dependsOn).toEqual([result.operations[0]!.operationId])
  await expect(
    Effect.runPromise(publish(intent("@fixture/example", "1.3.0-beta.1"))),
  ).rejects.toThrow()
  const next = await Effect.runPromise(publish(intent("@fixture/example", "1.3.0-beta.1", "next")))
  expect(next.definitionId).toBe("npm.publish")
  await expect(
    Effect.runPromise(
      publish({ ...publication, access: "restricted" } as unknown as PublishIntent),
    ),
  ).rejects.toThrow()
})
