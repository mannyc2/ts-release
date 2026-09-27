import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { ProvenanceSource, makeSigstoreVerifier } from "@mannyc1/ts-release-npm"
const [fixturePath, sourcePath, rootPath, cachePath, resultPath] = process.argv.slice(2)
const fixture = JSON.parse(await readFile(fixturePath, "utf8"))
const bundle = fixture.attestations.find(
  (entry) => entry.predicateType === "https://slsa.dev/provenance/v1",
).bundle
const source = new ProvenanceSource(JSON.parse(await readFile(sourcePath, "utf8")))
const verify = makeSigstoreVerifier({
  tufRootPath: rootPath,
  tufCachePath: cachePath,
  timeoutMilliseconds: 20000,
})
const encode = (value) => new TextEncoder().encode(JSON.stringify(value))
await Effect.runPromise(verify({ source, bundleBytes: encode(bundle) }))
const controls = []
for (const [name, change] of [
  [
    "signature",
    (value) => {
      value.dsseEnvelope.signatures[0].sig = "AA=="
    },
  ],
  [
    "certificate",
    (value) => {
      value.verificationMaterial.certificate.rawBytes = "AA=="
    },
  ],
  [
    "native-merkle-proof",
    (value) => {
      value.verificationMaterial.tlogEntries[0].inclusionProof.hashes[0] =
        Buffer.alloc(32).toString("base64")
    },
  ],
]) {
  const changed = structuredClone(bundle)
  change(changed)
  await assert.rejects(Effect.runPromise(verify({ source, bundleBytes: encode(changed) })))
  controls.push(name)
}
await assert.rejects(
  Effect.runPromise(
    verify({
      source: new ProvenanceSource({ ...source, repository: "other/repository" }),
      bundleBytes: encode(bundle),
    }),
  ),
)
controls.push("statement-source-admission")
// Native settlement has its own isolated instrumentation and fresh cache. This
// watchdog bounds a failed fixture; it is not interruption timing evidence.
await promisify(execFile)(
  process.execPath,
  [
    fileURLToPath(new URL("./native-sigstore-lifecycle.mjs", import.meta.url)),
    fixturePath,
    sourcePath,
    rootPath,
    `${cachePath}-settlement`,
  ],
  { timeout: 60000, killSignal: "SIGKILL" },
)
await writeFile(
  resultPath,
  JSON.stringify({ runtime: process.version, verified: true, rejectedControls: controls }) + "\n",
)
