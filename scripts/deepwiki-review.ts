import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { performance } from "node:perf_hooks"

const endpoint = "https://mcp.deepwiki.com/mcp"
const wikiRepo = "Effect-TS/effect-smol"
const outputRoot = "plans/research/deepwiki-sweep"
const responseRoot = join(outputRoot, "responses")
const promptPath = "scripts/deepwiki-prompt.md"
const probePromptPath = "scripts/deepwiki-probe-prompt.md"
const effectPinRoot = ".repos/effect"
const effectVersion = "4.0.0-beta.83"

interface ManifestEntry {
  readonly path: string
  readonly sourceSha256: string
  readonly promptVersion: string
  readonly status: "ok" | "failed" | "skipped-too-large"
  readonly responseFile: string
  readonly askedAt: string
  readonly latencyMs: number
  readonly error?: string
}

interface ProbeSpec {
  readonly id: string
  readonly families: ReadonlyArray<string>
  readonly files: ReadonlyArray<string>
  readonly lines?: string
  readonly mechanic: string
  readonly snippet: string
}

interface ProbeManifestEntry {
  readonly id: string
  readonly probeSha256: string
  readonly promptVersion: string
  readonly status: "ok" | "failed" | "skipped-too-large"
  readonly responseFile: string
  readonly askedAt: string
  readonly latencyMs: number
  readonly error?: string
}

interface ParsedArgs {
  readonly dryRun: boolean
  readonly pilot: boolean
  readonly calibrate: boolean
  readonly index: boolean
  readonly probes: boolean
  readonly paths: ReadonlyArray<string>
  readonly force: ReadonlySet<string>
}

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2)
  const paths: Array<string> = []
  const force = new Set<string>()
  let dryRun = false
  let pilot = false
  let calibrate = false
  let index = false
  let probes = false
  for (let indexArg = 0; indexArg < args.length; indexArg += 1) {
    const arg = args[indexArg]
    if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--pilot") {
      pilot = true
    } else if (arg === "--calibrate") {
      calibrate = true
    } else if (arg === "--index") {
      index = true
    } else if (arg === "--probes") {
      probes = true
    } else if (arg === "--paths") {
      const value = args[indexArg + 1]
      if (value === undefined) throw new Error("--paths requires a value")
      paths.push(...value.split(",").map((item) => item.trim()).filter((item) => item.length > 0))
      indexArg += 1
    } else if (arg === "--force") {
      const value = args[indexArg + 1]
      if (value === undefined) throw new Error("--force requires a value")
      force.add(value)
      indexArg += 1
    } else if (arg !== undefined) {
      paths.push(arg)
    }
  }
  return { dryRun, pilot, calibrate, index, probes, paths, force }
}

const sha256 = (text: string): string =>
  createHash("sha256").update(text).digest("hex")

const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis))

