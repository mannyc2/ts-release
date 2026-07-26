import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const rawDir = join(root, "raw")
const pageDir = join(rawDir, "query-pages")
const derivedDir = join(root, "derived")
const metadataPath = join(rawDir, "acquisition-metadata.json")
const freezePath = join(rawDir, "frame-freeze.json")

if (existsSync(freezePath)) {
  throw new Error(`Raw frame already frozen at ${freezePath}`)
}

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"))
if (metadata.acquisitionEndedAt === null) {
  throw new Error("Acquisition has not completed")
}

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex")
const atomicWrite = (path: string, value: string) => {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, value)
  renameSync(temporary, path)
}
const jsonLine = (value: unknown) => `${JSON.stringify(value)}\n`

const files = readdirSync(pageDir)
  .filter((name) => name.endsWith(".json"))
  .sort()

const pageRecords = files.map((name) => {
  const bytes = readFileSync(join(pageDir, name))
  return {
    name,
    bytes,
    sha256: sha256(bytes),
    record: JSON.parse(bytes.toString("utf8"))
  }
})

const queryLedger: Array<Record<string, unknown>> = []
const flattened: Array<Record<string, unknown>> = []
const candidates = new Map<string, any>()

for (const { name, sha256: pageSha256, record } of pageRecords) {
  const items = Array.isArray(record.body?.items) ? record.body.items : []
  queryLedger.push({
    queryId: record.queryId,
    tool: record.tool,
    exactQ: record.exactQ,
    extension: record.extension,
    tsReleaseExact: record.tsReleaseExact,
    page: record.page,
    perPage: record.perPage,
    requestedAt: record.requestedAt,
    responseAt: record.responseAt,
    httpStatus: record.httpStatus,
    totalCount: record.body?.total_count ?? null,
    incompleteResults: record.body?.incomplete_results ?? null,
    returned: items.length,
    headers: record.headers,
    attempt: record.attempt,
    error: record.error ?? record.body?.message ?? null,
    rawFile: `raw/query-pages/${name}`,
    rawSha256: pageSha256
  })

  if (record.httpStatus !== 200) continue
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const repo = item.repository?.full_name ?? ""
    const path = item.path ?? ""
    const rank = (record.page - 1) * 100 + index + 1
    const observation = {
      queryId: record.queryId,
      tool: record.tool,
      exactQ: record.exactQ,
      extension: record.extension,
      page: record.page,
      rank,
      repo,
      repoId: item.repository?.id ?? null,
      path,
      name: item.name ?? null,
      blobSha: item.sha ?? null,
      apiUrl: item.url ?? null,
      gitUrl: item.git_url ?? null,
      htmlUrl: item.html_url ?? null,
      repoApiUrl: item.repository?.url ?? null,
      repoForkAtSearch: item.repository?.fork ?? null,
      collectedAt: record.responseAt
    }
    flattened.push(observation)

    const key = `${repo}:${path}`
    const existing = candidates.get(key) ?? {
      repo,
      path,
      repoId: item.repository?.id ?? null,
      queryIds: [],
      searchRanks: [],
      toolHints: [],
      blobShas: [],
      observations: [],
      pathLooksEligible:
        /^\.github\/workflows\/.+\.ya?ml$/i.test(path)
    }
    if (!existing.queryIds.includes(record.queryId)) {
      existing.queryIds.push(record.queryId)
    }
    existing.searchRanks.push({ queryId: record.queryId, rank })
    if (!existing.toolHints.includes(record.tool)) {
      existing.toolHints.push(record.tool)
    }
    if (item.sha && !existing.blobShas.includes(item.sha)) {
      existing.blobShas.push(item.sha)
    }
    existing.observations.push({
      queryId: record.queryId,
      rank,
      blobSha: item.sha ?? null,
      collectedAt: record.responseAt
    })
    candidates.set(key, existing)
  }
}

for (const candidate of candidates.values()) {
  candidate.queryIds.sort()
  candidate.toolHints.sort()
  candidate.searchRanks.sort((a: any, b: any) =>
    a.queryId.localeCompare(b.queryId) || a.rank - b.rank
  )
}

const queryCoverage = metadata.queries.map((query: any) => {
  const pages = queryLedger
    .filter((row) => row.queryId === query.queryId)
    .sort((a: any, b: any) => a.page - b.page)
  return {
    ...query,
    pagesAcquired: pages.map((row: any) => row.page),
    usablePages: pages.filter((row: any) => row.httpStatus === 200).length,
    failedPages: pages.filter((row: any) => row.httpStatus !== 200).length,
    accessibleResults: pages.reduce(
      (total: number, row: any) => total + Number(row.returned ?? 0),
      0
    ),
    reportedTotalCount: pages[0]?.totalCount ?? null,
    incompleteResults: pages.some(
      (row: any) => row.incompleteResults === true
    )
  }
})

atomicWrite(
  join(rawDir, "query-ledger.jsonl"),
  queryLedger.map(jsonLine).join("")
)
atomicWrite(
  join(rawDir, "search-results.jsonl"),
  flattened.map(jsonLine).join("")
)
atomicWrite(
  join(derivedDir, "candidate-pool.jsonl"),
  [...candidates.values()]
    .sort(
      (a, b) =>
        a.repo.localeCompare(b.repo, undefined, { sensitivity: "base" }) ||
        a.path.localeCompare(b.path, undefined, { sensitivity: "base" })
    )
    .map(jsonLine)
    .join("")
)

const freeze = {
  frozenAt: new Date().toISOString(),
  protocolCommit: "0f64e85",
  protocolSha256:
    "5ce226afc05c947817a360de047e2b81619e6390d0cc5f5a598caa3182f2efa7",
  acquisitionStartedAt: metadata.acquisitionStartedAt,
  acquisitionEndedAt: metadata.acquisitionEndedAt,
  rawPageFiles: pageRecords.length,
  usablePages: queryLedger.filter((row: any) => row.httpStatus === 200).length,
  failedPages: queryLedger.filter((row: any) => row.httpStatus !== 200).length,
  rawSearchRows: flattened.length,
  distinctRepoPaths: candidates.size,
  pathShapedCandidates: [...candidates.values()].filter(
    (candidate) => candidate.pathLooksEligible
  ).length,
  queryCoverage,
  pageChecksums: Object.fromEntries(
    pageRecords.map(({ name, sha256 }) => [
      `raw/query-pages/${name}`,
      sha256
    ])
  ),
  derivedChecksums: {
    "raw/query-ledger.jsonl": sha256(
      readFileSync(join(rawDir, "query-ledger.jsonl"))
    ),
    "raw/search-results.jsonl": sha256(
      readFileSync(join(rawDir, "search-results.jsonl"))
    ),
    "derived/candidate-pool.jsonl": sha256(
      readFileSync(join(derivedDir, "candidate-pool.jsonl"))
    )
  }
}
atomicWrite(freezePath, `${JSON.stringify(freeze, null, 2)}\n`)

process.stdout.write(
  `RAW_FRAME_FROZEN pages=${freeze.rawPageFiles} rows=${freeze.rawSearchRows} candidates=${freeze.distinctRepoPaths} pathCandidates=${freeze.pathShapedCandidates}\n`
)
