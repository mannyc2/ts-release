import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { join } from "node:path"

const require = createRequire(import.meta.url)
const YAML = require(
  join(process.cwd(), "node_modules/.bun/node_modules/yaml")
)

const root = join(import.meta.dir, "..")
const candidatePath = join(root, "derived", "candidate-pool.jsonl")
const outputPath = join(root, "derived", "candidate-validation.jsonl")
const ledgerPath = join(root, "raw", "validation-query-ledger.jsonl")
const completionPath = join(root, "derived", "validation-complete.json")
const pacingMs = 750

if (!existsSync(join(root, "raw", "frame-freeze.json"))) {
  throw new Error("Raw frame must be frozen before validation")
}
if (existsSync(completionPath)) {
  throw new Error("Candidate validation is already complete")
}

const tokenResult = Bun.spawnSync(["gh", "auth", "token"], {
  stdout: "pipe",
  stderr: "pipe"
})
if (tokenResult.exitCode !== 0) {
  throw new Error("Unable to read the existing gh credential")
}
const token = tokenResult.stdout.toString().trim()
if (token.length === 0) throw new Error("Empty gh credential")

const now = () => new Date().toISOString()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex")
const lines = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))

const candidates = lines(candidatePath).filter(
  (candidate) => candidate.pathLooksEligible
)
const candidateByKey = new Map(
  candidates.map((candidate) => [
    `${candidate.repo}:${candidate.path}`,
    candidate
  ])
)

const completed = new Set<string>()
if (existsSync(outputPath)) {
  for (const row of lines(outputPath)) {
    completed.add(`${row.repo}:${row.path}`)
  }
}

type RepoUnit = {
  repo: string
  owner: string
  name: string
  paths: Array<string>
}

const byRepo = new Map<string, Array<string>>()
for (const candidate of candidates) {
  const key = `${candidate.repo}:${candidate.path}`
  if (completed.has(key)) continue
  const paths = byRepo.get(candidate.repo) ?? []
  paths.push(candidate.path)
  byRepo.set(candidate.repo, paths)
}

const units: Array<RepoUnit> = []
for (const [repo, paths] of [...byRepo.entries()].sort(([a], [b]) =>
  a.localeCompare(b, undefined, { sensitivity: "base" })
)) {
  const slash = repo.indexOf("/")
  const owner = repo.slice(0, slash)
  const name = repo.slice(slash + 1)
  paths.sort((a, b) => a.localeCompare(b))
  for (let offset = 0; offset < paths.length; offset += 25) {
    units.push({ repo, owner, name, paths: paths.slice(offset, offset + 25) })
  }
}

const batches: Array<Array<RepoUnit>> = []
let current: Array<RepoUnit> = []
let currentPaths = 0
for (const unit of units) {
  if (current.length >= 8 || currentPaths + unit.paths.length > 40) {
    batches.push(current)
    current = []
    currentPaths = 0
  }
  current.push(unit)
  currentPaths += unit.paths.length
}
if (current.length > 0) batches.push(current)

const graphqlQuery = (batch: Array<RepoUnit>) => {
  const repositories = batch.map((unit, repoIndex) => {
    const objects = unit.paths
      .map(
        (path, pathIndex) =>
          `w${pathIndex}: object(expression: ${JSON.stringify(
            `HEAD:${path}`
          )}) { ... on Blob { oid byteSize isBinary text } }`
      )
      .join("\n")
    return `r${repoIndex}: repository(owner: ${JSON.stringify(
      unit.owner
    )}, name: ${JSON.stringify(unit.name)}) {
      id
      nameWithOwner
      isFork
      isPrivate
      isArchived
      stargazerCount
      defaultBranchRef {
        name
        target { ... on Commit { oid committedDate } }
      }
      packageJson: object(expression: "HEAD:package.json") {
        ... on Blob { oid byteSize isBinary text }
      }
      ${objects}
    }`
  })
  return `query E8Validation {\n${repositories.join("\n")}\n}`
}

