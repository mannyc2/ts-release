import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const readLines = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
const coding = readLines(
  join(root, "derived", "workflow-coding-final.jsonl")
)
const manifest = readLines(join(root, "derived", "manifest.jsonl"))
const validation = readLines(
  join(root, "derived", "candidate-validation.jsonl")
)
const flags = readLines(join(root, "derived", "flags-inputs.jsonl"))
const frame = JSON.parse(
  readFileSync(join(root, "raw", "frame-freeze.json"), "utf8")
)
const rubric = JSON.parse(
  readFileSync(join(root, "measurements", "rubric-stability.json"), "utf8")
)

const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return ""
  const text =
    typeof value === "string" ? value : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}
const writeCsv = (
  filename: string,
  headers: Array<string>,
  rows: Array<Record<string, unknown>>
) => {
  writeFileSync(
    join(root, "measurements", filename),
    `${headers.join(",")}\n${rows
      .map((row) => headers.map((header) => csvCell(row[header])).join(","))
      .join("\n")}\n`
  )
}
const share = (count: number, denominator: number) =>
  denominator === 0 ? null : count / denominator
const counts = (values: Array<string>) =>
  Object.fromEntries(
    [...new Set(values)].sort().map((value) => [
      value,
      values.filter((candidate) => candidate === value).length
    ])
  )

const bands = ["B1", "B2", "B3", "B4"]
const allTools = [...new Set(coding.flatMap((row) => row.toolSet))].sort()
const achievedByBand = bands.map((band) => {
  const count = manifest.filter((row) => row.starBand === band).length
  return { band, target: 150, achieved: count, shortfall: 150 - count }
})
const achievedByTool = allTools.map((tool) => ({
  tool,
  workflows: coding.filter((row) => row.toolSet.includes(tool)).length
}))
const achievedByToolBand = allTools.flatMap((tool) =>
  bands.map((band) => ({
    tool,
    band,
    workflows: coding.filter(
      (row) => row.toolSet.includes(tool) && row.starBand === band
    ).length
  }))
)

const shapeSummary = (rows: Array<any>, dimension: string, value: string) => {
  const shapeCounts = counts(rows.map((row) => row.shape.headlineClass))
  return ["SINGLE_VERB", "PLAN_THEN_ACT", "INDEPENDENT_VERBS", "OTHER"].map(
    (shape) => ({
      dimension,
      value,
      shape,
      count: shapeCounts[shape] ?? 0,
      denominator: rows.length,
      share: share(shapeCounts[shape] ?? 0, rows.length)
    })
  )
}
const shapeOverall = shapeSummary(coding, "overall", "all")
const shapeByTool = allTools.flatMap((tool) =>
  shapeSummary(
    coding.filter((row) => row.toolSet.includes(tool)),
    "tool",
    tool
  )
)
const shapeByBand = bands.flatMap((band) =>
  shapeSummary(
    coding.filter((row) => row.starBand === band),
    "band",
    band
  )
)

const gateSummary = (
  rows: Array<any>,
  dimension: string,
  value: string
) => {
  const gateCounts = counts(rows.map((row) => row.manualGate.headline))
  return [
    "CONFIRMED_MANUAL",
    "POTENTIAL_ENVIRONMENT_GATE",
    "AUTOMATIC_GATED",
    "NO_OBSERVED_GATE",
    "UNRESOLVED_GATE"
  ].map((gate) => ({
    dimension,
    value,
    gate,
    count: gateCounts[gate] ?? 0,
    denominator: rows.length,
    share: share(gateCounts[gate] ?? 0, rows.length)
  }))
}
const gates = [
  ...gateSummary(coding, "overall", "all"),
  ...allTools.flatMap((tool) =>
    gateSummary(
      coding.filter((row) => row.toolSet.includes(tool)),
      "tool",
      tool
    )
  ),
  ...bands.flatMap((band) =>
    gateSummary(
      coding.filter((row) => row.starBand === band),
      "band",
      band
    )
  )
]

