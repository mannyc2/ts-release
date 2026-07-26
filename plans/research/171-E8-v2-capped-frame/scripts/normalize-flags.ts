import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const invocationsPath = join(root, "derived", "invocations.jsonl")
const flagsPath = join(root, "derived", "flags-inputs.jsonl")
const invalidPath = join(
  root,
  "evidence",
  "invalid-flags-unscoped-run-block.jsonl"
)
const markerPath = join(root, "derived", "flags-normalized.json")
const firstCompletionPath = join(
  root,
  "derived",
  "first-coding-complete.json"
)
if (existsSync(markerPath)) throw new Error("Flags already normalized")

renameSync(flagsPath, invalidPath)
const invocations = readFileSync(invocationsPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))

const patterns: Record<string, RegExp> = {
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
const segments = (raw: string) =>
  raw
    .replace(/\\\r?\n\s*/g, " ")
    .split(/\r?\n|&&|\|\||;/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) =>
      segment.replace(
        /^(?:(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+))\s+)+/,
        ""
      )
    )

const locationGroups = new Map<string, any>()
for (const invocation of invocations) {
  const key = [
    invocation.repo,
    invocation.path,
    invocation.tool,
    invocation.jobId,
    invocation.stepIndex,
    invocation.source
  ].join("|")
  if (!locationGroups.has(key)) locationGroups.set(key, invocation)
}

const output: Array<any> = []
for (const invocation of locationGroups.values()) {
  const base = {
    repo: invocation.repo,
    path: invocation.path,
    tool: invocation.tool,
    jobId: invocation.jobId,
    stepIndex: invocation.stepIndex
  }
  for (const input of Object.keys(invocation.inputs ?? {})) {
    output.push({
      ...base,
      kind: "action-input",
      raw: input,
      normalized: input
    })
  }

  const raw =
    invocation.source === "package-script"
      ? String(invocation.raw ?? "").split("->").slice(1).join("->")
      : String(invocation.raw ?? "")
  const commandSources =
    invocation.source === "step-run" ||
    invocation.source === "package-script"
      ? segments(raw).filter((segment) =>
          patterns[invocation.tool]?.test(segment)
        )
      : Object.values(invocation.inputs ?? {}).map(String)
  for (const source of commandSources) {
    for (const match of source.matchAll(/--[A-Za-z][A-Za-z0-9-]*/g)) {
      output.push({
        ...base,
        kind: "cli-flag",
        raw: match[0],
        normalized: match[0]
      })
    }
  }
}

writeFileSync(
  flagsPath,
  output.map((row) => `${JSON.stringify(row)}\n`).join("")
)
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")
const marker = {
  normalizedAt: new Date().toISOString(),
  invocationLocations: locationGroups.size,
  coarseRows: readFileSync(invalidPath, "utf8").split("\n").filter(Boolean)
    .length,
  normalizedRows: output.length,
  method:
    "CLI flags are extracted only from the in-scope command segment or action-input values; action-input keys are retained separately.",
  coarseSha256: sha256(readFileSync(invalidPath)),
  outputSha256: sha256(readFileSync(flagsPath))
}
writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`)

const firstCompletion = JSON.parse(
  readFileSync(firstCompletionPath, "utf8")
)
firstCompletion.flagInputRows = output.length
firstCompletion.flagsNormalizedAt = marker.normalizedAt
firstCompletion.checksums["derived/flags-inputs.jsonl"] = marker.outputSha256
writeFileSync(
  firstCompletionPath,
  `${JSON.stringify(firstCompletion, null, 2)}\n`
)
process.stdout.write(
  `FLAGS_NORMALIZED rows=${marker.coarseRows}->${marker.normalizedRows}\n`
)