let lastRequestAt = 0
const requestGraphql = async (
  query: string,
  batchId: string,
  batch: Array<RepoUnit>
) => {
  let attempt = 0
  while (true) {
    const elapsed = Date.now() - lastRequestAt
    if (elapsed < pacingMs) await sleep(pacingMs - elapsed)
    const requestedAt = now()
    lastRequestAt = Date.now()
    try {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "ts-release-E8-v2-validation"
        },
        body: JSON.stringify({ query })
      })
      const responseAt = now()
      const text = await response.text()
      let body: any
      try {
        body = JSON.parse(text)
      } catch {
        body = { errors: [{ message: text.slice(0, 1_000) }] }
      }
      appendFileSync(
        ledgerPath,
        `${JSON.stringify({
          batchId,
          requestedAt,
          responseAt,
          httpStatus: response.status,
          attempt,
          repos: batch.map((unit) => unit.repo),
          candidatePaths: batch.reduce(
            (count, unit) => count + unit.paths.length,
            0
          ),
          querySha256: sha256(query),
          errors: body.errors ?? [],
          headers: {
            date: response.headers.get("date"),
            xRateLimitLimit: response.headers.get("x-ratelimit-limit"),
            xRateLimitRemaining: response.headers.get(
              "x-ratelimit-remaining"
            ),
            xRateLimitReset: response.headers.get("x-ratelimit-reset"),
            xRateLimitResource: response.headers.get("x-ratelimit-resource")
          }
        })}\n`
      )
      if (response.ok && body.data) return body

      if (
        (response.status === 403 ||
          response.status === 429 ||
          response.status >= 500) &&
        attempt < 5
      ) {
        const reset = Number(
          response.headers.get("x-ratelimit-reset") ?? "0"
        )
        const resetWait = Math.max(0, reset * 1_000 - Date.now() + 1_000)
        attempt += 1
        await sleep(
          Math.max(resetWait, Math.min(120_000, 10_000 * 2 ** attempt))
        )
        continue
      }
      return body
    } catch (error) {
      appendFileSync(
        ledgerPath,
        `${JSON.stringify({
          batchId,
          requestedAt,
          responseAt: now(),
          httpStatus: null,
          attempt,
          repos: batch.map((unit) => unit.repo),
          querySha256: sha256(query),
          error: error instanceof Error ? error.message : String(error)
        })}\n`
      )
      if (attempt >= 4) return { data: null, transportError: String(error) }
      attempt += 1
      await sleep(10_000 * attempt)
    }
  }
}

const toolPatterns: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "ts-release",
    /@mannyc1\/ts-release|mannyc2\/ts-release-action|(?:^|[\s"'`/])ts-release(?:[\s"'`@]|$)/i
  ],
  ["goreleaser", /goreleaser/i],
  [
    "semantic-release",
    /semantic-release|cycjimmy\/semantic-release-action|codfish\/semantic-release-action|go-semantic-release\/action/i
  ],
  ["changesets", /changesets?|@changesets\/cli/i],
  ["release-please", /release-please/i],
  ["release-it", /release-it/i],
  ["jreleaser", /jreleaser/i],
  [
    "cargo-dist",
    /cargo-dist|\bcargo\s+dist\b|\bdist\s+(?:plan|build|host|generate|manifest)\b/i
  ],
  ["release-plz", /release-plz/i],
  ["np", /(?:npx|bunx|pnpm\s+exec)\s+np(?:\s|$)/i]
]

const toolsIn = (value: string) =>
  toolPatterns
    .filter(([, pattern]) => pattern.test(value))
    .map(([tool]) => tool)

const isInvocationShape = (
  tool: string,
  raw: string,
  source: "uses" | "run"
) => {
  if (source === "uses") return true
  if (tool !== "cargo-dist") return true
  return (
    /\bcargo\s+dist\s+(?:plan|build|host|generate|manifest)\b/i.test(raw) ||
    /\bdist\s+(?:plan|build|host|generate|manifest)\b/i.test(raw) ||
    /(?:^|[\s;&|])cargo-dist(?:\s|$)/i.test(raw)
  )
}

