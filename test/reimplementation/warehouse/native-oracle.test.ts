import { fail } from "node:assert"
import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import oracle from "./fixtures/native-oracle.json" with { type: "json" }
import metadataOracle from "./fixtures/metadata-oracle.json" with { type: "json" }
import { inspect } from "../../../packages/pypi/src/Metadata.js"
import { multipart } from "../../../packages/pypi/src/Wire.js"
import { fixture } from "./fixtures.js"

test("all four Python-built distributions reproduce native Twine multipart fields and exact file bytes", async () => {
  const { intents, contents } = await fixture()
  expect(oracle.requests).toHaveLength(4)
  for (const intent of intents) {
    const native =
      oracle.requests.find((row) => row.filename === intent.filename) ??
      fail("Missing native request for distribution")
    const encoded = multipart(
      intent,
      contents.get(intent.distribution.content.sha256) ??
        fail("Missing fixture contents.get(intent.distribution.content.sha256)"),
    )
    const original = Buffer.from(native.bodyBase64, "base64")
    expect(createHash("sha256").update(original).digest("hex")).toBe(native.bodySha256)
    const forms = await Promise.all([
      new Response(original, { headers: native.headers }).formData(),
      new Response(encoded.body, { headers: Object.fromEntries(encoded.headers) }).formData(),
    ])
    const fields = (form: FormData) =>
      [...form.entries()]
        .filter(([key, value]) => key !== "blake2_256_digest" && typeof value === "string")
        .sort(([a, x], [b, y]) => `${a}:${x}`.localeCompare(`${b}:${y}`))
    expect(fields(forms[1] ?? fail("Missing fixture forms[1]"))).toEqual(
      fields(forms[0] ?? fail("Missing fixture forms[0]")),
    )
    for (const form of forms) {
      const file = form.get("content")
      if (!(file instanceof File)) fail("Missing native multipart file")
      expect(file.name).toBe(intent.filename)
      expect(
        createHash("sha256")
          .update(new Uint8Array(await file.arrayBuffer()))
          .digest("hex"),
      ).toBe(native.sha256)
    }
  }
})

test("metadata semantic admission matches native Twine positive and negative controls", async () => {
  const oracle = metadataOracle
  expect(oracle.packages).toEqual({ twine: "7.0.0", packaging: "26.3" })
  for (const row of oracle.cases) {
    const bytes = Buffer.from(row.archiveBase64, "base64")
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(row.sha256)
    if (!row.accepted) expect(() => inspect(oracle.filename, bytes), row.case).toThrow()
    else {
      const result = inspect(oracle.filename, bytes)
      const fields = (row.fields ?? fail("Missing accepted native fields"))
        .filter(
          ([key]) =>
            !["pyversion", "filetype", "sha256_digest", "blake2_256_digest"].includes(
              key ?? fail("Missing native field key"),
            ),
        )
        .map(
          ([key, value]) =>
            [key ?? fail("Missing field name"), value ?? fail("Missing field value")] as const,
        )
      expect(
        [...result.fields].sort((a, b) =>
          String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0,
        ),
        row.case,
      ).toEqual(fields.sort((a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0)))
    }
  }
})
