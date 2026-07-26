import {
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const prePath = join(
  root,
  "derived",
  "candidate-validation-pre-normalization.jsonl"
)
const v1Path = join(
  root,
  "evidence",
  "invalid-validation-normalization-v1.jsonl"
)
const finalPath = join(root, "derived", "candidate-validation.jsonl")
const deltaPath = join(
  root,
  "evidence",
  "validation-normalization-v1-delta.jsonl"
)
const markerPath = join(
  root,
  "evidence",
  "superseded-validation-compaction.json"
)
const lines = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")

const v1Bytes = readFileSync(v1Path)
const preBytes = readFileSync(prePath)
const finalBytes = readFileSync(finalPath)
const final = new Map(
  finalBytes
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((row) => [`${row.repo}:${row.path}`, row])
)
const delta: Array<any> = []
for (const row of lines(v1Path)) {
  const after = final.get(`${row.repo}:${row.path}`)
  if (!after) throw new Error(`Missing final row ${row.repo}:${row.path}`)
  if (
    row.eligible !== after.eligible ||
    row.exclusion !== after.exclusion ||
    JSON.stringify(row.extraction.invocations) !==
      JSON.stringify(after.extraction.invocations)
  ) {
    delta.push({
      repo: row.repo,
      path: row.path,
      before: {
        eligible: row.eligible,
        exclusion: row.exclusion,
        invocations: row.extraction.invocations
      },
      after: {
        eligible: after.eligible,
        exclusion: after.exclusion,
        invocations: after.extraction.invocations
      }
    })
  }
}
writeFileSync(
  deltaPath,
  delta.map((row) => `${JSON.stringify(row)}\n`).join("")
)
const marker = {
  compactedAt: new Date().toISOString(),
  reason:
    "Superseded full-row copies duplicated the final structural extraction; compact correction evidence is retained instead.",
  deleted: [
    {
      path: "derived/candidate-validation-pre-normalization.jsonl",
      bytes: preBytes.length,
      sha256: sha256(preBytes)
    },
    {
      path: "evidence/invalid-validation-normalization-v1.jsonl",
      bytes: v1Bytes.length,
      sha256: sha256(v1Bytes)
    }
  ],
  retainedFinal: {
    path: "derived/candidate-validation.jsonl",
    bytes: finalBytes.length,
    sha256: sha256(finalBytes)
  },
  v1ChangedRows: delta.length,
  deltaPath: "evidence/validation-normalization-v1-delta.jsonl",
  deltaSha256: sha256(readFileSync(deltaPath))
}
writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`)
unlinkSync(prePath)
unlinkSync(v1Path)
process.stdout.write(
  `SUPERSEDED_VALIDATION_COMPACTED deletedBytes=${
    preBytes.length + v1Bytes.length
  } deltaRows=${delta.length}\n`
)