const runGit = async (args: ReadonlyArray<string>): Promise<string> => {
  const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr}`)
  }
  return stdout.trimEnd()
}

const gitFiles = async (): Promise<ReadonlyArray<string>> =>
  (await runGit(["ls-files"])).split("\n").filter((path) => path.length > 0)

const isSourceFile = (path: string): boolean =>
  path.endsWith(".ts") &&
  !path.endsWith(".test.ts") &&
  !path.includes("/dist/") &&
  (
    path.startsWith("src/") ||
    path.startsWith("apps/release-ts/src/") ||
    path.startsWith("apps/ts-release-action/src/")
  )

const lineCount = async (path: string): Promise<number> =>
  (await readFile(path, "utf8")).split(/\r?\n/).length

const sourceFiles = async (): Promise<ReadonlyArray<string>> =>
  (await gitFiles()).filter(isSourceFile).sort()

const roleForPath = (path: string): string => {
  if (path.startsWith("src/pipeline/")) return "Serializable data and pure functions; zero I/O."
  if (path.startsWith("src/pipes/")) return "One pipe per file; owns config section schema and defaults; pipeline imports only."
  if (path.startsWith("src/builders/")) return "Builder planning module; plans artifacts and operations only."
  if (path.startsWith("src/engine/")) return "Engine module; executes operations, renders plans, records evidence, or stages artifacts."
  if (path.startsWith("src/api/")) return "Public Promise/Effect boundary; runtime assembly, runPromise, and error collapse."
  if (path.startsWith("src/host/")) return "Injected platform service definitions and live host integrations."
  if (path.startsWith("src/config/")) return "Release config decoding and schema boundary."
  if (path.startsWith("src/internal/")) return "Small shared internal helper."
  if (path.startsWith("src/workflows/")) return "High-level workflow over the engine; no publish dispatch by itself."
  if (path.startsWith("apps/release-ts/src/cli/")) return "CLI adapter; parses flags and delegates to package API/workflows."
  if (path.startsWith("apps/release-ts/src/runtime/")) return "Bun CLI runtime layer composition."
  if (path.startsWith("apps/ts-release-action/src/runtime/")) return "GitHub Action runtime layer composition."
  if (path.startsWith("apps/ts-release-action/src/")) return "GitHub Action adapter; parses inputs and delegates to package API/workflows."
  return "TypeScript source file in the release tool."
}

const selectedFiles = async (args: ParsedArgs): Promise<ReadonlyArray<string>> => {
  const files = await sourceFiles()
  if (args.pilot) {
    const engineCandidates = await Promise.all(
      files
        .filter((path) => path.startsWith("src/engine/"))
        .map(async (path) => ({ path, lines: await lineCount(path) }))
    )
    const engine = engineCandidates
      .filter((candidate) => candidate.lines <= 600)
      .sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path))[0]?.path
    return [
      "src/pipeline/operation.ts",
      "src/pipes/publish-npm.ts",
      engine ?? "src/engine/evidence.ts"
    ]
  }
  if (args.paths.length === 0) return files
  return files.filter((file) =>
    args.paths.some((pattern) => file === pattern || file.startsWith(pattern) || file.includes(pattern))
  )
}

const promptTemplate = async (): Promise<string> =>
  readFile(promptPath, "utf8")

const assembledPrompt = async (path: string, template: string): Promise<string> => {
  const source = await readFile(path, "utf8")
  return template
    .replaceAll("{path}", path)
    .replaceAll("{role}", roleForPath(path))
    .replaceAll("{source}", source)
}

const parseJsonRpcFromSse = (body: string, id: number): unknown => {
  const direct = body.trim()
  if (direct.startsWith("{")) {
    return JSON.parse(direct)
  }
  const dataLines = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
  for (const line of dataLines) {
    const json = JSON.parse(line)
    if (json.id === id) return json
  }
  throw new Error(`No JSON-RPC response found for id ${id}.`)
}

let nextId = 100

const rpc = async (method: string, params: unknown): Promise<unknown> => {
  const id = nextId
  nextId += 1
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  })
  const text = await response.text()
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`)
    error.name = response.status >= 400 && response.status < 500 ? "ClientHttpError" : "HttpError"
    throw error
  }
  const json = parseJsonRpcFromSse(text, id)
  if (typeof json !== "object" || json === null) {
    throw new Error("Invalid JSON-RPC response.")
  }
  if ("error" in json) {
    const errorText = JSON.stringify(json.error)
    const error = new Error(errorText)
    error.name = "JsonRpcError"
    throw error
  }
  if (!("result" in json)) {
    throw new Error("JSON-RPC response did not include result.")
  }
  return json.result
}

const toolsList = async (): Promise<string> => {
  const result = await rpc("tools/list", {})
  return JSON.stringify(result, null, 2)
}

const askQuestion = async (question: string): Promise<string> => {
  const result = await rpc("tools/call", {
    name: "ask_question",
    arguments: { repoName: wikiRepo, question }
  })
  if (typeof result !== "object" || result === null) {
    throw new Error("tools/call result was not an object.")
  }
  const structured = "structuredContent" in result &&
    typeof result.structuredContent === "object" &&
    result.structuredContent !== null &&
    "result" in result.structuredContent &&
    typeof result.structuredContent.result === "string"
    ? result.structuredContent.result
    : undefined
  if (structured !== undefined) return structured
  const content = "content" in result && Array.isArray(result.content) ? result.content : []
  const first = content[0]
  if (typeof first === "object" && first !== null && "text" in first && typeof first.text === "string") {
    return first.text
  }
  throw new Error("Could not extract text from tools/call result.")
}

