import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
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
const firstPath = join(root, "derived", "workflow-coding-first.jsonl")
const finalPath = join(root, "derived", "workflow-coding-final.jsonl")
const markerPath = join(root, "derived", "recovery-normalized.json")
const deltaPath = join(root, "evidence", "recovery-normalization-delta.jsonl")

const triggersOf = (value: unknown): Array<string> => {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.map(String)
  if (value && typeof value === "object") return Object.keys(value)
  return []
}
const normalizedRecovery = (extraction: any) => {
  const stepTexts = extraction.jobs.flatMap((job: any) => [
    String(job.name ?? ""),
    String(job.if ?? ""),
    String(job.uses ?? ""),
    ...job.steps.flatMap((step: any) => [
      String(step.name ?? ""),
      String(step.if ?? ""),
      String(step.uses ?? ""),
      String(step.run ?? "")
    ])
  ])
  const any = (pattern: RegExp) =>
    stepTexts.some((text: string) => pattern.test(text))
  const fields = {
    concurrency:
      Boolean(extraction.concurrency) ||
      extraction.jobs.some((job: any) => Boolean(job.concurrency)),
    retry: any(
      /retry|nick-fields\/retry|for\s+.+\s+in\s+\{?1\.\.[2-9]/i
    ),
    releaseOrTagExistenceCheck: any(
      /gh\s+release\s+view|git\s+(?:tag|rev-parse).*(?:--list|--verify|refs\/tags)|release.*already exists/i
    ),
    registryOrVersionExistenceCheck: any(
      /npm\s+view|pnpm\s+view|yarn\s+info|cargo\s+search|pip\s+index|registry[^\n]{0,120}(?:exists|version)/i
    ),
    idempotencyOrImmutable: any(
      /idempotenc|immutable[-_ ]release|immutable[-_ ]upload/i
    ),
    skipIfPublished: any(
      /skip[^\n]{0,120}(?:published|exists)|already (?:published|exists)|if[^\n]{0,120}(?:published|exists)/i
    ),
    persistedArtifactOrEvidence: any(
      /actions\/(?:upload|download)-artifact|upload-evidence|attest|provenance/i
    ),
    manualRerunOnly:
      triggersOf(extraction.triggers).length === 1 &&
      triggersOf(extraction.triggers)[0] === "workflow_dispatch"
  }
  return {
    ...fields,
    noVisibleGuard: !Object.values(fields).some(Boolean),
    unresolved: false
  }
}
const readRows = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
const delta: Array<any> = []
const update = (rows: Array<any>, collectDelta: boolean) =>
  rows.map((row) => {
    const source = validation.get(`${row.repo}:${row.path}`)
    if (!source) throw new Error(`Missing validation row ${row.repo}:${row.path}`)
    const after = normalizedRecovery(source.extraction)
    if (
      collectDelta &&
      JSON.stringify(row.recovery) !== JSON.stringify(after)
    ) {
      delta.push({
        repo: row.repo,
        path: row.path,
        before: row.recovery,
        after
      })
    }
    return { ...row, recovery: after }
  })
const atomic = (path: string, rows: Array<any>) => {
  const temporary = `${path}.tmp`
  writeFileSync(
    temporary,
    rows.map((row) => `${JSON.stringify(row)}\n`).join("")
  )
  renameSync(temporary, path)
}
const first = update(readRows(firstPath), true)
const final = update(readRows(finalPath), false)
atomic(firstPath, first)
atomic(finalPath, final)
writeFileSync(
  deltaPath,
  delta.map((row) => `${JSON.stringify(row)}\n`).join("")
)
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")
const marker = {
  normalizedAt: new Date().toISOString(),
  rows: final.length,
  changedRows: delta.length,
  method:
    "Recovery patterns are evaluated within individual workflow fields and steps, preventing cross-field regex matches.",
  firstCodingSha256: sha256(readFileSync(firstPath)),
  finalCodingSha256: sha256(readFileSync(finalPath)),
  deltaSha256: sha256(readFileSync(deltaPath))
}
writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`)

const firstCompletionPath = join(
  root,
  "derived",
  "first-coding-complete.json"
)
const firstCompletion = JSON.parse(readFileSync(firstCompletionPath, "utf8"))
firstCompletion.checksums["derived/workflow-coding-first.jsonl"] =
  marker.firstCodingSha256
firstCompletion.recoveryNormalizedAt = marker.normalizedAt
writeFileSync(
  firstCompletionPath,
  `${JSON.stringify(firstCompletion, null, 2)}\n`
)
const finalCompletionPath = join(root, "derived", "coding-finalized.json")
const finalCompletion = JSON.parse(readFileSync(finalCompletionPath, "utf8"))
finalCompletion.outputSha256 = marker.finalCodingSha256
finalCompletion.recoveryNormalizedAt = marker.normalizedAt
writeFileSync(
  finalCompletionPath,
  `${JSON.stringify(finalCompletion, null, 2)}\n`
)
process.stdout.write(
  `RECOVERY_NORMALIZED rows=${final.length} changed=${delta.length}\n`
)