const operationFor = (
  tool: string,
  raw: string,
  inputs: Record<string, unknown> = {}
) => {
  const inputText = Object.values(inputs).join(" ")
  const text = `${raw} ${inputText}`
  switch (tool) {
    case "goreleaser":
      return (
        text.match(
          /\bgoreleaser(?:\s+|\/)(release|build|check|healthcheck|init)\b/i
        )?.[1]?.toLowerCase() ?? "release"
      )
    case "semantic-release":
      return "release"
    case "changesets":
      return (
        text.match(
          /\bchangesets?(?:\/cli)?\s+(version|publish|status|pre|add)\b/i
        )?.[1]?.toLowerCase() ??
        (Object.prototype.hasOwnProperty.call(inputs, "publish")
          ? "version_or_publish"
          : "version_or_publish")
      )
    case "release-please":
      return (
        text.match(
          /\brelease-please\s+(release-pr|github-release|manifest-pr)\b/i
        )?.[1]?.toLowerCase() ?? "release_pr_or_release"
      )
    case "release-it":
      return "release"
    case "jreleaser":
      return (
        text.match(
          /\bjreleaser\s+(full-release|assemble|changelog|catalog|deploy|release|announce|config|download|upload|sign|checksum|sbom)\b/i
        )?.[1]?.toLowerCase() ?? "release"
      )
    case "cargo-dist":
      return (
        text.match(
          /\bcargo\s+dist\s+(plan|build|host|generate|manifest)\b/i
        )?.[1]?.toLowerCase() ??
        text.match(/\bdist\s+(plan|build|host|generate|manifest)\b/i)?.[1]?.toLowerCase() ??
        "release"
      )
    case "release-plz":
      return (
        text.match(/\brelease-plz\s+(release|release-pr|update)\b/i)?.[1]?.toLowerCase() ??
        "release"
      )
    case "np":
      return "release"
    case "ts-release":
      return (
        text.match(
          /\bts-release\s+(init|doctor|build|plan|release|verify|apply)\b/i
        )?.[1]?.toLowerCase() ?? "unknown"
      )
    default:
      return "unknown"
  }
}

const compact = (value: unknown, maximum = 4_000) => {
  if (value === undefined || value === null) return null
  const text =
    typeof value === "string" ? value : JSON.stringify(value)
  return text.length > maximum ? `${text.slice(0, maximum)}…` : text
}