const ensureOutput = async (): Promise<void> => {
  await mkdir(responseRoot, { recursive: true })
}

const manifestPath = join(outputRoot, "manifest.json")
const probesPath = join(outputRoot, "probes.json")
const probesManifestPath = join(outputRoot, "probes-manifest.json")

const readManifest = async (): Promise<Array<ManifestEntry>> => {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"))
  } catch {
    return []
  }
}

const writeManifest = async (entries: ReadonlyArray<ManifestEntry>): Promise<void> => {
  await ensureOutput()
  await writeFile(manifestPath, `${JSON.stringify([...entries].sort((a, b) => a.path.localeCompare(b.path)), null, 2)}\n`)
}

const responseFileFor = (path: string): string =>
  join(responseRoot, `${path.replaceAll("/", "-")}.md`)

const writeResponse = async (
  path: string,
  sourceSha256: string,
  promptVersion: string,
  askedAt: string,
  latencyMs: number,
  status: ManifestEntry["status"],
  body: string
): Promise<string> => {
  const responseFile = responseFileFor(path)
  await mkdir(dirname(responseFile), { recursive: true })
  const frontmatter = [
    "---",
    `source: ${JSON.stringify(path)}`,
    `sourceSha256: ${JSON.stringify(sourceSha256)}`,
    `effectVersion: ${JSON.stringify(effectVersion)}`,
    `wikiRepo: ${JSON.stringify(wikiRepo)}`,
    `promptVersion: ${JSON.stringify(promptVersion)}`,
    `askedAt: ${JSON.stringify(askedAt)}`,
    `latencyMs: ${latencyMs}`,
    `status: ${JSON.stringify(status)}`,
    "---",
    "",
    body.trimEnd(),
    ""
  ].join("\n")
  await writeFile(responseFile, frontmatter)
  return responseFile
}

const withRetries = async (operation: () => Promise<string>): Promise<{ status: ManifestEntry["status"]; body: string }> => {
  const backoffs = [10_000, 30_000, 90_000]
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return { status: "ok", body: await operation() }
    } catch (error) {
      lastError = error
      const errorName = error instanceof Error ? error.name : ""
      if (errorName === "ClientHttpError" || errorName === "JsonRpcError") {
        return {
          status: "skipped-too-large",
          body: error instanceof Error ? error.message : String(error)
        }
      }
      const backoff = backoffs[attempt]
      if (backoff !== undefined) await sleep(backoff)
    }
  }
  return {
    status: "failed",
    body: lastError instanceof Error ? lastError.message : String(lastError)
  }
}

const calibrate = async (): Promise<void> => {
  await ensureOutput()
  const started = performance.now()
  const tools = await toolsList()
  const question = "Answer in 5 lines max: (1) Does this repo define Schema.fromJsonString, Schema.parseJson, or both? (2) Are services defined via ServiceMap.Service, Effect.Service, or Context.Tag? (3) Does Schema.TaggedErrorClass exist? (4) What is the package version in package.json?"
  const answer = await askQuestion(question)
  const latencyMs = Math.round(performance.now() - started)
  const localVersion = (await readFile(join(effectPinRoot, "packages/effect/package.json"), "utf8")).match(/"version":\s*"([^"]+)"/)?.[1] ?? "unknown"
  const content = [
    "# DeepWiki Calibration",
    "",
    `- askedAt: ${new Date().toISOString()}`,
    `- endpoint: ${endpoint}`,
    `- wikiRepo: ${wikiRepo}`,
    `- local effect pin: ${effectVersion}`,
    `- .repos/effect package version: ${localVersion}`,
    "- local .deepwiki export: synced 2026-07-03, generated 2026-06-17 at 2ba316bd (per Plan 133)",
    `- latencyMs: ${latencyMs}`,
    "",
    "## tools/list",
    "",
    "```json",
    tools,
    "```",
    "",
    "## Version-Discriminating Answer",
    "",
    answer.trimEnd(),
    ""
  ].join("\n")
  await writeFile(join(outputRoot, "CALIBRATION.md"), content)
}

