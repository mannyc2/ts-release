import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const keys = JSON.parse(
  readFileSync(join(root, "derived", "recode-subset-keys.json"), "utf8")
)
const validation = new Map(
  readFileSync(
    join(root, "derived", "candidate-validation.jsonl"),
    "utf8"
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((row) => [`${row.repo}:${row.path}`, row])
)

const rows = keys.rows.map((key: any) => {
  const source = validation.get(`${key.repo}:${key.path}`)
  if (!source) throw new Error(`Missing validation row ${key.repo}:${key.path}`)
  return {
    subsetIndex: key.subsetIndex,
    manifestSortRow: key.manifestSortRow,
    repo: key.repo,
    path: key.path,
    immutableUrl: key.immutableUrl,
    contentSha256: key.contentSha256,
    extraction: source.extraction
  }
})

const path = join(root, "evidence", "recode-blinded.jsonl")
const temporary = `${path}.tmp`
writeFileSync(
  temporary,
  rows.map((row: any) => `${JSON.stringify(row)}\n`).join("")
)
renameSync(temporary, path)
process.stdout.write(`BLINDED_RECODE_READY rows=${rows.length}\n`)
