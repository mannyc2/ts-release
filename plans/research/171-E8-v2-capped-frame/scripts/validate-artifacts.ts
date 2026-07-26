import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { join, relative } from "node:path"

const root = join(import.meta.dir, "..")
const repoRoot = join(root, "../../..")
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"))
const readLines = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
const assertionResults: Array<any> = []
const check = (name: string, condition: boolean, detail: unknown) => {
  assertionResults.push({ name, passed: condition, detail })
  if (!condition) throw new Error(`${name}: ${JSON.stringify(detail)}`)
}

const protocolPath = join(
  repoRoot,
  "plans",
  "171-E8-v2-capped-frame-preregistration.md"
)
check(
  "protocol_sha256",
  sha256(readFileSync(protocolPath)) ===
    "5ce226afc05c947817a360de047e2b81619e6390d0cc5f5a598caa3182f2efa7",
  sha256(readFileSync(protocolPath))
)

const frame = readJson(join(root, "raw", "frame-freeze.json"))
const pageNames = readdirSync(join(root, "raw", "query-pages"))
  .filter((name) => name.endsWith(".json"))
  .sort()
check("query_count", frame.queryCoverage.length === 28, frame.queryCoverage.length)
check("page_count", pageNames.length === 157, pageNames.length)
check("usable_pages", frame.usablePages === 157, frame.usablePages)
check("failed_pages", frame.failedPages === 0, frame.failedPages)
for (const name of pageNames) {
  const path = join(root, "raw", "query-pages", name)
  const record = readJson(path)
  check(`page_http_200:${name}`, record.httpStatus === 200, record.httpStatus)
  check(
    `page_checksum:${name}`,
    frame.pageChecksums[`raw/query-pages/${name}`] ===
      sha256(readFileSync(path)),
    name
  )
}

const searchRows = readLines(join(root, "raw", "search-results.jsonl"))
const pool = readLines(join(root, "derived", "candidate-pool.jsonl"))
const validation = readLines(
  join(root, "derived", "candidate-validation.jsonl")
)
check("raw_search_rows", searchRows.length === 14_432, searchRows.length)
check("candidate_pool_rows", pool.length === 14_186, pool.length)
check("validation_rows", validation.length === 14_186, validation.length)
check(
  "eligible_validation_rows",
  validation.filter((row) => row.eligible).length === 8_829,
  validation.filter((row) => row.eligible).length
)

const manifestFreeze = readJson(
  join(root, "derived", "manifest-freeze.json")
)
const manifest = readLines(join(root, "derived", "manifest.jsonl"))
const winners = readLines(
  join(root, "derived", "repository-winners.jsonl")
)
check("manifest_rows", manifest.length === 517, manifest.length)
check(
  "manifest_unique_repositories",
  new Set(manifest.map((row) => row.repo)).size === manifest.length,
  new Set(manifest.map((row) => row.repo)).size
)
check(
  "manifest_checksum",
  manifestFreeze.checksums["derived/manifest.jsonl"] ===
    sha256(readFileSync(join(root, "derived", "manifest.jsonl"))),
  manifestFreeze.checksums["derived/manifest.jsonl"]
)

const seed = "E8-v2|capped-github-code-search|selection-v1"
const bandOf = (stars: number) =>
  stars < 50 ? "B1" : stars < 500 ? "B2" : stars < 5_000 ? "B3" : "B4"
const expectedByBand = new Map<string, Array<any>>()
for (const winner of winners) {
  const band = bandOf(winner.starsAtRetrieval)
  const rows = expectedByBand.get(band) ?? []
  rows.push({
    repo: winner.repo,
    path: winner.path,
    digest: sha256(`${seed}\n${winner.repo}:${winner.path}`)
  })
  expectedByBand.set(band, rows)
}
for (const band of ["B1", "B2", "B3", "B4"]) {
  const expected = (expectedByBand.get(band) ?? [])
    .sort(
      (a, b) =>
        a.digest.localeCompare(b.digest) ||
        `${a.repo}:${a.path}`
          .toLowerCase()
          .localeCompare(`${b.repo}:${b.path}`.toLowerCase()) ||
        Buffer.from(`${a.repo}:${a.path}`).compare(
          Buffer.from(`${b.repo}:${b.path}`)
        )
    )
    .slice(0, 150)
    .map((row) => `${row.repo}:${row.path}`)
    .sort()
  const actual = manifest
    .filter((row) => row.starBand === band)
    .map((row) => `${row.repo}:${row.path}`)
    .sort()
  check(
    `deterministic_band_selection:${band}`,
    JSON.stringify(actual) === JSON.stringify(expected),
    { expected: expected.length, actual: actual.length }
  )
}