const runSweep = async (args: ParsedArgs): Promise<void> => {
  const template = await promptTemplate()
  const promptVersion = sha256(template)
  const files = await selectedFiles(args)
  const firstFile = files[0]
  if (firstFile === undefined) throw new Error("No matching files.")
  if (args.dryRun) {
    console.log(await assembledPrompt(firstFile, template))
    return
  }
  await ensureOutput()
  const manifest = await readManifest()
  const byPath = new Map(manifest.map((entry) => [entry.path, entry]))
  let sent = 0
  for (const path of files) {
    const source = await readFile(path, "utf8")
    const sourceSha256 = sha256(source)
    const existing = byPath.get(path)
    if (
      existing !== undefined &&
      existing.sourceSha256 === sourceSha256 &&
      existing.promptVersion === promptVersion &&
      existing.status === "ok" &&
      !args.force.has(path)
    ) {
      console.log(`skip fresh ${path}`)
      continue
    }
    if (sent > 0) await sleep(3_000)
    sent += 1
    const prompt = await assembledPrompt(path, template)
    const askedAt = new Date().toISOString()
    const started = performance.now()
    console.log(`ask ${path}`)
    const result = await withRetries(() => askQuestion(prompt))
    const latencyMs = Math.round(performance.now() - started)
    const responseFile = await writeResponse(
      path,
      sourceSha256,
      promptVersion,
      askedAt,
      latencyMs,
      result.status,
      result.body
    )
    byPath.set(path, {
      path,
      sourceSha256,
      promptVersion,
      status: result.status,
      responseFile,
      askedAt,
      latencyMs,
      ...(result.status === "ok" ? {} : { error: result.body.slice(0, 500) })
    })
    await writeManifest([...byPath.values()])
    console.log(`${result.status} ${path} ${latencyMs}ms`)
  }
}

const readProbes = async (): Promise<ReadonlyArray<ProbeSpec>> => {
  const probes: ReadonlyArray<ProbeSpec> = JSON.parse(await readFile(probesPath, "utf8"))
  const seen = new Set<string>()
  for (const probe of probes) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(probe.id)) throw new Error(`Invalid probe id: ${probe.id}`)
    if (seen.has(probe.id)) throw new Error(`Duplicate probe id: ${probe.id}`)
    seen.add(probe.id)
  }
  return probes
}

const probePromptTemplate = async (): Promise<string> =>
  readFile(probePromptPath, "utf8")

const probeSha = (probe: ProbeSpec): string =>
  sha256(JSON.stringify([probe.mechanic, probe.snippet, [...probe.families].sort()]))

const assembledProbeQuestion = (probe: ProbeSpec, template: string): string =>
  template
    .replaceAll("{families}", probe.families.join(", "))
    .replaceAll("{mechanic}", probe.mechanic)
    .replaceAll("{snippet}", probe.snippet.trimEnd())

const readProbesManifest = async (): Promise<Array<ProbeManifestEntry>> => {
  try {
    return JSON.parse(await readFile(probesManifestPath, "utf8"))
  } catch {
    return []
  }
}

const writeProbesManifest = async (entries: ReadonlyArray<ProbeManifestEntry>): Promise<void> => {
  await ensureOutput()
  await writeFile(
    probesManifestPath,
    `${JSON.stringify([...entries].sort((a, b) => a.id.localeCompare(b.id)), null, 2)}\n`
  )
}

const probeResponseFileFor = (id: string): string =>
  join(responseRoot, `probe-${id}.md`)

