import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const readLines = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))

const first = new Map(
  readLines(join(root, "derived", "workflow-coding-first.jsonl")).map(
    (row) => [`${row.repo}:${row.path}`, row]
  )
)
const second = readLines(join(root, "derived", "recode-second.jsonl"))
const comparisons = second.map((row) => {
  const original = first.get(`${row.repo}:${row.path}`)
  if (!original) throw new Error(`Missing first label ${row.repo}:${row.path}`)
  const firstLabel = original.shape.headlineClass
  const secondLabel = row.headlineClass
  return {
    subsetIndex: row.subsetIndex,
    repo: row.repo,
    path: row.path,
    firstLabel,
    firstOtherReason: original.shape.otherReason,
    secondLabel,
    secondOtherReason: row.otherReason,
    agreement: firstLabel === secondLabel,
    secondRationale: row.rationale,
    finalResolution:
      firstLabel === secondLabel ? firstLabel : "REVIEW_REQUIRED"
  }
})

const labels = [
  ...new Set(
    comparisons.flatMap((row) => [row.firstLabel, row.secondLabel])
  )
].sort()
const n = comparisons.length
const agreements = comparisons.filter((row) => row.agreement).length
const observed = n === 0 ? null : agreements / n
const expected =
  n === 0
    ? null
    : labels.reduce((sum, label) => {
        const firstShare =
          comparisons.filter((row) => row.firstLabel === label).length / n
        const secondShare =
          comparisons.filter((row) => row.secondLabel === label).length / n
        return sum + firstShare * secondShare
      }, 0)
const kappa =
  observed === null || expected === null || expected === 1
    ? null
    : (observed - expected) / (1 - expected)

const comparisonPath = join(root, "derived", "recode-comparison.jsonl")
const summaryPath = join(root, "measurements", "rubric-stability.json")
const temporary = `${comparisonPath}.tmp`
writeFileSync(
  temporary,
  comparisons.map((row) => `${JSON.stringify(row)}\n`).join("")
)
renameSync(temporary, comparisonPath)
writeFileSync(
  summaryPath,
  `${JSON.stringify(
    {
      subsetN: n,
      agreements,
      disagreements: n - agreements,
      disagreementShare: n === 0 ? null : (n - agreements) / n,
      rawAgreement: observed,
      expectedAgreement: expected,
      cohensKappa: kappa,
      labels,
      unresolvedRows: comparisons.filter(
        (row) => row.finalResolution === "REVIEW_REQUIRED"
      ).length
    },
    null,
    2
  )}\n`
)
process.stdout.write(
  `RECODE_COMPARED n=${n} disagreements=${n - agreements} kappa=${kappa}\n`
)
