import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const manifestPath = join(root, "derived", "manifest.jsonl")
const validationPath = join(root, "derived", "candidate-validation.jsonl")
const freezePath = join(root, "derived", "manifest-freeze.json")
const codingPath = join(root, "derived", "workflow-coding-first.jsonl")
const invocationsPath = join(root, "derived", "invocations.jsonl")
const flagsPath = join(root, "derived", "flags-inputs.jsonl")
const completionPath = join(root, "derived", "first-coding-complete.json")

if (!existsSync(freezePath)) {
  throw new Error("Manifest must be frozen before coding")
}
if (existsSync(completionPath)) {
  throw new Error("First coding already completed")
}

const lines = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
const jsonLines = (rows: Array<unknown>) =>
  rows.map((row) => `${JSON.stringify(row)}\n`).join("")
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")
const atomicWrite = (path: string, value: string) => {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, value)
  renameSync(temporary, path)
}

const manifest = lines(manifestPath)
const validation = new Map(
  lines(validationPath).map((row) => [`${row.repo}:${row.path}`, row])
)

const triggersOf = (value: unknown): Array<string> => {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.map(String)
  if (value && typeof value === "object") return Object.keys(value)
  return []
}
const environmentName = (value: unknown): string | null => {
  if (typeof value === "string") return value
  if (value && typeof value === "object") {
    const name = (value as any).name
    return typeof name === "string" ? name : JSON.stringify(value)
  }
  return null
}
const publishLike = (operation: string) =>
  /publish|release|host|deploy|announce|upload|apply/i.test(operation)

const transitiveNeeds = (jobs: Array<any>, later: string, earlier: string) => {
  const byId = new Map(jobs.map((job) => [job.jobId, job]))
  const seen = new Set<string>()
  const stack = [...(byId.get(later)?.needs ?? [])]
  while (stack.length > 0) {
    const current = String(stack.pop())
    if (current === earlier) return true
    if (seen.has(current)) continue
    seen.add(current)
    stack.push(...(byId.get(current)?.needs ?? []))
  }
  return false
}

const chainOperations: Record<string, Array<string>> = {
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

const classifyShape = (extraction: any) => {
  const invocations = extraction.invocations ?? []
  if (invocations.length === 0) {
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_NO_VERB",
      classReason: "No resolved in-scope invocation"
    }
  }
  if (
    invocations.some(
      (invocation: any) => invocation.operation === "unknown"
    )
  ) {
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_UNRESOLVED",
      classReason: "At least one wrapper or command has unresolved semantics"
    }
  }

  const tools = [...new Set(invocations.map((row: any) => row.tool))]
  const operations = [
    ...new Set(
      invocations.map((row: any) => `${row.tool}:${row.operation}`)
    )
  ]
  if (operations.length === 1) {
    return {
      headlineClass: "SINGLE_VERB",
      otherReason: null,
      classReason: "One semantic release operation after matrix/retry collapse"
    }
  }
  if (tools.length > 1) {
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_MIXED",
      classReason: "Distinct operations span multiple release tools"
    }
  }

  const tool = tools[0] as string
  const chain = chainOperations[tool]
  if (!chain) {
    const jobs = new Set(invocations.map((row: any) => row.jobId))
    if (jobs.size > 1) {
      return {
        headlineClass: "INDEPENDENT_VERBS",
        otherReason: null,
        classReason:
          "Distinct non-chain operations are exposed in separate jobs"
      }
    }
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_AMBIGUOUS",
      classReason:
        "Distinct operations lack a preregistered durable-chain interpretation"
    }
  }

  const orderedPairs: Array<any> = []
  const independentPairs: Array<any> = []
  const ambiguousPairs: Array<any> = []
  for (let left = 0; left < invocations.length; left += 1) {
    for (let right = left + 1; right < invocations.length; right += 1) {
      const first = invocations[left]
      const second = invocations[right]
      if (first.operation === second.operation) continue
      const firstRank = chain.indexOf(first.operation)
      const secondRank = chain.indexOf(second.operation)
      const chainCompatible = firstRank >= 0 && secondRank >= 0
      const earlier = firstRank <= secondRank ? first : second
      const later = firstRank <= secondRank ? second : first
      const sameJobOrdered =
        earlier.jobId === later.jobId &&
        earlier.stepIndex !== null &&
        later.stepIndex !== null &&
        (earlier.stepIndex < later.stepIndex ||
          (earlier.stepIndex === later.stepIndex && earlier === first))
      const needsOrdered = transitiveNeeds(
        extraction.jobs,
        later.jobId,
        earlier.jobId
      )
      if (
        chainCompatible &&
        firstRank !== secondRank &&
        (sameJobOrdered || needsOrdered)
      ) {
        orderedPairs.push({
          first: `${earlier.jobId}:${earlier.operation}`,
          second: `${later.jobId}:${later.operation}`,
          relation: sameJobOrdered ? "same-job-order" : "needs"
        })
      } else if (
        first.jobId !== second.jobId &&
        !transitiveNeeds(extraction.jobs, first.jobId, second.jobId) &&
        !transitiveNeeds(extraction.jobs, second.jobId, first.jobId)
      ) {
        independentPairs.push({
          first: `${first.jobId}:${first.operation}`,
          second: `${second.jobId}:${second.operation}`
        })
      } else {
        ambiguousPairs.push({
          first: `${first.jobId}:${first.operation}`,
          second: `${second.jobId}:${second.operation}`
        })
      }
    }
  }

  if (
    orderedPairs.length > 0 &&
    independentPairs.length === 0 &&
    ambiguousPairs.length === 0
  ) {
    return {
      headlineClass: "PLAN_THEN_ACT",
      otherReason: null,
      classReason: "All distinct operations form an explicit ordered chain",
      orderedPairCount: orderedPairs.length,
      orderedPairs: orderedPairs.slice(0, 50)
    }
  }
  if (
    orderedPairs.length === 0 &&
    independentPairs.length > 0 &&
    ambiguousPairs.length === 0
  ) {
    return {
      headlineClass: "INDEPENDENT_VERBS",
      otherReason: null,
      classReason:
        "Distinct operations have no required same-job or needs handoff",
      independentPairCount: independentPairs.length,
      independentPairs: independentPairs.slice(0, 50)
    }
  }
  if (orderedPairs.length === 0 && independentPairs.length === 0) {
    return {
      headlineClass: "OTHER",
      otherReason: "OTHER_AMBIGUOUS",
      classReason:
        "Distinct operations share a path but do not prove a durable chain",
      ambiguousPairCount: ambiguousPairs.length,
      ambiguousPairs: ambiguousPairs.slice(0, 50)
    }
  }
  return {
    headlineClass: "OTHER",
    otherReason: "OTHER_MIXED",
    classReason: "Ordered, independent, or ambiguous operation pairs coexist",
    orderedPairCount: orderedPairs.length,
    independentPairCount: independentPairs.length,
    ambiguousPairCount: ambiguousPairs.length,
    orderedPairs: orderedPairs.slice(0, 50),
    independentPairs: independentPairs.slice(0, 50),
    ambiguousPairs: ambiguousPairs.slice(0, 50)
  }
}