const writeProbeResponse = async (
  probe: ProbeSpec,
  probeSha256: string,
  promptVersion: string,
  askedAt: string,
  latencyMs: number,
  status: ProbeManifestEntry["status"],
  body: string
): Promise<string> => {
  const responseFile = probeResponseFileFor(probe.id)
  await mkdir(dirname(responseFile), { recursive: true })
  const frontmatter = [
    "---",
    `probeId: ${JSON.stringify(probe.id)}`,
    `families: ${JSON.stringify(probe.families.join(", "))}`,
    `files: ${JSON.stringify(probe.files.join(", "))}`,
    ...(probe.lines === undefined ? [] : [`lines: ${JSON.stringify(probe.lines)}`]),
    `probeSha256: ${JSON.stringify(probeSha256)}`,
    `effectVersion: ${JSON.stringify(effectVersion)}`,
    `wikiRepo: ${JSON.stringify(wikiRepo)}`,
    `promptVersion: ${JSON.stringify(promptVersion)}`,
    `askedAt: ${JSON.stringify(askedAt)}`,
    `latencyMs: ${latencyMs}`,
    `status: ${JSON.stringify(status)}`,
    "---",
    "",
    body.trimEnd(),
    ""
  ].join("\n")
  await writeFile(responseFile, frontmatter)
  return responseFile
}

const runProbeSweep = async (args: ParsedArgs): Promise<void> => {
  const template = await probePromptTemplate()
  const promptVersion = sha256(template)
  const allProbes = await readProbes()
  const probes = args.paths.length === 0
    ? allProbes
    : allProbes.filter((probe) =>
      args.paths.some((pattern) =>
        probe.id === pattern ||
        probe.id.includes(pattern) ||
        probe.files.some((file) => file === pattern || file.startsWith(pattern) || file.includes(pattern))
      )
    )
  const firstProbe = probes[0]
  if (firstProbe === undefined) throw new Error("No matching probes.")
  if (args.dryRun) {
    console.log(assembledProbeQuestion(firstProbe, template))
    return
  }
  await ensureOutput()
  const manifest = await readProbesManifest()
  const byId = new Map(manifest.map((entry) => [entry.id, entry]))
  let sent = 0
  for (const probe of probes) {
    const probeSha256 = probeSha(probe)
    const existing = byId.get(probe.id)
    if (
      existing !== undefined &&
      existing.probeSha256 === probeSha256 &&
      existing.promptVersion === promptVersion &&
      existing.status === "ok" &&
      !args.force.has(probe.id)
    ) {
      console.log(`skip fresh ${probe.id}`)
      continue
    }
    if (sent > 0) await sleep(3_000)
    sent += 1
    const question = assembledProbeQuestion(probe, template)
    const askedAt = new Date().toISOString()
    const started = performance.now()
    console.log(`ask ${probe.id}`)
    const result = await withRetries(() => askQuestion(question))
    const latencyMs = Math.round(performance.now() - started)
    const responseFile = await writeProbeResponse(
      probe,
      probeSha256,
      promptVersion,
      askedAt,
      latencyMs,
      result.status,
      result.body
    )
    byId.set(probe.id, {
      id: probe.id,
      probeSha256,
      promptVersion,
      status: result.status,
      responseFile,
      askedAt,
      latencyMs,
      ...(result.status === "ok" ? {} : { error: result.body.slice(0, 500) })
    })
    await writeProbesManifest([...byId.values()])
    console.log(`${result.status} ${probe.id} ${latencyMs}ms`)
  }
}

interface ApiVerification {
  readonly api: string
  readonly verdict: "verified" | "found-elsewhere" | "missing" | "unknown-module"
  readonly file?: string
}

const effectModuleFiles = async (): Promise<Map<string, Array<string>>> => {
  const map = new Map<string, Array<string>>()
  const addDir = async (dir: string): Promise<void> => {
    let entries: Array<string>
    try {
      entries = await readdir(join(effectPinRoot, dir))
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
        const moduleName = entry.slice(0, -3)
        const paths = map.get(moduleName) ?? []
        paths.push(join(dir, entry))
        map.set(moduleName, paths)
      }
    }
  }
  await addDir("packages/effect/src")
  const unstableRoot = "packages/effect/src/unstable"
  try {
    for (const sub of await readdir(join(effectPinRoot, unstableRoot))) {
      await addDir(join(unstableRoot, sub))
    }
  } catch {
    // unstable layout absent; skip
  }
  await addDir("packages/platform-bun/src")
  return map
}