const coding = readLines(
  join(root, "derived", "workflow-coding-final.jsonl")
)
check("coding_rows", coding.length === manifest.length, coding.length)
check(
  "coding_manifest_keys",
  JSON.stringify(
    coding.map((row) => `${row.repo}:${row.path}`).sort()
  ) ===
    JSON.stringify(
      manifest.map((row) => `${row.repo}:${row.path}`).sort()
    ),
  coding.length
)
const shapeCounts = Object.fromEntries(
  ["SINGLE_VERB", "PLAN_THEN_ACT", "INDEPENDENT_VERBS", "OTHER"].map(
    (shape) => [
      shape,
      coding.filter((row) => row.shape.headlineClass === shape).length
    ]
  )
)
check(
  "shape_counts",
  JSON.stringify(shapeCounts) ===
    JSON.stringify({
      SINGLE_VERB: 430,
      PLAN_THEN_ACT: 69,
      INDEPENDENT_VERBS: 1,
      OTHER: 17
    }),
  shapeCounts
)
check(
  "confirmed_manual_count",
  coding.filter((row) => row.manualGate.confirmedManual).length === 71,
  coding.filter((row) => row.manualGate.confirmedManual).length
)

const recodeKeys = readJson(
  join(root, "derived", "recode-subset-keys.json")
)
const recodeSecond = readLines(join(root, "derived", "recode-second.jsonl"))
const rubric = readJson(
  join(root, "measurements", "rubric-stability.json")
)
check("recode_subset_rows", recodeKeys.subsetN === 51, recodeKeys.subsetN)
check("recode_second_rows", recodeSecond.length === 51, recodeSecond.length)
check("recode_disagreements", rubric.disagreements === 0, rubric)

const analysis = readJson(join(root, "measurements", "analysis.json"))
check("analysis_n", analysis.achieved.total === 517, analysis.achieved.total)
check(
  "threshold_eligible",
  analysis.thresholds.eligible === true,
  analysis.thresholds
)
check(
  "ts_release_accessible_zero",
  analysis.tsRelease.accessibleRawSearchRows === 0 &&
    analysis.tsRelease.eligibleInvocationMatches === 0,
  analysis.tsRelease
)

const walk = (directory: string): Array<string> =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
const indexExclusions = new Set([
  join(root, "measurements", "artifact-index.json"),
  join(root, "measurements", "artifact-validation.json")
])
const files = walk(root)
  .filter((path) => !indexExclusions.has(path))
  .sort()
const artifactIndex = {
  generatedAt: new Date().toISOString(),
  root: "plans/research/171-E8-v2-capped-frame",
  files: files.map((path) => {
    const bytes = readFileSync(path)
    return {
      path: relative(root, path),
      bytes: bytes.length,
      sha256: sha256(bytes)
    }
  })
}
writeFileSync(
  join(root, "measurements", "artifact-index.json"),
  `${JSON.stringify(artifactIndex, null, 2)}\n`
)
const validationResult = {
  validatedAt: new Date().toISOString(),
  status: "PASS",
  assertions: assertionResults.length,
  results: assertionResults,
  indexedFiles: artifactIndex.files.length,
  indexedBytes: artifactIndex.files.reduce(
    (total, file) => total + file.bytes,
    0
  )
}
writeFileSync(
  join(root, "measurements", "artifact-validation.json"),
  `${JSON.stringify(validationResult, null, 2)}\n`
)
process.stdout.write(
  `ARTIFACT_VALIDATION_PASS assertions=${validationResult.assertions} files=${validationResult.indexedFiles} bytes=${validationResult.indexedBytes}\n`
)