const gateSubtypeSummary = (
  rows: Array<any>,
  dimension: string,
  value: string
) => {
  const subtypes = [
    ...new Set(
      rows.flatMap((row) =>
        row.manualGate.evidence.map((evidence: any) => evidence.subtype)
      )
    )
  ].sort()
  return subtypes.map((subtype) => {
    const count = rows.filter((row) =>
      row.manualGate.evidence.some(
        (evidence: any) => evidence.subtype === subtype
      )
    ).length
    return {
      dimension,
      value,
      subtype,
      count,
      denominator: rows.length,
      share: share(count, rows.length)
    }
  })
}
const gateSubtypes = [
  ...gateSubtypeSummary(coding, "overall", "all"),
  ...allTools.flatMap((tool) =>
    gateSubtypeSummary(
      coding.filter((row) => row.toolSet.includes(tool)),
      "tool",
      tool
    )
  ),
  ...bands.flatMap((band) =>
    gateSubtypeSummary(
      coding.filter((row) => row.starBand === band),
      "band",
      band
    )
  )
]

const recoveryFields = [
  "concurrency",
  "retry",
  "releaseOrTagExistenceCheck",
  "registryOrVersionExistenceCheck",
  "idempotencyOrImmutable",
  "skipIfPublished",
  "persistedArtifactOrEvidence",
  "manualRerunOnly",
  "noVisibleGuard",
  "unresolved"
]
const recoverySummary = (
  rows: Array<any>,
  dimension: string,
  value: string
) =>
  recoveryFields.map((field) => {
    const count = rows.filter((row) => row.recovery[field]).length
    return {
      dimension,
      value,
      field,
      count,
      denominator: rows.length,
      share: share(count, rows.length)
    }
  })
const recovery = [
  ...recoverySummary(coding, "overall", "all"),
  ...allTools.flatMap((tool) =>
    recoverySummary(
      coding.filter((row) => row.toolSet.includes(tool)),
      "tool",
      tool
    )
  ),
  ...bands.flatMap((band) =>
    recoverySummary(
      coding.filter((row) => row.starBand === band),
      "band",
      band
    )
  )
]

const flagGroups = new Map<string, any>()
for (const row of flags) {
  const key = [row.tool, row.kind, row.raw, row.normalized].join("\u0000")
  const group = flagGroups.get(key) ?? {
    tool: row.tool,
    kind: row.kind,
    raw: row.raw,
    normalized: row.normalized,
    occurrences: 0,
    workflows: new Set<string>()
  }
  group.occurrences += 1
  group.workflows.add(`${row.repo}:${row.path}`)
  flagGroups.set(key, group)
}
const flagHistogram = [...flagGroups.values()]
  .map((row) => ({
    tool: row.tool,
    kind: row.kind,
    raw: row.raw,
    normalized: row.normalized,
    occurrences: row.occurrences,
    workflows: row.workflows.size
  }))
  .sort(
    (a, b) =>
      a.tool.localeCompare(b.tool) ||
      a.kind.localeCompare(b.kind) ||
      b.workflows - a.workflows ||
      a.raw.localeCompare(b.raw)
  )

const baselineCliFlags = [
  "--config",
  "--root",
  "--snapshot",
  "--out",
  "--format",
  "--target",
  "--execute",
  "--approve-publish",
  "--continue",
  "--published"
]
const baselineActionInputs = [
  "command",
  "config",
  "format",
  "write-step-summary",
  "plan-path",
  "fail-on-warnings",
  "target",
  "snapshot",
  "execute",
  "continue",
  "published",
  "approve-publish",
  "upload-evidence",
  "evidence-artifact-name"
]
const upstreamFlags = new Set(
  flagHistogram
    .filter((row) => row.kind === "cli-flag" && row.tool !== "ts-release")
    .map((row) => row.normalized)
)
const upstreamInputs = new Set(
  flagHistogram
    .filter((row) => row.kind === "action-input" && row.tool !== "ts-release")
    .map((row) => row.normalized)
)
const commonWithoutExactBaseline = flagHistogram
  .filter(
    (row) =>
      row.tool !== "ts-release" &&
      !(
        row.kind === "cli-flag"
          ? baselineCliFlags.includes(row.normalized)
          : baselineActionInputs.includes(row.normalized)
      )
  )
  .sort(
    (a, b) =>
      b.workflows - a.workflows ||
      b.occurrences - a.occurrences ||
      a.raw.localeCompare(b.raw)
  )
  .slice(0, 50)

