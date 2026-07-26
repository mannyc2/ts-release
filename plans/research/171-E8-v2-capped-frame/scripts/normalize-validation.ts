import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const inputPath = join(root, "derived", "candidate-validation.jsonl")
const prePath = join(
  root,
  "derived",
  "candidate-validation-pre-normalization.jsonl"
)
const completionPath = join(root, "derived", "validation-complete.json")
const preCompletionPath = join(
  root,
  "derived",
  "validation-complete-pre-normalization.json"
)
const normalizationPath = join(
  root,
  "derived",
  "validation-normalization.json"
)

if (!existsSync(completionPath) && !existsSync(preCompletionPath)) {
  throw new Error("Validation must complete before normalization")
}
if (existsSync(normalizationPath)) {
  throw new Error("Validation has already been normalized")
}

if (!existsSync(prePath)) {
  renameSync(inputPath, prePath)
}
if (!existsSync(preCompletionPath)) {
  renameSync(completionPath, preCompletionPath)
}

const rows = readFileSync(prePath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))
const invocationsBefore = rows.reduce(
  (sum, row) => sum + Number(row.extraction?.invocations?.length ?? 0),
  0
)
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")
const compact = (value: unknown, maximum = 4_000) => {
  if (value === null || value === undefined) return null
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return text.length > maximum ? `${text.slice(0, maximum)}…` : text
}

const splitCommands = (raw: string) =>
  raw
    .replace(/\\\r?\n\s*/g, " ")
    .split(/\r?\n|&&|\|\||;/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !segment.startsWith("#"))
    .map((segment) =>
      segment.replace(
        /^(?:(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+))\s+)+/,
        ""
      )
    )

const installOnly = (segment: string) =>
  /^(?:sudo\s+)?(?:npm|pnpm|yarn|bun)\s+(?:install|add|i)\b|^(?:python\s+-m\s+)?pip\s+install\b|^uv\s+tool\s+install\b|^cargo\s+install\b|^go\s+install\b|^(?:curl|wget)\b/i.test(
    segment
  )

const commandMatches: Record<string, RegExp> = {
  goreleaser:
    /^(?:(?:sudo|env)\s+)*(?:\.\/)?goreleaser\b|^go\s+run\s+\S*goreleaser/i,
  "semantic-release":
    /^(?:\.\/node_modules\/\.bin\/)?semantic-release\b|^(?:npx|bunx|npm\s+exec|pnpm(?:\s+exec)?|yarn(?:\s+dlx)?)\s+semantic-release\b|^(?:npm|pnpm|yarn|bun)\s+run\s+semantic-release\b/i,
  changesets:
    /^(?:\.\/node_modules\/\.bin\/)?changesets?\s+(?:version|publish|status|pre|add)\b|^(?:npx|bunx|npm\s+exec|pnpm(?:\s+exec)?|yarn(?:\s+dlx)?)\s+changesets?\s+(?:version|publish|status|pre|add)\b|^(?:npm|pnpm|yarn|bun)\s+run\s+changesets?\b/i,
  "release-please":
    /^(?:\.\/node_modules\/\.bin\/)?release-please\b|^(?:npx|bunx|npm\s+exec|pnpm(?:\s+exec)?|yarn(?:\s+dlx)?)\s+release-please\b|^(?:npm|pnpm|yarn|bun)\s+run\s+release-please\b/i,
  "release-it":
    /^(?:\.\/node_modules\/\.bin\/)?release-it\b|^(?:npx|bunx|npm\s+exec|pnpm(?:\s+exec)?|yarn(?:\s+dlx)?)\s+release-it\b|^(?:npm|pnpm|yarn|bun)\s+run\s+release-it\b/i,
  jreleaser:
    /^(?:\.\/)?jreleaser\b|^(?:\.\/)?(?:mvnw|mvn)\b.*\bjreleaser:|^(?:\.\/)?gradlew\b.*\bjreleaser/i,
  "cargo-dist":
    /^(?:cargo\s+dist|dist)\s+(?:plan|build|host|generate|manifest)\b|^(?:\.\/)?cargo-dist\b/i,
  "release-plz":
    /^(?:\.\/)?release-plz\s+(?:release|release-pr|update)\b|^(?:cargo\s+run\s+.*--\s*)release-plz\b/i,
  np: /^(?:npx|bunx|pnpm\s+exec)\s+np(?:\s|$)/i,
  "ts-release":
    /^(?:\.\/node_modules\/\.bin\/)?ts-release\b|^(?:npx|bunx|npm\s+exec|pnpm(?:\s+exec)?|yarn(?:\s+dlx)?)\s+(?:@mannyc1\/)?ts-release\b|^(?:npm|pnpm|yarn|bun)\s+run\s+ts-release\b/i
}