const codeManualGate = (extraction: any) => {
  const triggers = triggersOf(extraction.triggers)
  const workflowDispatchOnly =
    triggers.length === 1 && triggers[0] === "workflow_dispatch"
  const publishInvocations = extraction.invocations.filter((row: any) =>
    publishLike(row.operation)
  )
  const publishJobs = new Set(
    (publishInvocations.length > 0
      ? publishInvocations
      : extraction.invocations
    ).map((row: any) => row.jobId)
  )
  const relevantJobs = extraction.jobs.filter((job: any) =>
    publishJobs.has(job.jobId)
  )
  const allText = extraction.jobs
    .flatMap((job: any) => [
      job.name,
      job.if,
      job.uses,
      ...job.steps.flatMap((step: any) => [
        step.name,
        step.if,
        step.uses,
        step.run
      ])
    ])
    .filter(Boolean)
    .join("\n")
  const explicitApproval =
    /manual[-_ ]approval|wait[-_ ]for[-_ ]approval|trstringer\/manual-approval|approval[-_ ]gate/i.test(
      allText
    )
  const dispatchJobGate = relevantJobs.some((job: any) =>
    /github\.event_name\s*==\s*['"]workflow_dispatch['"]/i.test(
      String(job.if ?? "")
    )
  )
  const environments = relevantJobs
    .map((job: any) => ({
      jobId: job.jobId,
      environment: environmentName(job.environment)
    }))
    .filter((row: any) => row.environment !== null)
  const automaticFilter =
    triggers.some((trigger) => trigger !== "workflow_dispatch") ||
    relevantJobs.some((job: any) => Boolean(job.if))

  const evidence: Array<any> = []
  if (workflowDispatchOnly) {
    evidence.push({
      subtype: "WORKFLOW_DISPATCH_ONLY",
      source: "workflow.on"
    })
  }
  if (dispatchJobGate) {
    evidence.push({
      subtype: "PUBLISH_JOB_DISPATCH_CONDITION",
      source: "publish-job.if"
    })
  }
  if (explicitApproval) {
    evidence.push({
      subtype: "EXPLICIT_APPROVAL_ACTION_OR_JOB",
      source: "workflow structure"
    })
  }
  for (const environment of environments) {
    evidence.push({
      subtype: "UNVERIFIED_ENVIRONMENT",
      source: environment.jobId,
      environment: environment.environment
    })
  }

  const confirmedManual =
    workflowDispatchOnly || dispatchJobGate || explicitApproval
  const potentialEnvironment = environments.length > 0
  let headline: string
  if (confirmedManual) headline = "CONFIRMED_MANUAL"
  else if (potentialEnvironment) headline = "POTENTIAL_ENVIRONMENT_GATE"
  else if (automaticFilter) headline = "AUTOMATIC_GATED"
  else headline = "NO_OBSERVED_GATE"

  return {
    headline,
    confirmedManual,
    potentialEnvironment,
    automaticGated: automaticFilter,
    unresolved: false,
    evidence
  }
}