const exportPattern = (name: string): RegExp =>
  new RegExp(`^export (const|function|class|interface|type|declare) ${name}\\b|^export \\{[^}]*\\b${name}\\b`, "m")

const interfaceMemberPattern = (name: string): RegExp =>
  new RegExp(`^\\s+(readonly )?(\\[)?"?${name}"?(\\])?\\??\\s*[:(<]`, "m")

const moduleFileCache = new Map<string, string>()

const readPinFile = async (relative: string): Promise<string> => {
  const cached = moduleFileCache.get(relative)
  if (cached !== undefined) return cached
  const content = await readFile(join(effectPinRoot, relative), "utf8")
  moduleFileCache.set(relative, content)
  return content
}

const gitGrepExport = async (name: string): Promise<string | undefined> => {
  try {
    const out = await runGit([
      "-C",
      effectPinRoot,
      "grep",
      "-l",
      "-E",
      `export (const|function|class) ${name}\\b`,
      "--",
      "packages/effect/src"
    ])
    return out.split("\n")[0] || undefined
  } catch {
    return undefined
  }
}

const verifyApi = async (
  moduleFiles: Map<string, Array<string>>,
  token: string,
  cache: Map<string, ApiVerification>
): Promise<ApiVerification> => {
  const cached = cache.get(token)
  if (cached !== undefined) return cached
  const [moduleName, exportName] = token.split(".")
  const candidates = moduleName === undefined || exportName === undefined
    ? undefined
    : moduleFiles.get(moduleName)
  let verification: ApiVerification
  if (candidates === undefined || exportName === undefined) {
    verification = { api: token, verdict: "unknown-module" }
  } else {
    let found: string | undefined
    for (const candidate of candidates) {
      const content = await readPinFile(candidate)
      if (exportPattern(exportName).test(content) || interfaceMemberPattern(exportName).test(content)) {
        found = candidate
        break
      }
    }
    if (found !== undefined) {
      verification = { api: token, verdict: "verified", file: found }
    } else {
      const elsewhere = await gitGrepExport(exportName)
      verification = elsewhere !== undefined
        ? { api: token, verdict: "found-elsewhere", file: elsewhere }
        : { api: token, verdict: "missing" }
    }
  }
  cache.set(token, verification)
  return verification
}

const extractApiTokens = (body: string): ReadonlyArray<string> => {
  const tokens = new Set<string>()
  for (const match of body.matchAll(/`([A-Z][A-Za-z0-9]+)\.([A-Za-z][A-Za-z0-9]*)`/g)) {
    const moduleName = match[1]
    const exportName = match[2]
    if (moduleName === exportName) continue
    tokens.add(`${moduleName}.${exportName}`)
  }
  return [...tokens].sort()
}

const stripFrontmatter = (body: string): string =>
  body.replace(/^---[\s\S]*?---\s*/, "")

interface CorpusSection {
  readonly rows: ReadonlyArray<string>
  readonly asked: number
  readonly ok: number
  readonly verified: ReadonlyArray<[string, { verdict: ApiVerification["verdict"]; file?: string; probes: number }]>
  readonly missing: ReadonlyArray<[string, { verdict: ApiVerification["verdict"]; file?: string; probes: number }]>
}