const toolsFromRun = (raw: string) => {
  const tools = new Set<string>()
  for (const segment of splitCommands(raw)) {
    if (installOnly(segment)) continue
    for (const [tool, pattern] of Object.entries(commandMatches)) {
      if (pattern.test(segment)) tools.add(tool)
    }
  }
  return [...tools]
}

const toolsFromUses = (raw: string) => {
  const tools: Array<string> = []
  if (/goreleaser\/goreleaser-action/i.test(raw)) tools.push("goreleaser")
  if (
    /(?:cycjimmy|codfish)\/semantic-release-action|go-semantic-release\/action/i.test(
      raw
    )
  ) {
    tools.push("semantic-release")
  }
  if (/changesets\/action/i.test(raw)) tools.push("changesets")
  if (/googleapis\/release-please-action/i.test(raw)) {
    tools.push("release-please")
  }
  if (/release-it/i.test(raw)) tools.push("release-it")
  if (/jreleaser\/release-action/i.test(raw)) tools.push("jreleaser")
  if (/axodotdev\/cargo-dist|cargo-dist\/.*action/i.test(raw)) {
    tools.push("cargo-dist")
  }
  if (/release-plz\/.*action/i.test(raw)) tools.push("release-plz")
  if (/mannyc2\/ts-release-action/i.test(raw)) tools.push("ts-release")
  return [...new Set(tools)]
}

const operationsFor = (
  tool: string,
  raw: string,
  inputs: Record<string, unknown> = {},
  action = false
) => {
  const text = `${raw} ${Object.values(inputs).join(" ")}`
  if (tool === "jreleaser") {
    const camel = [
      ...text.matchAll(
        /\bjreleaser(FullRelease|Assemble|Changelog|Catalog|Deploy|Release|Announce|Config|Download|Upload|Sign|Checksum|Sbom)\b/gi
      )
    ].map((match) =>
      match[1] === "FullRelease"
        ? "full-release"
        : match[1].toLowerCase()
    )
    if (camel.length > 0) return [...new Set(camel)]
  }
  const patterns: Record<string, RegExp> = {
    goreleaser: /\bgoreleaser\s+(release|build|check|healthcheck|init)\b/gi,
    changesets: /\bchangesets?\s+(version|publish|status|pre|add)\b/gi,
    "release-please":
      /\brelease-please\s+(release-pr|github-release|manifest-pr)\b/gi,
    jreleaser:
      /\bjreleaser(?:\s+|:)?(full-release|assemble|changelog|catalog|deploy|release|announce|config|download|upload|sign|checksum|sbom)\b/gi,
    "cargo-dist":
      /\b(?:cargo\s+dist|dist)\s+(plan|build|host|generate|manifest)\b/gi,
    "release-plz": /\brelease-plz\s+(release|release-pr|update)\b/gi,
    "ts-release":
      /\bts-release\s+(init|doctor|build|plan|release|verify|apply)\b/gi
  }
  const pattern = patterns[tool]
  const operations = pattern
    ? [...text.matchAll(pattern)].map((match) => match[1].toLowerCase())
    : []
  if (operations.length > 0) return [...new Set(operations)]
  if (tool === "semantic-release" || tool === "release-it" || tool === "np") {
    return ["release"]
  }
  if (tool === "changesets" && action) return ["version_or_publish"]
  if (tool === "release-please" && action) return ["release_pr_or_release"]
  if (tool === "jreleaser" && action) return ["release"]
  if (tool === "cargo-dist" && action) return ["release"]
  if (tool === "release-plz" && action) {
    const command = String(inputs.command ?? inputs.args ?? "")
    const match = command.match(/\b(release|release-pr|update)\b/i)
    return [match?.[1]?.toLowerCase() ?? "release"]
  }
  if (tool === "goreleaser") {
    const actionVerb = String(
      inputs.args ?? inputs.command ?? inputs.distribution ?? ""
    ).match(/\b(release|build|check|healthcheck|init)\b/i)?.[1]
    return [actionVerb?.toLowerCase() ?? "release"]
  }
  if (tool === "ts-release" && action) {
    const command = String(inputs.command ?? "")
    return [
      command.match(/\b(init|doctor|build|plan|release|verify|apply)\b/i)?.[1]?.toLowerCase() ??
        "unknown"
    ]
  }
  return ["unknown"]
}

