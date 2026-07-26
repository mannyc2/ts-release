import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

// This pass intentionally reads only the blinded extraction file. It does
// not open workflow-coding-first.jsonl.
const root = join(import.meta.dir, "..")
const inputPath = join(root, "evidence", "recode-blinded.jsonl")
const outputPath = join(root, "derived", "recode-second.jsonl")

const rows = readFileSync(inputPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))

const chain: Record<string, Array<string>> = {
  changesets: ["pre", "version", "version_or_publish", "publish"],
  "cargo-dist": ["plan", "manifest", "build", "host"],
  jreleaser: [
    "assemble",
    "changelog",
    "catalog",
    "checksum",
    "sign",
    "sbom",
    "deploy",
    "release",
    "announce",
    "full-release"
  ],
  "release-please": ["manifest-pr", "release-pr", "github-release"],
  "ts-release": ["plan", "build", "release", "apply", "verify"]
}

const dependsOn = (jobs: Array<any>, later: string, earlier: string) => {
  const table = new Map(jobs.map((job) => [job.jobId, job]))
  const pending = [...(table.get(later)?.needs ?? [])]
  const seen = new Set<string>()
  while (pending.length > 0) {
    const job = String(pending.pop())
    if (job === earlier) return true
    if (seen.has(job)) continue
    seen.add(job)
    pending.push(...(table.get(job)?.needs ?? []))
  }
  return false
}

const classify = (extraction: any) => {
  const invocations = extraction.invocations ?? []
  if (invocations.length === 0) {
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_NO_VERB",
      rationale: "No resolved invocation"
    }
  }
  if (invocations.some((row: any) => row.operation === "unknown")) {
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_UNRESOLVED",
      rationale: "Unresolved operation"
    }
  }
  const semantic = [
    ...new Set(
      invocations.map((row: any) => `${row.tool}:${row.operation}`)
    )
  ]
  if (semantic.length === 1) {
    return {
      headlineClass: "SINGLE_VERB",
      otherReason: null,
      rationale: "One semantic tool operation"
    }
  }
  const tools = [...new Set(invocations.map((row: any) => row.tool))]
  if (tools.length !== 1) {
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_MIXED",
      rationale: "Several tools"
    }
  }
  const stages = chain[tools[0] as string]
  if (!stages) {
    const jobs = new Set(invocations.map((row: any) => row.jobId))
    return jobs.size > 1
      ? {
          headlineClass: "INDEPENDENT_VERBS",
          otherReason: null,
          rationale: "Distinct operations in separate non-chain jobs"
        }
      : {
          headlineClass: "OTHER",
          otherReason: "OTHER_AMBIGUOUS",
          rationale: "No durable-chain rule for these operations"
        }
  }

  let ordered = 0
  let unordered = 0
  let ambiguous = 0
  for (let i = 0; i < invocations.length; i += 1) {
    for (let j = i + 1; j < invocations.length; j += 1) {
      const a = invocations[i]
      const b = invocations[j]
      if (a.operation === b.operation) continue
      const rankA = stages.indexOf(a.operation)
      const rankB = stages.indexOf(b.operation)
      if (rankA < 0 || rankB < 0 || rankA === rankB) {
        unordered += 1
        continue
      }
      const earlier = rankA < rankB ? a : b
      const later = rankA < rankB ? b : a
      const sameJob =
        earlier.jobId === later.jobId &&
        earlier.stepIndex !== null &&
        later.stepIndex !== null &&
        (earlier.stepIndex < later.stepIndex ||
          (earlier.stepIndex === later.stepIndex && earlier === a))
      if (sameJob || dependsOn(extraction.jobs, later.jobId, earlier.jobId)) {
        ordered += 1
      } else if (
        a.jobId !== b.jobId &&
        !dependsOn(extraction.jobs, a.jobId, b.jobId) &&
        !dependsOn(extraction.jobs, b.jobId, a.jobId)
      ) {
        unordered += 1
      } else {
        ambiguous += 1
      }
    }
  }
  if (ordered > 0 && unordered === 0 && ambiguous === 0) {
    return {
      headlineClass: "PLAN_THEN_ACT",
      otherReason: null,
      rationale: "Every distinct phase pair is explicitly ordered"
    }
  }
  if (ordered === 0 && unordered > 0 && ambiguous === 0) {
    return {
      headlineClass: "INDEPENDENT_VERBS",
      otherReason: null,
      rationale: "No distinct phase pair has a required handoff"
    }
  }
  if (ordered === 0 && unordered === 0) {
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_AMBIGUOUS",
      rationale: "Same-path operations do not prove a durable handoff"
    }
  }
  return {
    headlineClass: "OTHER",
    otherReason: "OTHER_MIXED",
    rationale: "Ordered and unordered phase pairs coexist"
  }
}

const output = rows.map((row) => ({
  subsetIndex: row.subsetIndex,
  repo: row.repo,
  path: row.path,
  ...classify(row.extraction)
}))

const temporary = `${outputPath}.tmp`
writeFileSync(
  temporary,
  output.map((row) => `${JSON.stringify(row)}\n`).join("")
)
renameSync(temporary, outputPath)
process.stdout.write(`BLINDED_RECODE_COMPLETE rows=${output.length}\n`)
