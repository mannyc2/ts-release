import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const validationPath = join(root, "derived", "candidate-validation.jsonl")
const validationCompletePath = join(
  root,
  "derived",
  "validation-complete.json"
)
const winnersPath = join(root, "derived", "repository-winners.jsonl")
const auditPath = join(root, "derived", "within-repo-selection.jsonl")
const manifestPath = join(root, "derived", "manifest.jsonl")
const manifestCsvPath = join(root, "derived", "manifest.csv")
const recodeKeysPath = join(root, "derived", "recode-subset-keys.json")
const freezePath = join(root, "derived", "manifest-freeze.json")
const seed = "E8-v2|capped-github-code-search|selection-v1"

if (!existsSync(validationCompletePath)) {
  throw new Error("Candidate validation must complete before manifest freeze")
}
if (existsSync(freezePath)) {
  throw new Error("Manifest is already frozen")
}

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")
const digestFor = (repo: string, path: string) =>
  sha256(`${seed}\n${repo}:${path}`)
const atomicWrite = (path: string, value: string) => {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, value)
  renameSync(temporary, path)
}
const lines = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
const jsonLines = (rows: Array<unknown>) =>
  rows.map((row) => `${JSON.stringify(row)}\n`).join("")
const csv = (value: unknown) => {
  if (value === null || value === undefined) return ""
  const text =
    typeof value === "string" ? value : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}

const rows = lines(validationPath)
const eligible = rows.filter((row) => row.eligible)
const byRepo = new Map<string, Array<any>>()
for (const row of eligible) {
  const group = byRepo.get(row.repo) ?? []
  group.push(row)
  byRepo.set(row.repo, group)
}

const winners: Array<any> = []
const audit: Array<any> = []
for (const [repo, group] of [...byRepo.entries()].sort(([a], [b]) =>
  a.localeCompare(b, undefined, { sensitivity: "base" })
)) {
  const ranked = group
    .map((row) => ({
      row,
      invocationCount: row.extraction.invocations.length
    }))
    .sort(
      (a, b) =>
        b.invocationCount - a.invocationCount ||
        a.row.path.length - b.row.path.length ||
        a.row.path.localeCompare(b.row.path)
    )
  const winner = ranked[0]
  winners.push(winner.row)
  for (let index = 0; index < ranked.length; index += 1) {
    audit.push({
      repo,
      path: ranked[index].row.path,
      invocationCount: ranked[index].invocationCount,
      rankWithinRepo: index + 1,
      retained: index === 0,
      tieBreak: "invocationCount_desc,pathLength_asc,path_lexicographic"
    })
  }
}

const starBand = (stars: number) => {
  if (stars < 50) return "B1"
  if (stars < 500) return "B2"
  if (stars < 5_000) return "B3"
  return "B4"
}

const banded = winners.map((row) => {
  const toolSet = [
    ...new Set(row.extraction.invocations.map((invocation: any) => invocation.tool))
  ].sort()
  return {
    repo: row.repo,
    path: row.path,
    defaultBranchCommitSha: row.defaultBranchCommitSha,
    blobSha: row.blobSha,
    immutableUrl: row.immutableUrl,
    starsAtRetrieval: row.starsAtRetrieval,
    starBand: starBand(row.starsAtRetrieval),
    queryIds: row.queryIds,
    searchRanks: row.searchRanks,
    toolSet,
    collectedAt: row.collectedAt,
    metadataRetrievedAt: row.metadataRetrievedAt,
    selectionDigest: digestFor(row.repo, row.path),
    invocationCount: row.extraction.invocations.length,
    contentSha256: row.contentSha256,
    metadataRace: row.metadataRace
  }
})

const selected: Array<any> = []
const bandSummary: Record<string, any> = {}
for (const band of ["B1", "B2", "B3", "B4"]) {
  const candidates = banded
    .filter((row) => row.starBand === band)
    .sort(
      (a, b) =>
        a.selectionDigest.localeCompare(b.selectionDigest) ||
        `${a.repo}:${a.path}`
          .toLowerCase()
          .localeCompare(`${b.repo}:${b.path}`.toLowerCase()) ||
        Buffer.from(`${a.repo}:${a.path}`).compare(
          Buffer.from(`${b.repo}:${b.path}`)
        )
    )
  const retained = candidates.slice(0, 150)
  selected.push(...retained)
  bandSummary[band] = {
    eligibleRepositoryWinners: candidates.length,
    selected: retained.length,
    quota: 150,
    shortfall: 150 - retained.length
  }
}

selected.sort(
  (a, b) =>
    a.starBand.localeCompare(b.starBand) ||
    a.selectionDigest.localeCompare(b.selectionDigest)
)

atomicWrite(winnersPath, jsonLines(winners))
atomicWrite(auditPath, jsonLines(audit))
atomicWrite(manifestPath, jsonLines(selected))

const headers = [
  "repo",
  "path",
  "defaultBranchCommitSha",
  "blobSha",
  "immutableUrl",
  "starsAtRetrieval",
  "starBand",
  "queryIds",
  "searchRanks",
  "toolSet",
  "collectedAt",
  "metadataRetrievedAt",
  "selectionDigest",
  "invocationCount",
  "contentSha256",
  "metadataRace"
]
atomicWrite(
  manifestCsvPath,
  `${headers.join(",")}\n${selected
    .map((row) => headers.map((header) => csv(row[header])).join(","))
    .join("\n")}\n`
)

const repoPathSorted = [...selected].sort(
  (a, b) =>
    a.repo.localeCompare(b.repo, undefined, { sensitivity: "base" }) ||
    a.path.localeCompare(b.path, undefined, { sensitivity: "base" })
)
const recodeSubset = repoPathSorted
  .filter((_, index) => (index + 1) % 10 === 0)
  .map((row, subsetIndex) => ({
    subsetIndex: subsetIndex + 1,
    manifestSortRow: (subsetIndex + 1) * 10,
    repo: row.repo,
    path: row.path,
    immutableUrl: row.immutableUrl,
    contentSha256: row.contentSha256
  }))
atomicWrite(
  recodeKeysPath,
  `${JSON.stringify(
    {
      method: "every tenth row beginning with row 10 after repo:path sort",
      achievedN: selected.length,
      subsetN: recodeSubset.length,
      rows: recodeSubset
    },
    null,
    2
  )}\n`
)

const freeze = {
  frozenAt: new Date().toISOString(),
  protocolCommit: "0f64e85",
  seed,
  validatedCandidates: rows.length,
  eligibleCandidates: eligible.length,
  eligibleRepositories: winners.length,
  selectedRows: selected.length,
  bandSummary,
  representedTools: [...new Set(selected.flatMap((row) => row.toolSet))].sort(),
  recodeSubsetRows: recodeSubset.length,
  checksums: {
    "derived/candidate-validation.jsonl": sha256(
      readFileSync(validationPath)
    ),
    "derived/repository-winners.jsonl": sha256(
      readFileSync(winnersPath)
    ),
    "derived/within-repo-selection.jsonl": sha256(
      readFileSync(auditPath)
    ),
    "derived/manifest.jsonl": sha256(readFileSync(manifestPath)),
    "derived/manifest.csv": sha256(readFileSync(manifestCsvPath)),
    "derived/recode-subset-keys.json": sha256(
      readFileSync(recodeKeysPath)
    )
  }
}
atomicWrite(freezePath, `${JSON.stringify(freeze, null, 2)}\n`)
process.stdout.write(
  `MANIFEST_FROZEN selected=${selected.length} bands=${JSON.stringify(
    bandSummary
  )} tools=${freeze.representedTools.length} recode=${recodeSubset.length}\n`
)
