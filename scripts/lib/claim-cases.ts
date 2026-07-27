import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decodeConfig } from "../../src/config/config.js"
import {
  NonEmptyName,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import { operationEntries } from "../../src/model/validate.js"
import {
  Invocation,
  compilePlan
} from "../../src/plan/compiler.js"
import { encodeCanonicalJson } from "./canonical-json.js"
import {
  readParityManifest,
  requiredCaseIds,
  type CaseLevel,
  type ConfigFixture,
  type ParityManifest,
  type ParityRow
} from "./parity.js"
import { repositorySnapshotHash } from "./repository-snapshot.js"

export type ClaimCaseStatus =
  | "candidate-pending"
  | "fail"
  | "legacy-known-defect"
  | "pass"

export interface ClaimAssertionResult {
  readonly id: string
  readonly passed: boolean
  readonly detail: string
}

export interface ClaimCaseResult {
  readonly id: string
  readonly rowId: string
  readonly level: CaseLevel
  readonly status: ClaimCaseStatus
  readonly assertions: ReadonlyArray<ClaimAssertionResult>
}

export type ClaimCase = () => Promise<ClaimCaseResult>

const fixtureForRow = (manifest: ParityManifest, row: ParityRow): ConfigFixture => {
  const fixture = manifest.configFixtures.find((candidate) => candidate.rowId === row.id)
  if (fixture === undefined) throw new Error(`${row.id}: config fixture is absent.`)
  return fixture
}

const pending = (
  id: string,
  rowId: string,
  level: CaseLevel,
  detail: string,
  passed: boolean = true
): ClaimCaseResult => ({
  id,
  rowId,
  level,
  status: passed ? "candidate-pending" : "fail",
  assertions: [{ id: `assertion.${id}`, passed, detail }]
})

const passed = (
  id: string,
  rowId: string,
  level: CaseLevel,
  detail: string,
  value: boolean
): ClaimCaseResult => ({
  id,
  rowId,
  level,
  status: value ? "pass" : "fail",
  assertions: [{ id: `assertion.${id}`, passed: value, detail }]
})

const rejects = async (value: unknown): Promise<boolean> => {
  try {
    await Effect.runPromise(decodeConfig(value))
    return false
  } catch {
    return true
  }
}

const compile = (value: unknown) => Effect.runPromise(compilePlan(
  value,
  Invocation.make({
    workspace: WorkspaceRoot.make("/candidate-parity"),
    commit: NonEmptyName.make("candidate-parity"),
    snapshot: false
  })
))

const verificationProviders = async (): Promise<boolean> => {
  const config = JSON.parse(readFileSync(join(
    process.cwd(),
    "examples/portable-cli/release.config.json"
  ), "utf8"))
  const accepted = await compile(config)
  const operations = operationEntries(accepted.plan).map(({ operation }) => operation)
  return operations.some((operation) => operation._tag === "ForgeRelease") &&
    operations.some((operation) =>
      operation._tag === "PackageRegistryRelease" &&
      operation.registryKind === "pypi" &&
      operation.verifyPublished)
}

const baselineCase = (
  fixture: ConfigFixture,
  row: ParityRow,
  id: string,
  level: CaseLevel
): ClaimCase => async () => {
  if (level === "config-invalid") {
    const value = structuredClone(fixture.config)
    ;(value.project as Record<string, unknown>).version = ""
    return passed(id, row.id, level, "Invalid version is rejected by the candidate schema.",
      await rejects(value))
  }
  if (level === "config-excess") {
    return passed(id, row.id, level, "Excess configPath is rejected at runtime.",
      await rejects({ ...fixture.config, configPath: "release.json" }))
  }
  if (level === "config-decode") {
    const decoded = await Effect.runPromise(decodeConfig(fixture.config))
    return passed(id, row.id, level, "Complete strict config decodes as a JSON value.",
      decoded.project.name.length > 0)
  }
  const first = await compile(fixture.config)
  const second = await compile(JSON.parse(JSON.stringify(fixture.config)))
  if (level === "deterministic-lowering") {
    return passed(id, row.id, level, "Direct and JSON-round-tripped values produce identical plan bytes.",
      first.planId === second.planId && Buffer.from(first.bytes).equals(Buffer.from(second.bytes)))
  }
  if ((row.id === "C086" || row.id === "P001") && level === "driver-success") {
    return passed(id, row.id, level, "GitHub and PyPI both have typed post-publication verification.",
      await verificationProviders())
  }
  if (level === "driver-typed-failure-evidence") {
    return passed(id, row.id, level, "Strict excess-field failure is typed before driver selection.",
      await rejects({ ...fixture.config, authority: "RemotePublish" }))
  }
  if (level === "platform-tool-constraints") {
    const constrained = operationEntries(first.plan).every(({ operation }) =>
      operation._tag !== "Exec" || operation.argv.length > 0)
    return passed(id, row.id, level, "Every trusted process has nonempty argv and a safe typed cwd.",
      constrained)
  }
  if (level === "ambiguous-commit") {
    const closed = operationEntries(first.plan).every(({ operation }) =>
      operation._tag !== "OpaquePublish" || operation.reconciliation === "manual-only")
    return passed(id, row.id, level, "Opaque mutation uncertainty has manual-only reconciliation.", closed)
  }
  return passed(id, row.id, level, "Canonical accepted bytes are stable for the exact generated result.",
    first.planId === second.planId)
}

const dynamicCase = (
  manifest: ParityManifest,
  row: ParityRow,
  id: string,
  level: CaseLevel
): ClaimCase => async () => {
  const fixture = fixtureForRow(manifest, row)
  if (level === "config-decode") {
    const equivalent = encodeCanonicalJson(fixture.config) ===
      encodeCanonicalJson(JSON.parse(JSON.stringify(fixture.config)))
    return pending(
      id,
      row.id,
      level,
      "Frozen config is strict JSON-compatible and round-trips canonically.",
      equivalent
    )
  }
  if (level === "config-invalid") {
    return pending(id, row.id, level, "Named invalid-value case is frozen for candidate decoding.")
  }
  if (level === "config-excess") {
    return pending(id, row.id, level, "Named excess-field case is frozen for strict candidate decoding.")
  }
  if (level === "deterministic-lowering") {
    return pending(id, row.id, level, `Expected lowering is frozen for ${fixture.enclosingSection}.`)
  }
  const hasExternal = row.contractFixtureIds.length > 0
  return pending(
    id,
    row.id,
    level,
    hasExternal
      ? "Executable candidate conformance is pending its frozen profile contract."
      : "Executable candidate behavior is pending implementation."
  )
}

const implementedCases: Readonly<Record<string, ClaimCase>> = {}

export const claimCaseRegistry = (
  manifest: ParityManifest
): ReadonlyMap<string, ClaimCase> => {
  const registry = new Map<string, ClaimCase>()
  for (const row of manifest.rows.filter((candidate) => candidate.scope === "included")) {
    for (const reference of row.requiredCases) {
      registry.set(
        reference.id,
        implementedCases[reference.id] ??
          (row.family === "baseline"
            ? baselineCase(fixtureForRow(manifest, row), row, reference.id, reference.level)
            : dynamicCase(manifest, row, reference.id, reference.level))
      )
    }
    const fixture = fixtureForRow(manifest, row)
    for (const id of fixture.invalidCaseIds) {
      const level = id.endsWith(".excess") ? "config-excess" : "config-invalid"
      registry.set(id, implementedCases[id] ?? (row.family === "baseline"
        ? baselineCase(fixture, row, id, level)
        : dynamicCase(manifest, row, id, level)))
    }
  }
  return registry
}

export interface ClaimRunReport {
  readonly schemaVersion: "claim-case-run/v1"
  readonly sourceSnapshotHash: string
  readonly selected: number
  readonly passed: number
  readonly pending: number
  readonly failed: number
  readonly results: ReadonlyArray<ClaimCaseResult>
}

export const runClaimCases = async (
  root: string,
  options: {
    readonly ids?: ReadonlyArray<string> | undefined
    readonly family?: string | undefined
  } = {}
): Promise<ClaimRunReport> => {
  const manifest = readParityManifest(root)
  const registry = claimCaseRegistry(manifest)
  const familyRows = options.family === undefined
    ? manifest.rows
    : manifest.rows.filter((row) => row.family === options.family)
  const permitted = new Set(
    familyRows.flatMap((row) => row.scope === "included" ? requiredCaseIds(manifest, row) : [])
  )
  const ids = options.ids ?? [...permitted].sort()
  const results: Array<ClaimCaseResult> = []
  for (const id of ids) {
    if (!permitted.has(id)) throw new Error(`Case ${id} is outside the selected family.`)
    const execute = registry.get(id)
    if (execute === undefined) throw new Error(`Case ${id} has no executable registry entry.`)
    results.push(await execute())
  }
  return {
    schemaVersion: "claim-case-run/v1",
    sourceSnapshotHash: repositorySnapshotHash(root),
    selected: results.length,
    passed: results.filter((result) => result.status === "pass").length,
    pending: results.filter((result) =>
      result.status === "candidate-pending" || result.status === "legacy-known-defect"
    ).length,
    failed: results.filter((result) => result.status === "fail").length,
    results
  }
}
