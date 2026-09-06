import { strict as assert } from "node:assert"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { basename } from "node:path"
import { gzipSync, gunzipSync } from "node:zlib"

const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex")
export function readRecordText(path: string): string {
  const record = JSON.parse(readFileSync(path, "utf8")), artifact = record.artifact
  assert.equal(record.format, "architecture-record/1")
  assert.equal(artifact.path, `${basename(path)}.gz`)
  const compressed = readFileSync(`${path}.gz`)
  assert.equal(compressed.length, artifact.compressedBytes); assert.equal(sha256(compressed), artifact.compressedSha256)
  const expanded = gunzipSync(compressed)
  assert.equal(expanded.length, artifact.expandedBytes); assert.equal(sha256(expanded), artifact.expandedSha256)
  const text = expanded.toString("utf8"); assert.equal(JSON.parse(text).format, record.recordFormat)
  return text
}
export const readRecords = <T = any>(path: string): T => JSON.parse(readRecordText(path))
export function writeRecords(path: string, text: string, summary: unknown, check = false): void {
  if (check) {
    assert.equal(readRecordText(path), text, `Expanded record differs: ${path}`)
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")).summary, summary, `Summary differs: ${path}`)
    return
  }
  const expanded = Buffer.from(text), compressed = gzipSync(expanded, {level: 9})
  const record = {format: "architecture-record/1", recordFormat: JSON.parse(text).format, summary, artifact: {path: `${basename(path)}.gz`, compressedBytes: compressed.length, compressedSha256: sha256(compressed), expandedBytes: expanded.length, expandedSha256: sha256(expanded)}}
  writeFileSync(`${path}.gz`, compressed); writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`)
}
if (import.meta.main) {
  const path = process.argv[2]; assert(path, "Usage: bun records.ts <summary.json> [--check]")
  const text = readRecordText(path)
  if (process.argv.includes("--check")) console.log(`Verified compressed and expanded bytes: ${path}`)
  else await Bun.write(Bun.stdout, text)
}