const extractWorkflow = (text: string, packageText: string | null) => {
  let parsed: any
  try {
    parsed = YAML.parse(text)
  } catch (error) {
    return {
      parseStatus: "PARSE_FAILURE",
      parseError: error instanceof Error ? error.message : String(error),
      triggers: null,
      permissions: null,
      concurrency: null,
      jobs: [],
      invocations: []
    }
  }

  let packageScripts: Record<string, string> = {}
  if (packageText) {
    try {
      const packageJson = JSON.parse(packageText)
      if (packageJson?.scripts && typeof packageJson.scripts === "object") {
        packageScripts = packageJson.scripts
      }
    } catch {
      packageScripts = {}
    }
  }

  const invocations: Array<any> = []
  const jobs: Array<any> = []
  const parsedJobs =
    parsed?.jobs && typeof parsed.jobs === "object" ? parsed.jobs : {}

  for (const [jobId, rawJob] of Object.entries(parsedJobs)) {
    const job: any = rawJob ?? {}
    const jobRecord: any = {
      jobId,
      name: compact(job.name),
      if: compact(job.if),
      needs: Array.isArray(job.needs)
        ? job.needs.map(String)
        : job.needs
          ? [String(job.needs)]
          : [],
      permissions: job.permissions ?? null,
      environment: job.environment ?? null,
      concurrency: job.concurrency ?? null,
      uses: compact(job.uses),
      with: job.with ?? null,
      steps: []
    }

    if (typeof job.uses === "string") {
      for (const tool of toolsIn(job.uses)) {
        invocations.push({
          tool,
          operation: operationFor(tool, job.uses, job.with ?? {}),
          source: "job-uses",
          jobId,
          stepIndex: null,
          raw: compact(job.uses),
          inputs: job.with ?? {}
        })
      }
    }

    const steps = Array.isArray(job.steps) ? job.steps : []
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      const step: any = steps[stepIndex] ?? {}
      const run = typeof step.run === "string" ? step.run : ""
      const uses = typeof step.uses === "string" ? step.uses : ""
      const withInputs =
        step.with && typeof step.with === "object" ? step.with : {}
      const combined = `${uses}\n${run}\n${JSON.stringify(withInputs)}`
      const stepRecord = {
        stepIndex,
        name: compact(step.name),
        if: compact(step.if),
        uses: compact(uses),
        run: compact(run),
        with: withInputs,
        workingDirectory:
          step["working-directory"] ?? step.workingDirectory ?? null
      }
      jobRecord.steps.push(stepRecord)

      const directlyInvokedTools = [
        ...new Set([
          ...toolsIn(uses).filter((tool) =>
            isInvocationShape(tool, uses, "uses")
          ),
          ...toolsIn(run).filter((tool) =>
            isInvocationShape(tool, run, "run")
          )
        ])
      ]
      for (const tool of directlyInvokedTools) {
        invocations.push({
          tool,
          operation: operationFor(tool, combined, withInputs),
          source: uses ? "step-uses" : "step-run",
          jobId,
          stepIndex,
          raw: compact(uses || run),
          inputs: withInputs
        })
      }

      const scriptMatches = [
        ...run.matchAll(
          /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([A-Za-z0-9:_-]+)\b/g
        )
      ]
      for (const match of scriptMatches) {
        const scriptName = match[1]
        const script = packageScripts[scriptName]
        if (!script) continue
        for (const tool of toolsIn(script)) {
          invocations.push({
            tool,
            operation: operationFor(tool, script),
            source: "package-script",
            jobId,
            stepIndex,
            raw: compact(`${match[0]} -> ${script}`),
            inputs: {},
            packageScript: scriptName
          })
        }
      }
    }
    jobs.push(jobRecord)
  }

  const distinct = new Map<string, any>()
  for (const invocation of invocations) {
    const key = [
      invocation.tool,
      invocation.operation,
      invocation.jobId,
      invocation.stepIndex
    ].join("|")
    distinct.set(key, invocation)
  }

  return {
    parseStatus: "PARSED",
    parseError: null,
    name: compact(parsed?.name),
    triggers: parsed?.on ?? null,
    permissions: parsed?.permissions ?? null,
    concurrency: parsed?.concurrency ?? null,
    jobs,
    invocations: [...distinct.values()]
  }
}

