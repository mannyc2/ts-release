import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { inspect } from "../../../packages/pypi/src/Metadata.js"
import { multipart } from "../../../packages/pypi/src/Wire.js"
import { fixture } from "./fixtures.js"

test("all four Python-built distributions reproduce native Twine multipart fields and exact file bytes", async () => {
  const { intents, contents } = await fixture()
  const oracle = await Bun.file(join(import.meta.dir, "fixtures/native-oracle.json")).json()
  expect(oracle.requests).toHaveLength(4)
  for (const intent of intents) {
    const native = oracle.requests.find(
      (row: { filename: string }) => row.filename === intent.filename,
    )
    const encoded = multipart(intent, contents.get(intent.distribution.content.sha256)!)
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
    expect(fields(forms[1]!)).toEqual(fields(forms[0]!))
    for (const form of forms) {
      const file = form.get("content") as File
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
  const oracle = await Bun.file(join(import.meta.dir, "fixtures/metadata-oracle.json")).json()
  expect(oracle.packages).toEqual({ twine: "7.0.0", packaging: "26.3" })
  for (const row of oracle.cases) {
    const bytes = Buffer.from(row.archiveBase64, "base64")
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(row.sha256)
    if (!row.accepted) expect(() => inspect(oracle.filename, bytes), row.case).toThrow()
    else {
      const result = inspect(oracle.filename, bytes)
      const fields = row.fields.filter(
        ([key]: [string]) =>
          !["pyversion", "filetype", "sha256_digest", "blake2_256_digest"].includes(key),
      )
      expect([...result.fields].sort(), row.case).toEqual(fields.sort())
    }
  }
})