const fileReviewSection = async (
  moduleFiles: Map<string, Array<string>>,
  verificationCache: Map<string, ApiVerification>
): Promise<CorpusSection> => {
  const manifest = await readManifest()
  const histogram = new Map<string, { verdict: ApiVerification["verdict"]; file?: string; probes: number }>()
  const rows: Array<string> = []
  for (const entry of manifest.sort((a, b) => a.path.localeCompare(b.path))) {
    if (entry.status !== "ok") {
      rows.push(`| ${entry.path} | ${entry.status} | - | [response](${entry.responseFile.replace(`${outputRoot}/`, "")}) |`)
      continue
    }
    const answer = stripFrontmatter(await readFile(entry.responseFile, "utf8"))
    const verifications: Array<ApiVerification> = []
    for (const token of extractApiTokens(answer)) {
      const verification = await verifyApi(moduleFiles, token, verificationCache)
      if (verification.verdict === "unknown-module") continue
      verifications.push(verification)
      const existing = histogram.get(verification.api)
      histogram.set(verification.api, {
        verdict: verification.verdict,
        ...(verification.file === undefined ? {} : { file: verification.file }),
        probes: (existing?.probes ?? 0) + 1
      })
    }
    const verified = verifications.filter((item) => item.verdict === "verified" || item.verdict === "found-elsewhere")
    const missing = verifications.filter((item) => item.verdict === "missing")
    const summary = `${verified.length} verified${missing.length > 0 ? `, ${missing.length} missing: ${missing.map((item) => item.api).join(" ")}` : ""}`
    rows.push(`| ${entry.path} | ok ${entry.latencyMs}ms | ${summary.replaceAll("|", "\\|")} | [response](${entry.responseFile.replace(`${outputRoot}/`, "")}) |`)
  }
  const sorted = [...histogram.entries()].sort(([a], [b]) => a.localeCompare(b))
  return {
    rows,
    asked: manifest.length,
    ok: manifest.filter((entry) => entry.status === "ok").length,
    verified: sorted.filter(([, value]) => value.verdict === "verified" || value.verdict === "found-elsewhere"),
    missing: sorted.filter(([, value]) => value.verdict === "missing")
  }
}