const strictManual = coding.filter(
  (row) => row.manualGate.confirmedManual
).length
const potentialManual = coding.filter(
  (row) => row.manualGate.confirmedManual || row.manualGate.potentialEnvironment
).length
const independent = coding.filter(
  (row) => row.shape.headlineClass === "INDEPENDENT_VERBS"
).length
const thresholdEligible = coding.length >= 200 && allTools.length >= 5
const independentShare = share(independent, coding.length)
const strictManualShare = share(strictManual, coding.length)

const tsQueryCoverage = frame.queryCoverage.filter(
  (query: any) => query.tool === "ts-release"
)
const tsReleaseMatches = validation.filter(
  (row) =>
    row.eligible &&
    row.extraction.invocations.some(
      (invocation: any) => invocation.tool === "ts-release"
    )
)
writeFileSync(
  join(root, "derived", "ts-release-invocations.jsonl"),
  tsReleaseMatches.map((row) => `${JSON.stringify(row)}\n`).join("")
)
writeFileSync(
  join(root, "derived", "manual-gate-evidence.jsonl"),
  coding
    .map((row) =>
      `${JSON.stringify({
        repo: row.repo,
        path: row.path,
        starBand: row.starBand,
        toolSet: row.toolSet,
        ...row.manualGate
      })}\n`
    )
    .join("")
)
writeFileSync(
  join(root, "derived", "recovery-coding.jsonl"),
  coding
    .map((row) =>
      `${JSON.stringify({
        repo: row.repo,
        path: row.path,
        starBand: row.starBand,
        toolSet: row.toolSet,
        ...row.recovery
      })}\n`
    )
    .join("")
)

writeCsv(
  "achieved-by-band.csv",
  ["band", "target", "achieved", "shortfall"],
  achievedByBand
)
writeCsv("achieved-by-tool.csv", ["tool", "workflows"], achievedByTool)
writeCsv(
  "achieved-by-tool-band.csv",
  ["tool", "band", "workflows"],
  achievedByToolBand
)
writeCsv(
  "shape-overall.csv",
  ["dimension", "value", "shape", "count", "denominator", "share"],
  shapeOverall
)
writeCsv(
  "shape-by-tool.csv",
  ["dimension", "value", "shape", "count", "denominator", "share"],
  shapeByTool
)
writeCsv(
  "shape-by-band.csv",
  ["dimension", "value", "shape", "count", "denominator", "share"],
  shapeByBand
)
writeCsv(
  "manual-gates.csv",
  ["dimension", "value", "gate", "count", "denominator", "share"],
  gates
)
writeCsv(
  "manual-gate-subtypes.csv",
  ["dimension", "value", "subtype", "count", "denominator", "share"],
  gateSubtypes
)
writeCsv(
  "recovery-summary.csv",
  ["dimension", "value", "field", "count", "denominator", "share"],
  recovery
)
writeCsv(
  "flags-input-histogram.csv",
  ["tool", "kind", "raw", "normalized", "occurrences", "workflows"],
  flagHistogram
)

