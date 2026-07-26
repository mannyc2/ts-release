import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const firstPath = join(root, "derived", "workflow-coding-first.jsonl")
const comparisonPath = join(root, "derived", "recode-comparison.jsonl")
const resolutionsPath = join(root, "derived", "recode-resolutions.jsonl")
const finalPath = join(root, "derived", "workflow-coding-final.jsonl")
const completionPath = join(root, "derived", "coding-finalized.json")

const lines = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
const first = lines(firstPath)
const comparisons = lines(comparisonPath)
const disagreements = comparisons.filter((row) => !row.agreement)
const resolutions = new Map<string, any>()
if (existsSync(resolutionsPath)) {
  for (const row of lines(resolutionsPath)) {
    resolutions.set(`${row.repo}:${row.path}`, row)
  }
}
for (const row of disagreements) {
  if (!resolutions.has(`${row.repo}:${row.path}`)) {
    throw new Error(`Missing recode resolution for ${row.repo}:${row.path}`)
  }
}

const final = first.map((row) => {
  const resolution = resolutions.get(`${row.repo}:${row.path}`)
  if (!resolution) return row
  return {
    ...row,
    shape: {
      ...row.shape,
      headlineClass: resolution.finalLabel,
      otherReason: resolution.finalOtherReason ?? null,
      classReason: resolution.resolutionRationale,
      resolvedFromRecodeDisagreement: true
    }
  }
})

const temporary = `${finalPath}.tmp`
writeFileSync(
  temporary,
  final.map((row) => `${JSON.stringify(row)}\n`).join("")
)
renameSync(temporary, finalPath)
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")
writeFileSync(
  completionPath,
  `${JSON.stringify(
    {
      finalizedAt: new Date().toISOString(),
      rows: final.length,
      recodeDisagreements: disagreements.length,
      manuallyResolved: resolutions.size,
      outputSha256: sha256(readFileSync(finalPath))
    },
    null,
    2
  )}\n`
)
process.stdout.write(
  `CODING_FINALIZED rows=${final.length} recodeDisagreements=${disagreements.length}\n`
)
