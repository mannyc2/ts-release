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
          dynamicCase(manifest, row, reference.id, reference.level)
      )
    }
    const fixture = fixtureForRow(manifest, row)
    for (const id of fixture.invalidCaseIds) {
      const level = id.endsWith(".excess") ? "config-excess" : "config-invalid"
      registry.set(id, implementedCases[id] ?? dynamicCase(manifest, row, id, level))
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
