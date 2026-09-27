import { fail } from "node:assert"
import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { Effect, Schema } from "effect"
import oracle from "./fixtures/native-oracle.json" with { type: "json" }
import { join } from "node:path"
import type { ProviderContext } from "@mannyc1/ts-release"
import { definitions, publish, distTag } from "@mannyc1/ts-release-npm"
import { accessFor } from "./fixtures.js"

// Independent whole-document comparison; never derive expected hashes, fields or
// attachments through the provider's helpers. The golden was emitted by npm.
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, entry]) => [key, stable(entry)]),
        )
      : value
test("source-bound official npm transcript matches the full native PUT and exact tag bytes", async () => {
  const directory = join(import.meta.dir, "fixtures")
  const bytes = new Uint8Array(await Bun.file(join(directory, "native-package.tgz")).arrayBuffer())
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(oracle.tarballSha256)
  expect(
    createHash("sha256")
      .update(await Bun.file(join(directory, "native-manifest.json")).bytes())
      .digest("hex"),
  ).toBe(oracle.manifestSha256)
  const { access, publication } = accessFor(bytes)
  const native = Schema.decodeUnknownSync(
    Schema.StructWithRest(
      Schema.Struct({
        versions: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  )(JSON.parse((oracle.requests[0] ?? fail("Missing native publish request")).body))
  const version = native.versions["1.2.3"] ?? fail("Missing native version")
  // npm's ambient runtime annotation is deliberately not added by this provider.
  expect(version._nodeVersion).toBe(oracle.nodeVersion)
  const { _nodeVersion, ...versionWithoutRuntime } = version
  const withoutRuntime = {
    ...native,
    versions: { ...native.versions, "1.2.3": versionWithoutRuntime },
  }
  const providers = definitions({ ...access, read: () => Effect.die("oracle must not read") })
  const operations = [
    await Effect.runPromise(publish(publication)),
    await Effect.runPromise(
      distTag({
        registry: publication.registry,
        name: publication.name,
        version: publication.version,
        authorization: publication.authorization,
        tag: "next",
      }),
    ),
  ]
  for (const [index, operation] of operations.entries()) {
    const context: ProviderContext = {
      own: { operation, receipts: [], observations: [] },
      dependencies: [],
    }
    const request = await Effect.runPromise(
      (providers[index] ?? fail("Missing fixture providers[index]")).prepare(operation, context),
    )
    const expected = oracle.requests[index] ?? fail("Missing native request")
    expect(request.facts.method).toBe(expected.method)
    expect(request.facts.endpoint).toBe(expected.endpoint)
    if (index === 0)
      expect(JSON.stringify(stable(JSON.parse(new TextDecoder().decode(request.body))))).toBe(
        JSON.stringify(stable(withoutRuntime)),
      )
    else expect(Buffer.from(request.body)).toEqual(Buffer.from(expected.body))
  }
})
