#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  canonicalJsonHash,
  encodeCanonicalJson,
  sha256Hex,
  type JsonValue
} from "./lib/canonical-json.js"
import { runAudit, validateAuditSummary } from "./lib/audit.js"
import { runClaimCases } from "./lib/claim-cases.js"
import {
  decodeParityManifest,
  requiredCaseIds
} from "./lib/parity.js"
import { repositorySnapshotHash } from "./lib/repository-snapshot.js"
import { countSourceTree } from "./lib/source-budget.js"
import {
  expectExactKeys,
  expectObject,
  parseStrictJson
} from "./lib/strict-json.js"
import { checkSuperiority } from "./lib/superiority.js"

interface PlanGate {
  readonly predecessor: string | null
  readonly report: string
  readonly commands: ReadonlyArray<ReadonlyArray<string>>
}
interface GateContract {
  readonly schemaVersion: "rewrite-plan-gates/v1"
  readonly rootRevision: string
  readonly order: ReadonlyArray<string>
  readonly plans: Readonly<Record<string, PlanGate>>
}
interface CommandResult {
  readonly index: number
  readonly argv: ReadonlyArray<string>
  readonly exitCode: number
  readonly stdoutHash: string
  readonly stderrHash: string
  readonly stdoutBytes: number
  readonly stderrBytes: number
  readonly summary: JsonValue
}

const root = process.cwd()
const gatePath = "contracts/rewrite/plan-gates.json"

