import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import { Bundle, Content, File } from "@mannyc1/ts-release/bundle"
import { decodeJson } from "@mannyc1/ts-release/http"
import { definitions, NoProvenance, publish, TokenAuthorization } from "@mannyc1/ts-release-npm"

const accepted = [
  ' \t\r\n{"integer":9007199254740991,"negative":-9007199254740991,"values":[true,false,null,0]} ',
  String.raw`{"escaped":"\"\\\/\b\f\n\r\t\u00e9","pair":"\ud83d\ude00"}`,
  '{"literal":"é😀"}',
  '{"same":1,"nested":{"same":2}}',
  "[".repeat(128) + "0" + "]".repeat(128),
]
const rejected = [
  '{"same":1,"same":2}',
  String.raw`{"same":1,"\u0073ame":2}`,
  String.raw`"e\u0301"`,
  String.raw`"\ud800"`,
  String.raw`"\udc00"`,
  '"\ud800"',
  '"\udc00"',
  "9007199254740992",
  "-9007199254740992",
  "-0",
  "0.1",
  "1e2",
  "01",
  "+1",
  "NaN",
  "Infinity",
  "",
  "true false",
  "[1,]",
  '{"a":1,}',
  '{"a" 1}',
  "{a:1}",
  "[1 2]",
  "[]]",
  '"unterminated',
  '"control\u0000"',
  String.raw`"\x00"`,
  String.raw`"\u123"`,
  String.raw`"\u12x4"`,
  '"trailing\\',
  "\u00a0null",
  "[".repeat(129) + "0" + "]".repeat(129),
]
for (const text of accepted)
  for (const input of [text, new TextEncoder().encode(text)])
    assert.deepEqual(decodeJson(input), JSON.parse(text))
for (const text of rejected) assert.throws(() => decodeJson(text), { name: "ReleaseError" })
assert.throws(() => decodeJson(new Uint8Array([0xff])))

// A long string must follow the same lexical and Unicode rules as a short one.
const long = "a".repeat(18 * 1024 * 1024)
assert.equal(decodeJson(JSON.stringify(long)), long)
const escaped = String.raw`\"\\\/\b\f\n\r\t\u00e9`.repeat(400_000)
assert.equal(decodeJson(`"${escaped}"`), JSON.parse(`"${escaped}"`))
for (const suffix of [String.raw`\x00"`, String.raw`\u123"`, String.raw`\ud800"`, '\u0001"', "\\"])
  assert.throws(() => decodeJson(`"${long}${suffix}`), { name: "ReleaseError" })
assert.throws(() => decodeJson(`{"data":"${long}","data":null}`), { name: "ReleaseError" })

// Exercise the exported provider's exact request-ownership boundary with an
// actual archive, not a JSON-shaped substitute for a publication request.
const directory = mkdtempSync(join(tmpdir(), "npm-large-body-"))
try {
  const name = "@fixture/large-native-body",
    version = "1.2.3"
  writeFileSync(join(directory, "package.json"), JSON.stringify({ name, version }))
  writeFileSync(join(directory, "payload.bin"), randomBytes(14 * 1024 * 1024))
  execFileSync(process.argv[2], ["pm", "pack", "--ignore-scripts", "--filename", "artifact.tgz"], {
    cwd: directory,
    stdio: "pipe",
  })
  const bytes = readFileSync(join(directory, "artifact.tgz"))
  const file = Schema.decodeUnknownSync(File)({
    _tag: "OwnedFile",
    logicalName: "package.tgz",
    content: new Content({
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
    deliveryMode: 0o644,
    executable: null,
    producedBy: { name: "fixture/native-bun-pack", version: "fixture" },
  })
  const providers = definitions({
    bundle: new Bundle({ format: "ts-release/bundle/2", artifacts: [file] }),
    readContent: () => Effect.succeed(bytes),
    read: () => Effect.die("request admission must not read the registry"),
  })
  const operation = await Effect.runPromise(
    publish({
      registry: "https://registry.npmjs.org/",
      name,
      version,
      initialTag: "latest",
      access: "public",
      tarball: file,
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      shasum: createHash("sha1").update(bytes).digest("hex"),
      authorization: new TokenAuthorization({ principal: "fixture-publisher" }),
      provenance: new NoProvenance({}),
    }),
  )
  const provider = providers[0]
  const request = await Effect.runPromise(
    provider.prepare(operation, {
      own: { operation, receipts: [], observations: [] },
      dependencies: [],
    }),
  )
  assert.ok(request.body.length > 18 * 1024 * 1024)
  assert.equal(provider.ownsRequest(request), true)
  const document = decodeJson(request.body)
  assert.deepEqual(
    Buffer.from(document._attachments[`${name}-${version}.tgz`].data, "base64"),
    bytes,
  )
  document._attachments[`${name}-${version}.tgz`].data = "AAAA"
  const changed = new TextEncoder().encode(JSON.stringify(document))
  assert.equal(
    provider.ownsRequest({
      facts: {
        ...request.facts,
        bodyDigest: createHash("sha256").update(changed).digest("hex"),
        byteLength: String(changed.length),
      },
      body: changed,
    }),
    false,
  )
  console.log(JSON.stringify({ admitted: true, rejectsMutation: true, bytes: request.body.length }))
} finally {
  rmSync(directory, { recursive: true, force: true })
}