const codeRecovery = (extraction: any) => {
  const allText = JSON.stringify(extraction)
  const fields = {
    concurrency: Boolean(extraction.concurrency) ||
      extraction.jobs.some((job: any) => Boolean(job.concurrency)),
    retry:
      /retry|nick-fields\/retry|for\s+.+\s+in\s+\{?1\.\.[2-9]/i.test(allText),
    releaseOrTagExistenceCheck:
      /gh\s+release\s+view|git\s+(?:tag|rev-parse).*(?:--list|--verify|refs\/tags)|release.*already exists/i.test(
        allText
      ),
    registryOrVersionExistenceCheck:
      /npm\s+view|pnpm\s+view|yarn\s+info|cargo\s+search|pip\s+index|registry.*(?:exists|version)/i.test(
        allText
      ),
    idempotencyOrImmutable:
      /idempotenc|immutable[-_ ]release|immutable[-_ ]upload/i.test(allText),
    skipIfPublished:
      /skip.*(?:published|exists)|already (?:published|exists)|if.*(?:published|exists)/i.test(
        allText
      ),
    persistedArtifactOrEvidence:
      /actions\/(?:upload|download)-artifact|upload-evidence|attest|provenance/i.test(
        allText
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

const codingRows: Array<any> = []
const invocationRows: Array<any> = []
const flagRows: Array<any> = []

for (const manifestRow of manifest) {
  const key = `${manifestRow.repo}:${manifestRow.path}`
  const source = validation.get(key)
  if (!source) throw new Error(`Missing validation row for ${key}`)
  const shape = classifyShape(source.extraction)
  const manualGate = codeManualGate(source.extraction)
  const recovery = codeRecovery(source.extraction)

  for (let index = 0; index < source.extraction.invocations.length; index += 1) {
    const invocation = source.extraction.invocations[index]
    const invocationRow = {
      repo: manifestRow.repo,
      path: manifestRow.path,
      starBand: manifestRow.starBand,
      invocationIndex: index + 1,
      ...invocation
    }
    invocationRows.push(invocationRow)
    const raw = String(invocation.raw ?? "")
    for (const match of raw.matchAll(/--[A-Za-z][A-Za-z0-9-]*/g)) {
      flagRows.push({
        repo: manifestRow.repo,
        path: manifestRow.path,
        tool: invocation.tool,
        kind: "cli-flag",
        raw: match[0],
        normalized: match[0]
      })
    }
    for (const input of Object.keys(invocation.inputs ?? {})) {
      flagRows.push({
        repo: manifestRow.repo,
        path: manifestRow.path,
        tool: invocation.tool,
        kind: "action-input",
        raw: input,
        normalized: input
      })
    }
  }

  codingRows.push({
    repo: manifestRow.repo,
    path: manifestRow.path,
    immutableUrl: manifestRow.immutableUrl,
    starBand: manifestRow.starBand,
    starsAtRetrieval: manifestRow.starsAtRetrieval,
    toolSet: manifestRow.toolSet,
    invocationCount: source.extraction.invocations.length,
    triggers: triggersOf(source.extraction.triggers),
    shape,
    manualGate,
    recovery,
    contentSha256: manifestRow.contentSha256
  })
}

atomicWrite(codingPath, jsonLines(codingRows))
atomicWrite(invocationsPath, jsonLines(invocationRows))
atomicWrite(flagsPath, jsonLines(flagRows))

const completion = {
  completedAt: new Date().toISOString(),
  codedRows: codingRows.length,
  invocationRows: invocationRows.length,
  flagInputRows: flagRows.length,
  checksums: {
    "derived/workflow-coding-first.jsonl": sha256(
      readFileSync(codingPath)
    ),
    "derived/invocations.jsonl": sha256(readFileSync(invocationsPath)),
    "derived/flags-inputs.jsonl": sha256(readFileSync(flagsPath))
  }
}
atomicWrite(completionPath, `${JSON.stringify(completion, null, 2)}\n`)
process.stdout.write(
  `FIRST_CODING_COMPLETE rows=${completion.codedRows} invocations=${completion.invocationRows} flagsInputs=${completion.flagInputRows}\n`
)