const git = (args: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`)
  }
  return result.stdout.toString().trim()
}

const readGates = (): GateContract => {
  const value = expectObject(parseStrictJson(readFileSync(gatePath, "utf8")), "plan gates")
  expectExactKeys(value, ["schemaVersion", "rootRevision", "order", "plans"])
  if (value.schemaVersion !== "rewrite-plan-gates/v1") throw new Error("Unknown plan-gates schema.")
  const contract = value as unknown as GateContract
  if (new Set(contract.order).size !== contract.order.length) throw new Error("Duplicate plan order.")
  let prior: string | null = null
  for (const id of contract.order) {
    const gate = contract.plans[id]
    if (gate === undefined || gate.predecessor !== prior) {
      throw new Error(`Plan ${id} has an invalid exact predecessor.`)
    }
    prior = id
  }
  if (Object.keys(contract.plans).sort().join(",") !== [...contract.order].sort().join(",")) {
    throw new Error("Plan-gates map and order differ.")
  }
  return contract
}

export const parseRewritePlanCli = (args: ReadonlyArray<string>): {
  readonly plan: string | undefined
  readonly check: boolean
  readonly writeReport: string | undefined
  readonly verifyReport: string | undefined
  readonly verifyChain: ReadonlyArray<string> | undefined
  readonly requireCurrent: string | undefined
} => {
  const values = {
    plan: undefined as string | undefined,
    check: false,
    writeReport: undefined as string | undefined,
    verifyReport: undefined as string | undefined,
    verifyChain: undefined as ReadonlyArray<string> | undefined,
    requireCurrent: undefined as string | undefined
  }
  const seen = new Set<string>()
  const input = args.filter((argument) => argument !== "--")
  for (let index = 0; index < input.length; index += 1) {
    const option = input[index]!
    if (!["--plan", "--check", "--write-report", "--verify-report", "--verify-chain", "--require-current"]
      .includes(option)) throw new Error(`Unknown option: ${option}`)
    if (seen.has(option)) throw new Error(`Duplicate option: ${option}`)
    seen.add(option)
    if (option === "--check") {
      values.check = true
      continue
    }
    const value = input[++index]
    if (value === undefined || value.startsWith("--")) throw new Error(`${option} requires a value.`)
    if (option === "--plan") values.plan = value
    if (option === "--write-report") values.writeReport = value
    if (option === "--verify-report") values.verifyReport = value
    if (option === "--verify-chain") {
      const paths = value.split(",")
      if (paths.some((path) => path.length === 0) || new Set(paths).size !== paths.length) {
        throw new Error("--verify-chain requires a duplicate-free comma list.")
      }
      values.verifyChain = paths
    }
    if (option === "--require-current") values.requireCurrent = value
  }
  const planMode = values.plan !== undefined
  const reportMode = values.verifyReport !== undefined
  const chainMode = values.verifyChain !== undefined
  if ([planMode, reportMode, chainMode].filter(Boolean).length !== 1) {
    throw new Error("Choose exactly one of --plan, --verify-report, or --verify-chain.")
  }
  if (reportMode && (values.check || values.writeReport !== undefined || values.requireCurrent !== undefined)) {
    throw new Error("Conflicting report verification options.")
  }
  if (chainMode && (
    values.check || values.writeReport !== undefined ||
    values.requireCurrent === undefined
  )) throw new Error("--verify-chain requires only --require-current.")
  if (planMode && values.check && values.writeReport !== undefined) {
    throw new Error("--check and --write-report conflict.")
  }
  if (planMode && values.requireCurrent !== undefined) throw new Error("--require-current is chain-only.")
  return values
}

const status = (): string => git(["status", "--porcelain", "--untracked-files=all"])
const requireClean = (): void => {
  const dirty = status()
  if (dirty !== "") throw new Error(`Rewrite gate refuses a dirty worktree:\n${dirty}`)
}

const commandSummary = (stdout: string, stderr: string): JsonValue => {
  const combined = `${stdout}\n${stderr}`
  const tests = /(\d+) pass[\s\S]*?(\d+) fail/u.exec(combined)
  const skips = /(\d+) skip/u.exec(combined)
  if (tests !== null) {
    return {
      kind: "bun-test",
      pass: Number(tests[1]),
      fail: Number(tests[2]),
      skip: skips === null ? 0 : Number(skips[1])
    }
  }
  const lines = stdout.trim().split("\n").filter((line) => line.length > 0)
  const last = lines.at(-1)
  if (last !== undefined && last.startsWith("{")) {
    try {
      return { kind: "canonical-json", value: parseStrictJson(last) }
    } catch {
      // A human-readable checker summary is still bound by its byte hash.
    }
  }
  return {
    kind: "opaque",
    stdoutLines: lines.length,
    stderrLines: stderr.trim().split("\n").filter((line) => line.length > 0).length
  }
}

const runCommands = (commands: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<CommandResult> => {
  const results: Array<CommandResult> = []
  for (const [index, argv] of commands.entries()) {
    const result = Bun.spawnSync([...argv], {
      cwd: root,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: process.env
    })
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()
    process.stdout.write(stdout)
    process.stderr.write(stderr)
    const item: CommandResult = {
      index,
      argv,
      exitCode: result.exitCode,
      stdoutHash: sha256Hex(stdout),
      stderrHash: sha256Hex(stderr),
      stdoutBytes: Buffer.byteLength(stdout),
      stderrBytes: Buffer.byteLength(stderr),
      summary: commandSummary(stdout, stderr)
    }
    results.push(item)
    if (item.exitCode !== 0) throw new Error(`Gate command ${index} failed: ${argv.join(" ")}`)
  }
  return results
}

const jsonHash = (path: string): string =>
  canonicalJsonHash(parseStrictJson(readFileSync(resolve(root, path), "utf8")))

const blob = (revision: string, path: string): string => {
  const result = Bun.spawnSync(["git", "show", `${revision}:${path}`], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe"
  })
  if (result.exitCode !== 0) throw new Error(`Missing ${path} at ${revision}.`)
  return result.stdout.toString()
}

const jsonHashAt = (revision: string, path: string): string =>
  canonicalJsonHash(parseStrictJson(blob(revision, path)))

const historyHeadAt = (revision: string): string | null => {
  const result = Bun.spawnSync([
    "git", "ls-tree", "-r", "--name-only", revision, "contracts/rewrite/source-history"
  ], { cwd: root, stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== 0) throw new Error("Unable to enumerate source history.")
  const paths = result.stdout.toString().trim().split("\n")
    .filter((path) => path.endsWith(".json"))
    .sort((left, right) => {
      const rank = (path: string): number =>
        path.endsWith("/m0.json") ? 0 : path.endsWith("/m6.json") ? 1 : 2
      return rank(left) - rank(right) || left.localeCompare(right)
    })
  let prior: string | null = null
  for (const path of paths) {
    const entry = expectObject(parseStrictJson(blob(revision, path)), path)
    const { reportHash, ...body } = entry
    const calculated = canonicalJsonHash(body)
    if (reportHash !== calculated || entry.priorReportHash !== prior) {
      throw new Error(`${path}: invalid source-history chain.`)
    }
    prior = String(reportHash)
  }
  return prior
}

const secretScan = (): { readonly scanned: number; readonly matches: 0 } => {
  const patterns = [
    /ghp_[A-Za-z0-9]{20,}/u,
    /github_pat_[A-Za-z0-9_]{20,}/u,
    /AKIA[0-9A-Z]{16}/u,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u
  ]
  const paths = git(["ls-files", "-z"]).split("\0").filter((path) =>
    path.length > 0 &&
    !path.startsWith("plans/") &&
    !path.startsWith("contracts/rewrite/reports/")
  )
  for (const path of paths) {
    const bytes = readFileSync(resolve(root, path))
    if (bytes.includes(0)) continue
    const text = bytes.toString("utf8")
    if (patterns.some((pattern) => pattern.test(text))) throw new Error(`Secret scan matched ${path}.`)
  }
  return { scanned: paths.length, matches: 0 }
}

const withoutHash = (
  report: Readonly<Record<string, JsonValue>>
): Readonly<Record<string, JsonValue>> => {
  const { reportHash: _reportHash, ...body } = report
  return body
}

const readReport = (path: string): Readonly<Record<string, JsonValue>> =>
  expectObject(parseStrictJson(readFileSync(resolve(root, path), "utf8")), path)

const verifyReport = (
  path: string,
  gates: GateContract,
  requireCurrent: boolean
): Readonly<Record<string, JsonValue>> => {
  const report = readReport(path)
  const reportedPlan = String(report.plan)
  expectExactKeys(report, [
    "schemaVersion",
    "plan",
    "reportPath",
    "reportHash",
    "priorReportHash",
    "implementationCommit",
    "implementationTree",
    "commandVectorHash",
    "commands",
    "contractHashes",
    "sourceHistoryHeadHash",
    "inputSnapshotHash",
    "outputSnapshotHash",
    "caseResults",
    "paritySummary",
    "propertySummary",
    "sourceSummary",
    "zeroSecretScan",
    ...(reportedPlan === "184" ? ["auditSummary"] : [])
  ])
  if (report.schemaVersion !== "rewrite-plan-report/v1") throw new Error(`${path}: schema drift.`)
  const plan = reportedPlan
  const gate = gates.plans[plan]
  if (gate === undefined || report.reportPath !== gate.report || path !== gate.report) {
    throw new Error(`${path}: report is not its configured target.`)
  }
  if (report.reportHash !== canonicalJsonHash(withoutHash(report))) {
    throw new Error(`${path}: report hash mismatch.`)
  }
  if (report.commandVectorHash !== canonicalJsonHash(gate.commands)) {
    throw new Error(`${path}: command vector drift.`)
  }
  const commands = report.commands
  if (!Array.isArray(commands) || commands.length !== gate.commands.length) {
    throw new Error(`${path}: command result roster mismatch.`)
  }
  for (const [index, item] of commands.entries()) {
    const command = expectObject(item, `commands[${index}]`)
    if (command.exitCode !== 0 || JSON.stringify(command.argv) !== JSON.stringify(gate.commands[index])) {
      throw new Error(`${path}: failed or altered command ${index}.`)
    }
  }
  const commit = String(report.implementationCommit)
  if (git(["rev-parse", `${commit}^{tree}`]) !== report.implementationTree) {
    throw new Error(`${path}: implementation tree mismatch.`)
  }
  if (repositorySnapshotHash(root, commit) !== report.outputSnapshotHash) {
    throw new Error(`${path}: stale output snapshot.`)
  }
  if (requireCurrent && repositorySnapshotHash(root) !== report.outputSnapshotHash) {
    throw new Error(`${path}: report does not match the current tree.`)
  }
  const hashes = expectObject(report.contractHashes!, "contractHashes")
  const expectedHashes = {
    architecture: jsonHashAt(commit, "contracts/rewrite/architecture.json"),
    ...(plan === "184" ? { audit: jsonHashAt(commit, "contracts/rewrite/audit.json") } : {}),
    configBoundary: jsonHashAt(commit, "contracts/rewrite/config-boundary.json"),
    ...(gates.order.indexOf(plan) < gates.order.indexOf("176") ? {} : {
      deletionMap: jsonHashAt(commit, "contracts/rewrite/deletion-map.json")
    }),
    manifest: jsonHashAt(commit, "parity/goreleaser-v2.17.0/manifest.json"),
    oracle: jsonHashAt(commit, "contracts/rewrite/oracle.json"),
    planGates: jsonHashAt(commit, gatePath),
    sourcePolicy: jsonHashAt(commit, "contracts/rewrite/source-budget.json"),
    superiority: jsonHashAt(commit, "contracts/rewrite/superiority.json")
  }
  if (JSON.stringify(hashes) !== JSON.stringify(expectedHashes)) {
    throw new Error(`${path}: stale contract hash.`)
  }
  if (plan === "184") validateAuditSummary(root, report.auditSummary!)
  if (report.sourceHistoryHeadHash !== historyHeadAt(commit)) {
    throw new Error(`${path}: source-history head mismatch.`)
  }
  const manifest = decodeParityManifest(
    blob(commit, "parity/goreleaser-v2.17.0/manifest.json"),
    { allowHistoricalReadiness: true }
  )
  const expectedCases = manifest.rows
    .filter((row) => row.scope === "included")
    .flatMap((row) => requiredCaseIds(manifest, row))
    .sort()
  const cases = report.caseResults
  if (!Array.isArray(cases) || JSON.stringify(cases.map((item) =>
    String(expectObject(item, "case result").id)).sort()) !== JSON.stringify(expectedCases)) {
    throw new Error(`${path}: case results were not produced for the exact manifest roster.`)
  }
  for (const item of cases) {
    const result = expectObject(item, "case result")
    if (!Array.isArray(result.assertions) || result.assertions.length === 0) {
      throw new Error(`${path}: static case result detected.`)
    }
  }
  const predecessor = gate.predecessor
  if (predecessor === null) {
    if (report.priorReportHash !== null) throw new Error(`${path}: root report has a predecessor.`)
    if (report.inputSnapshotHash !== repositorySnapshotHash(root, gates.rootRevision)) {
      throw new Error(`${path}: root input snapshot mismatch.`)
    }
  } else {
    const priorPath = gates.plans[predecessor]!.report
    const prior = verifyReport(priorPath, gates, false)
    if (
      report.priorReportHash !== prior.reportHash ||
      report.inputSnapshotHash !== prior.outputSnapshotHash
    ) throw new Error(`${path}: predecessor link mismatch.`)
  }
  return report
}

const buildReport = async (
  plan: string,
  gate: PlanGate,
  gates: GateContract,
  commands: ReadonlyArray<CommandResult>
): Promise<Readonly<Record<string, JsonValue>>> => {
  const sourceMilestone = plan === "173"
    ? "M0"
    : plan === "174"
    ? "M1"
    : plan === "175"
    ? "M2"
    : plan === "176"
    ? "PORT"
    : plan === "177"
    ? "M6"
    : "PARITY"
  const propertyMilestone = ["173", "174"].includes(plan)
    ? "contract"
    : ["175", "176"].includes(plan)
    ? "runner"
    : plan === "177"
    ? "cutover"
    : plan === "183"
    ? "distributed"
    : "PARITY"
  const commit = git(["rev-parse", "HEAD"])
  const tree = git(["rev-parse", "HEAD^{tree}"])
  const claimRun = await runClaimCases(root)
  if (claimRun.failed !== 0) throw new Error("Claim case runner produced a failure.")
  const manifest = decodeParityManifest(readFileSync(
    "parity/goreleaser-v2.17.0/manifest.json",
    "utf8"
  ))
  const source = await countSourceTree(root, sourceMilestone)
  if (source.warnings.length > 0) throw new Error("Source report contains warnings.")
  const properties = checkSuperiority(root, propertyMilestone)
  const prior = gate.predecessor === null
    ? null
    : verifyReport(gates.plans[gate.predecessor]!.report, gates, false)
  const passingRows = manifest.rows.filter((row) =>
    row.scope === "included" && requiredCaseIds(manifest, row).every((id) =>
      claimRun.results.find((result) => result.id === id)?.status === "pass"))
  const body: Readonly<Record<string, JsonValue>> = {
    schemaVersion: "rewrite-plan-report/v1",
    plan,
    reportPath: gate.report,
    priorReportHash: prior?.reportHash ?? null,
    implementationCommit: commit,
    implementationTree: tree,
    commandVectorHash: canonicalJsonHash(gate.commands),
    commands: commands as unknown as JsonValue,
    contractHashes: {
      architecture: jsonHash("contracts/rewrite/architecture.json"),
      ...(plan === "184" ? { audit: jsonHash("contracts/rewrite/audit.json") } : {}),
      configBoundary: jsonHash("contracts/rewrite/config-boundary.json"),
      ...(gates.order.indexOf(plan) < gates.order.indexOf("176") ? {} : {
        deletionMap: jsonHash("contracts/rewrite/deletion-map.json")
      }),
      manifest: jsonHash("parity/goreleaser-v2.17.0/manifest.json"),
      oracle: jsonHash("contracts/rewrite/oracle.json"),
      planGates: jsonHash(gatePath),
      sourcePolicy: jsonHash("contracts/rewrite/source-budget.json"),
      superiority: jsonHash("contracts/rewrite/superiority.json")
    },
    sourceHistoryHeadHash: historyHeadAt(commit),
    inputSnapshotHash: prior?.outputSnapshotHash ??
      repositorySnapshotHash(root, gates.rootRevision),
    outputSnapshotHash: repositorySnapshotHash(root, commit),
    caseResults: claimRun.results as unknown as JsonValue,
    paritySummary: {
      passingCustomization: passingRows
        .filter((row) => row.population === "customization").length,
      eligibleCustomization: 107,
      passingPro: passingRows.filter((row) => row.population === "pro").length,
      eligiblePro: 33,
      failedCases: claimRun.failed,
      pendingCases: claimRun.pending
    },
    propertySummary: {
      passing: properties.passing,
      candidateProven: properties.candidateProven,
      unresolved: properties.unresolved
    },
    sourceSummary: {
      milestone: source.milestone,
      product: source.totals.product,
      oracle: source.totals.oracle,
      warnings: source.warnings.length
    },
    zeroSecretScan: secretScan(),
    ...(plan === "184" ? { auditSummary: runAudit(root) as unknown as JsonValue } : {})
  }
  return { ...body, reportHash: canonicalJsonHash(body) }
}

const main = async (): Promise<void> => {
  const options = parseRewritePlanCli(process.argv.slice(2))
  const gates = readGates()
  if (options.verifyReport !== undefined) {
    verifyReport(options.verifyReport, gates, false)
    process.stdout.write(encodeCanonicalJson({ verified: options.verifyReport }))
    return
  }
  if (options.verifyChain !== undefined) {
    const configured = options.verifyChain.map((path) =>
      String(readReport(path).plan))
    if (JSON.stringify(configured) !== JSON.stringify(gates.order.slice(0, configured.length))) {
      throw new Error("Verification chain is not the exact configured order.")
    }
    if (configured.at(-1) !== options.requireCurrent) {
      throw new Error("--require-current must name the final supplied report.")
    }
    for (const [index, path] of options.verifyChain.entries()) {
      verifyReport(path, gates, index === options.verifyChain.length - 1)
    }
    process.stdout.write(encodeCanonicalJson({ verifiedChain: configured }))
    return
  }
  const plan = options.plan!
  const gate = gates.plans[plan]
  if (gate === undefined) throw new Error(`Unknown rewrite plan: ${plan}`)
  if (!options.check && options.writeReport === undefined) {
    verifyReport(gate.report, gates, true)
    process.stdout.write(encodeCanonicalJson({ verified: gate.report }))
    return
  }
  requireClean()
  if (options.writeReport !== undefined) {
    if (options.writeReport !== gate.report) throw new Error("Report target differs from plan-gates.")
    if (existsSync(resolve(root, options.writeReport))) throw new Error("Report target already exists.")
  }
  const commands = runCommands(gate.commands)
  if (options.check) {
    const audit = plan === "184" ? runAudit(root) : undefined
    process.stdout.write(encodeCanonicalJson({
      plan,
      checked: commands.length,
      ...(audit === undefined ? {} : { audit })
    }))
    return
  }
  const report = await buildReport(plan, gate, gates, commands)
  mkdirSync(dirname(resolve(root, gate.report)), { recursive: true })
  writeFileSync(resolve(root, gate.report), encodeCanonicalJson(report))
  verifyReport(gate.report, gates, true)
  process.stdout.write(encodeCanonicalJson({ plan, written: gate.report, reportHash: report.reportHash }))
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