const analysis = {
  generatedAt: new Date().toISOString(),
  frame: {
    queries: frame.queryCoverage.length,
    usablePages: frame.usablePages,
    failedPages: frame.failedPages,
    rawSearchRows: frame.rawSearchRows,
    distinctRepoPaths: frame.distinctRepoPaths,
    cappedQueries: frame.queryCoverage.filter(
      (query: any) =>
        query.usablePages === 10 && query.accessibleResults >= 1_000
    ).length,
    queryCoverage: frame.queryCoverage
  },
  achieved: {
    total: coding.length,
    target: 600,
    byBand: achievedByBand,
    representedTools: allTools,
    representedToolCount: allTools.length,
    byTool: achievedByTool,
    byToolBand: achievedByToolBand
  },
  thresholds: {
    eligible: thresholdEligible,
    eligibilityRule: "n>=200 and at least five fixed tools represented",
    independentVerbs: {
      count: independent,
      denominator: coding.length,
      share: independentShare,
      threshold: 0.35,
      decision: !thresholdEligible
        ? "INCONCLUSIVE"
        : independentShare! > 0.35
          ? "DELETING_NAMED_VERBS_CONFLICTS_WITH_FRAME"
          : "DOES_NOT_EXCEED_HEURISTIC"
    },
    strictConfirmedManual: {
      count: strictManual,
      denominator: coding.length,
      share: strictManualShare,
      threshold: 0.1,
      decision: !thresholdEligible
        ? "INCONCLUSIVE"
        : strictManualShare! < 0.1
          ? "VISIBLE_APPROVAL_EVIDENCE_THIN_IN_FRAME"
          : "NOT_BELOW_HEURISTIC"
    },
    confirmedPlusPotential: {
      count: potentialManual,
      denominator: coding.length,
      share: share(potentialManual, coding.length)
    }
  },
  shapes: {
    overall: shapeOverall,
    byTool: shapeByTool,
    byBand: shapeByBand
  },
  gates,
  gateSubtypes,
  recovery,
  rubricStability: rubric,
  tsRelease: {
    accessibleRawSearchRows: tsQueryCoverage.reduce(
      (sum: number, query: any) => sum + query.accessibleResults,
      0
    ),
    eligibleInvocationMatches: tsReleaseMatches.length,
    queryCoverage: tsQueryCoverage,
    absenceClaim: "accessible-frame-only"
  },
  validation: {
    candidates: validation.length,
    eligible: validation.filter((row) => row.eligible).length,
    excluded: validation.filter((row) => !row.eligible).length,
    exclusions: counts(
      validation.map((row) => row.exclusion).filter(Boolean)
    ),
    metadataRaces: validation.filter((row) => row.metadataRace).length
  },
  tsReleaseExactNameComparison: {
    method:
      "exact spelling only; no undocumented semantic-equivalence normalization",
    baselineCliFlagsWithNoExactObservedUpstreamName: baselineCliFlags.filter(
      (flag) => !upstreamFlags.has(flag)
    ),
    baselineActionInputsWithNoExactObservedUpstreamName:
      baselineActionInputs.filter((input) => !upstreamInputs.has(input)),
    commonUpstreamNamesWithoutExactTsReleaseCounterpart:
      commonWithoutExactBaseline
  },
  limitations: [
    "The frame is GitHub REST code search's relevance-ranked first 1,000 accessible results per fixed query, not a representative GitHub sample.",
    "Search totals and rankings changed during pagination; raw pages and rank observations are retained.",
    "Stars are current values at per-repository metadata retrieval, not a simultaneous or historical snapshot.",
    "Only publicly visible workflow structure was used; environment reviewer settings were not inferred from names.",
    "Root package.json scripts were resolved; non-root package-script and hidden private-wrapper semantics may remain unresolved.",
    "Invocation and gate coding used a frozen deterministic extractor followed by the preregistered blinded recode."
  ],
  protocolNotes: [
    "A pre-manifest detector overmatch was caught during validation; its 890 invalid rows and ledger are retained, and validation restarted from the unchanged raw frame.",
    "Twenty-three search pages required one rate-limit retry. The successful page record preserves attempt=1, but the rejected response body was not separately persisted."
  ]
}
writeFileSync(
  join(root, "measurements", "analysis.json"),
  `${JSON.stringify(analysis, null, 2)}\n`
)
process.stdout.write(
  `AGGREGATED n=${coding.length} tools=${allTools.length} independent=${independent} manual=${strictManual}\n`
)