const normalized = rows.map((row) => {
  if (row.extraction?.parseStatus !== "PARSED") return row
  const invocations: Array<any> = []
  for (const job of row.extraction.jobs ?? []) {
    if (job.uses) {
      for (const tool of toolsFromUses(String(job.uses))) {
        for (const operation of operationsFor(
          tool,
          String(job.uses),
          job.with ?? {},
          true
        )) {
          invocations.push({
            tool,
            operation,
            source: "job-uses",
            jobId: job.jobId,
            stepIndex: null,
            raw: compact(job.uses),
            inputs: job.with ?? {}
          })
        }
      }
    }
    for (const step of job.steps ?? []) {
      const uses = String(step.uses ?? "")
      const run = String(step.run ?? "")
      for (const tool of toolsFromUses(uses)) {
        for (const operation of operationsFor(
          tool,
          uses,
          step.with ?? {},
          true
        )) {
          invocations.push({
            tool,
            operation,
            source: "step-uses",
            jobId: job.jobId,
            stepIndex: step.stepIndex,
            raw: compact(uses),
            inputs: step.with ?? {}
          })
        }
      }
      for (const tool of toolsFromRun(run)) {
        for (const operation of operationsFor(tool, run)) {
          invocations.push({
            tool,
            operation,
            source: "step-run",
            jobId: job.jobId,
            stepIndex: step.stepIndex,
            raw: compact(run),
            inputs: {}
          })
        }
      }
    }
  }

  for (const previous of row.extraction.invocations ?? []) {
    if (previous.source !== "package-script") continue
    const resolved = String(previous.raw ?? "").split("->").slice(1).join("->")
    for (const tool of toolsFromRun(resolved)) {
      for (const operation of operationsFor(tool, resolved)) {
        invocations.push({
          ...previous,
          tool,
          operation,
          raw: compact(previous.raw)
        })
      }
    }
  }

  const distinct = new Map<string, any>()
  for (const invocation of invocations) {
    const key = [
      invocation.tool,
      invocation.operation,
      invocation.jobId,
      invocation.stepIndex
    ].join("|")
    if (!distinct.has(key)) distinct.set(key, invocation)
  }
  row.extraction.invocations = [...distinct.values()]

  const immutableExclusions = new Set([
    "REPOSITORY_INACCESSIBLE",
    "NOT_PUBLIC",
    "FORK",
    "MISSING_AT_DEFAULT_BRANCH",
    "PARSE_FAILURE"
  ])
  if (!immutableExclusions.has(row.exclusion)) {
    row.eligible = row.extraction.invocations.length > 0
    row.exclusion = row.eligible ? null : "NO_VISIBLE_INVOCATION"
  }
  return row
})

const output = normalized.map((row) => `${JSON.stringify(row)}\n`).join("")
writeFileSync(inputPath, output)
const summary = {
  normalizedAt: new Date().toISOString(),
  rows: normalized.length,
  eligibleRows: normalized.filter((row) => row.eligible).length,
  excludedRows: normalized.filter((row) => !row.eligible).length,
  invocationsBefore,
  invocationsAfter: normalized.reduce(
    (sum, row) => sum + Number(row.extraction?.invocations?.length ?? 0),
    0
  ),
  exclusions: Object.fromEntries(
    [...new Set(normalized.map((row) => row.exclusion).filter(Boolean))]
      .sort()
      .map((reason) => [
        reason,
        normalized.filter((row) => row.exclusion === reason).length
      ])
  ),
  sourceSha256: sha256(readFileSync(prePath)),
  outputSha256: sha256(output)
}
writeFileSync(normalizationPath, `${JSON.stringify(summary, null, 2)}\n`)
writeFileSync(
  completionPath,
  `${JSON.stringify(
    {
      completedAt: summary.normalizedAt,
      candidateRows: summary.rows,
      expectedCandidateRows: summary.rows,
      eligibleRows: summary.eligibleRows,
      excludedRows: summary.excludedRows,
      exclusions: summary.exclusions,
      normalizationApplied: true,
      outputSha256: summary.outputSha256
    },
    null,
    2
  )}\n`
)
process.stdout.write(
  `VALIDATION_NORMALIZED rows=${summary.rows} eligible=${summary.eligibleRows} invocations=${summary.invocationsBefore}->${summary.invocationsAfter}\n`
)
