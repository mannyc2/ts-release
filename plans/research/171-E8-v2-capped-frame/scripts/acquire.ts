import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const root = join(import.meta.dir, "..")
const rawDir = join(root, "raw")
const pageDir = join(rawDir, "query-pages")
const metadataPath = join(rawDir, "acquisition-metadata.json")
const intervalMs = 6_500

mkdirSync(pageDir, { recursive: true })

const tokenResult = Bun.spawnSync(["gh", "auth", "token"], {
  stdout: "pipe",
  stderr: "pipe"
})
if (tokenResult.exitCode !== 0) {
  throw new Error("Unable to read the existing gh credential")
}
const token = tokenResult.stdout.toString().trim()
if (token.length === 0) {
  throw new Error("The existing gh credential is empty")
}

const mainBases: ReadonlyArray<readonly [string, string]> = [
  ["goreleaser", "goreleaser path:.github/workflows"],
  ["semantic-release", "semantic-release path:.github/workflows"],
  ["changesets", "changeset path:.github/workflows"],
  ["release-please", "release-please path:.github/workflows"],
  ["release-it", "release-it path:.github/workflows"],
  ["jreleaser", "jreleaser path:.github/workflows"],
  ["cargo-dist", "cargo-dist path:.github/workflows"],
  ["cargo-dist", "\"cargo dist\" path:.github/workflows"],
  ["release-plz", "release-plz path:.github/workflows"],
  ["np", "\"npx np\" path:.github/workflows"],
  ["np", "\"bunx np\" path:.github/workflows"],
  ["np", "\"pnpm exec np\" path:.github/workflows"]
]

const tsReleaseBases: ReadonlyArray<readonly [string, string]> = [
  ["ts-release", "\"@mannyc1/ts-release\" path:.github/workflows"],
  ["ts-release", "\"mannyc2/ts-release-action\" path:.github/workflows"]
]

type Query = {
  queryId: string
  tool: string
  exactQ: string
  extension: "yml" | "yaml"
  tsReleaseExact: boolean
}

const queries: Array<Query> = []
for (const [tool, base] of [...mainBases, ...tsReleaseBases]) {
  for (const extension of ["yml", "yaml"] as const) {
    queries.push({
      queryId: `Q${String(queries.length + 1).padStart(3, "0")}`,
      tool,
      exactQ: `${base} extension:${extension}`,
      extension,
      tsReleaseExact: tool === "ts-release"
    })
  }
}

const now = () => new Date().toISOString()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const atomicJson = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, path)
}

const existingMetadata = (() => {
  try {
    return JSON.parse(readFileSync(metadataPath, "utf8"))
  } catch {
    return undefined
  }
})()

const metadata: Record<string, unknown> = {
  protocol:
    "plans/171-E8-v2-capped-frame-preregistration.md@0f64e85",
  protocolSha256:
    "5ce226afc05c947817a360de047e2b81619e6390d0cc5f5a598caa3182f2efa7",
  acquisitionStartedAt: existingMetadata?.acquisitionStartedAt ?? now(),
  acquisitionEndedAt: null,
  endpoint: "https://api.github.com/search/code",
  perPage: 100,
  maximumPagesPerQuery: 10,
  pacingMilliseconds: intervalMs,
  queries
}
atomicJson(metadataPath, metadata)

let lastRequestAt = 0
let usablePages = 0
let failedPages = 0

const requestPage = async (query: Query, page: number) => {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < intervalMs) {
    await sleep(intervalMs - elapsed)
  }

  const url = new URL("https://api.github.com/search/code")
  url.searchParams.set("q", query.exactQ)
  url.searchParams.set("per_page", "100")
  url.searchParams.set("page", String(page))

  let attempt = 0
  while (true) {
    const requestedAt = now()
    lastRequestAt = Date.now()
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "ts-release-E8-v2-capped-frame"
        }
      })
      const responseAt = now()
      const text = await response.text()
      let body: unknown
      try {
        body = JSON.parse(text)
      } catch {
        body = { unparsedBody: text.slice(0, 1_000) }
      }

      const pageRecord = {
        queryId: query.queryId,
        tool: query.tool,
        exactQ: query.exactQ,
        extension: query.extension,
        tsReleaseExact: query.tsReleaseExact,
        page,
        perPage: 100,
        requestedAt,
        responseAt,
        httpStatus: response.status,
        headers: {
          date: response.headers.get("date"),
          etag: response.headers.get("etag"),
          link: response.headers.get("link"),
          xRateLimitLimit: response.headers.get("x-ratelimit-limit"),
          xRateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
          xRateLimitReset: response.headers.get("x-ratelimit-reset"),
          xRateLimitResource: response.headers.get("x-ratelimit-resource")
        },
        attempt,
        body
      }

      if (response.ok) {
        return pageRecord
      }

      const retriable =
        response.status === 403 ||
        response.status === 429 ||
        response.status >= 500
      if (!retriable || attempt >= 5) {
        return pageRecord
      }

      const retryAfter = Number(response.headers.get("retry-after") ?? "0")
      const reset = Number(response.headers.get("x-ratelimit-reset") ?? "0")
      const resetWait = Math.max(0, reset * 1_000 - Date.now() + 1_000)
      const backoff = Math.max(
        retryAfter * 1_000,
        resetWait,
        Math.min(120_000, 10_000 * 2 ** attempt)
      )
      attempt += 1
      await sleep(backoff)
    } catch (error) {
      if (attempt >= 4) {
        return {
          queryId: query.queryId,
          tool: query.tool,
          exactQ: query.exactQ,
          extension: query.extension,
          tsReleaseExact: query.tsReleaseExact,
          page,
          perPage: 100,
          requestedAt,
          responseAt: now(),
          httpStatus: null,
          headers: {},
          attempt,
          error: error instanceof Error ? error.message : String(error),
          body: null
        }
      }
      attempt += 1
      await sleep(10_000 * attempt)
    }
  }
}

for (const query of queries) {
  let pagesRequested = 0
  let page = 1
  while (page <= 10) {
    const path = join(
      pageDir,
      `${query.queryId}-p${String(page).padStart(2, "0")}.json`
    )
    let record: any
    try {
      record = JSON.parse(readFileSync(path, "utf8"))
    } catch {
      record = await requestPage(query, page)
      atomicJson(path, record)
    }

    pagesRequested += 1
    if (record.httpStatus !== 200) {
      failedPages += 1
      break
    }

    usablePages += 1
    const items = Array.isArray(record.body?.items) ? record.body.items : []
    const totalCount = Number(record.body?.total_count ?? 0)
    if (items.length < 100 || page * 100 >= Math.min(totalCount, 1_000)) {
      break
    }
    page += 1
  }
  process.stdout.write(
    `${query.queryId} ${query.tool} ${query.extension}: ${pagesRequested} page(s)\n`
  )
}

metadata.acquisitionEndedAt = now()
metadata.usablePages = usablePages
metadata.failedPages = failedPages
atomicJson(metadataPath, metadata)

if (usablePages === 0) {
  throw new Error("STOP: no usable GitHub search page was acquired")
}

process.stdout.write(
  `ACQUISITION_COMPLETE usablePages=${usablePages} failedPages=${failedPages}\n`
)