let processed = completed.size
for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
  const batch = batches[batchIndex]
  const batchId = `V${String(batchIndex + 1).padStart(5, "0")}`
  const query = graphqlQuery(batch)
  const response = await requestGraphql(query, batchId, batch)
  if (!response.data) {
    throw new Error(
      `Validation API returned no data for ${batchId}: ${JSON.stringify(
        response.errors ?? response.transportError ?? "unknown error"
      )}`
    )
  }

  for (let repoIndex = 0; repoIndex < batch.length; repoIndex += 1) {
    const unit = batch[repoIndex]
    const repository = response.data?.[`r${repoIndex}`] ?? null
    const metadataRetrievedAt = now()
    for (let pathIndex = 0; pathIndex < unit.paths.length; pathIndex += 1) {
      const path = unit.paths[pathIndex]
      const candidate = candidateByKey.get(`${unit.repo}:${path}`)
      const blob = repository?.[`w${pathIndex}`] ?? null
      const packageBlob = repository?.packageJson ?? null

      let exclusion: string | null = null
      if (!repository) exclusion = "REPOSITORY_INACCESSIBLE"
      else if (repository.isPrivate) exclusion = "NOT_PUBLIC"
      else if (repository.isFork) exclusion = "FORK"
      else if (!blob?.text) exclusion = "MISSING_AT_DEFAULT_BRANCH"

      const extraction =
        !exclusion && blob?.text
          ? extractWorkflow(blob.text, packageBlob?.text ?? null)
          : {
              parseStatus: "NOT_PARSED",
              parseError: null,
              triggers: null,
              permissions: null,
              concurrency: null,
              jobs: [],
              invocations: []
            }

      if (!exclusion && extraction.parseStatus === "PARSE_FAILURE") {
        exclusion = "PARSE_FAILURE"
      }
      if (!exclusion && extraction.invocations.length === 0) {
        exclusion = "NO_VISIBLE_INVOCATION"
      }

      const record = {
        repo: unit.repo,
        path,
        repoId: repository?.id ?? candidate?.repoId ?? null,
        public: repository ? !repository.isPrivate : null,
        fork: repository?.isFork ?? null,
        archived: repository?.isArchived ?? null,
        defaultBranch: repository?.defaultBranchRef?.name ?? null,
        defaultBranchCommitSha:
          repository?.defaultBranchRef?.target?.oid ?? null,
        defaultBranchCommitDate:
          repository?.defaultBranchRef?.target?.committedDate ?? null,
        blobSha: blob?.oid ?? null,
        searchBlobShas: candidate?.blobShas ?? [],
        metadataRace:
          blob?.oid && candidate?.blobShas
            ? !candidate.blobShas.includes(blob.oid)
            : null,
        immutableUrl:
          repository?.defaultBranchRef?.target?.oid
            ? `https://github.com/${unit.repo}/blob/${repository.defaultBranchRef.target.oid}/${path}`
            : null,
        starsAtRetrieval: repository?.stargazerCount ?? null,
        metadataRetrievedAt,
        queryIds: candidate?.queryIds ?? [],
        searchRanks: candidate?.searchRanks ?? [],
        toolHints: candidate?.toolHints ?? [],
        collectedAt:
          candidate?.observations
            ?.map((observation: any) => observation.collectedAt)
            .filter(Boolean)
            .sort()[0] ?? null,
        contentSha256: blob?.text ? sha256(blob.text) : null,
        contentBytes: blob?.byteSize ?? null,
        packageJsonBlobSha: packageBlob?.oid ?? null,
        eligible: exclusion === null,
        exclusion,
        extraction
      }
      appendFileSync(outputPath, `${JSON.stringify(record)}\n`)
      processed += 1
    }
  }
  if ((batchIndex + 1) % 25 === 0) {
    process.stdout.write(
      `${batchId} batches=${batchIndex + 1}/${batches.length} candidates=${processed}/${candidates.length}\n`
    )
  }
}

const finalRows = lines(outputPath)
const summary = {
  completedAt: now(),
  candidateRows: finalRows.length,
  expectedCandidateRows: candidates.length,
  eligibleRows: finalRows.filter((row) => row.eligible).length,
  excludedRows: finalRows.filter((row) => !row.eligible).length,
  exclusions: Object.fromEntries(
    [...new Set(finalRows.map((row) => row.exclusion).filter(Boolean))]
      .sort()
      .map((reason) => [
        reason,
        finalRows.filter((row) => row.exclusion === reason).length
      ])
  ),
  validationLedgerRows: existsSync(ledgerPath) ? lines(ledgerPath).length : 0,
  outputSha256: sha256(readFileSync(outputPath, "utf8"))
}
writeFileSync(completionPath, `${JSON.stringify(summary, null, 2)}\n`)
process.stdout.write(
  `VALIDATION_COMPLETE candidates=${summary.candidateRows} eligible=${summary.eligibleRows} excluded=${summary.excludedRows}\n`
)