const writeIndex = async (): Promise<void> => {
  const probesManifest = await readProbesManifest()
  const probesById = new Map((await readProbes().catch(() => [] as Array<ProbeSpec>)).map((probe) => [probe.id, probe]))
  const moduleFiles = await effectModuleFiles()
  const verificationCache = new Map<string, ApiVerification>()
  const apiHistogram = new Map<string, { verdict: ApiVerification["verdict"]; file?: string; probes: number }>()
  const rows: Array<string> = []
  let nothingFits = 0
  for (const entry of probesManifest.sort((a, b) => a.id.localeCompare(b.id))) {
    const probe = probesById.get(entry.id)
    const body = await readFile(entry.responseFile, "utf8")
    const answer = stripFrontmatter(body)
    if (entry.status !== "ok") {
      rows.push(`| ${entry.id} | ${probe?.families.join(", ") ?? "-"} | ${probe?.files.join("<br>") ?? "-"} | ${entry.status} | - | [response](${entry.responseFile.replace(`${outputRoot}/`, "")}) |`)
      continue
    }
    const isNothingFits = /nothing fits/i.test(answer)
    if (isNothingFits) nothingFits += 1
    const verifications: Array<ApiVerification> = []
    for (const token of extractApiTokens(answer)) {
      const verification = await verifyApi(moduleFiles, token, verificationCache)
      if (verification.verdict === "unknown-module") continue
      verifications.push(verification)
      const existing = apiHistogram.get(verification.api)
      apiHistogram.set(verification.api, {
        verdict: verification.verdict,
        ...(verification.file === undefined ? {} : { file: verification.file }),
        probes: (existing?.probes ?? 0) + 1
      })
    }
    const verified = verifications.filter((item) => item.verdict === "verified" || item.verdict === "found-elsewhere")
    const missing = verifications.filter((item) => item.verdict === "missing")
    const summary = isNothingFits && verifications.length === 0
      ? "nothing fits"
      : `${verified.length} verified${missing.length > 0 ? `, ${missing.length} missing: ${missing.map((item) => item.api).join(" ")}` : ""}`
    rows.push(`| ${entry.id} | ${probe?.families.join(", ") ?? "-"} | ${probe?.files.join("<br>") ?? "-"} | ok ${entry.latencyMs}ms | ${summary.replaceAll("|", "\\|")} | [response](${entry.responseFile.replace(`${outputRoot}/`, "")}) |`)
  }
  const failures = probesManifest.filter((entry) => entry.status !== "ok")
  const verifiedApis = [...apiHistogram.entries()]
    .filter(([, value]) => value.verdict === "verified" || value.verdict === "found-elsewhere")
    .sort(([a], [b]) => a.localeCompare(b))
  const missingApis = [...apiHistogram.entries()]
    .filter(([, value]) => value.verdict === "missing")
    .sort(([a], [b]) => a.localeCompare(b))
  const fileReviews = await fileReviewSection(moduleFiles, verificationCache)
  const content = [
    "# DeepWiki Sweep Index (probe corpus)",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Probe mode: each entry is one capability question (mechanic + snippet) asked against the",
    `\`${wikiRepo}\` wiki. Every \`Module.export\` mentioned in an answer is verified locally`,
    `against the pinned checkout (\`${effectPinRoot}\`, ${effectVersion}): verified = export found in the`,
    "named module; found-elsewhere = export exists in a different file; missing = not found at the pin",
    "(hallucination or post-pin API). The three per-file pilot responses from the retired file-review",
    "mode remain under `responses/src-*.md`; see `PILOT-NOTES.md`.",
    "",
    "## Totals",
    "",
    `- probes asked: ${probesManifest.length}`,
    `- ok: ${probesManifest.filter((entry) => entry.status === "ok").length}`,
    `- failed/skipped: ${failures.length}`,
    `- nothing-fits answers: ${nothingFits}`,
    `- distinct APIs named (effect modules only): ${apiHistogram.size}`,
    `- verified at pin: ${verifiedApis.length}`,
    `- missing at pin: ${missingApis.length}`,
    "",
    "## Verified APIs at the pin",
    "",
    ...(verifiedApis.length === 0
      ? ["- none"]
      : verifiedApis.map(([api, value]) => `- \`${api}\` — ${value.file} (${value.probes} probe${value.probes === 1 ? "" : "s"})`)),
    "",
    "## APIs named but missing at the pin",
    "",
    ...(missingApis.length === 0
      ? ["- none"]
      : missingApis.map(([api, value]) => `- \`${api}\` (${value.probes} probe${value.probes === 1 ? "" : "s"})`)),
    "",
    "## Probes",
    "",
    "| Probe | Families | Files | Status | APIs | Response |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Failures",
    "",
    ...(failures.length === 0 ? ["- none"] : failures.map((entry) => `- ${entry.id}: ${entry.status} ${entry.error ?? ""}`)),
    "",
    "## Per-file reviews (v2 prompt corpus)",
    "",
    "One open design-principles review per source file (template:",
    "`scripts/deepwiki-prompt.md`); same pin verification as probes.",
    "",
    `- files asked: ${fileReviews.asked}`,
    `- ok: ${fileReviews.ok}`,
    `- APIs named (effect modules only): ${fileReviews.verified.length + fileReviews.missing.length}`,
    `- verified at pin: ${fileReviews.verified.length}`,
    `- missing at pin (hallucinated or post-pin): ${fileReviews.missing.length}`,
    "",
    "### APIs named but missing at the pin (v2 reviews)",
    "",
    ...(fileReviews.missing.length === 0
      ? ["- none"]
      : fileReviews.missing.map(([api, value]) => `- \`${api}\` (${value.probes} file${value.probes === 1 ? "" : "s"})`)),
    "",
    "### Files",
    "",
    "| File | Status | APIs | Response |",
    "|---|---|---|---|",
    ...fileReviews.rows,
    ""
  ].join("\n")
  await writeFile(join(outputRoot, "INDEX.md"), content)
}

const main = async (): Promise<void> => {
  const args = parseArgs()
  if (args.calibrate) await calibrate()
  if (args.index) await writeIndex()
  if (!args.calibrate && !args.index) {
    if (args.probes) await runProbeSweep(args)
    else await runSweep(args)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
