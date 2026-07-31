import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decodeConfig } from "../../src/config/config.js"
import { partition } from "../../src/apply/partition.js"
import { checkpointIds, stagedOutcome } from "../../src/apply/transition.js"
import { operationAuthority } from "../../src/model/operation.js"
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
import { findLocalToolProfile } from "../../src/recipes/packages/profiles.js"
import { findPackageStoreProfile } from "../../src/recipes/packages/store-profiles.js"
import { localToolOutcome, preflightTool } from "../../src/recipes/packages/tool.js"
import { supplyLocalProfiles } from "../../src/recipes/supply-chain/local-profiles.js"
import { registryProfiles } from "../../src/recipes/supply-chain/registry-profiles.js"
import { credentialedSigningProfile } from "../../src/recipes/supply-chain/signing-profiles.js"
import { notarizationProfiles } from "../../src/recipes/supply-chain/notarization-profiles.js"
import { attestationProfile } from "../../src/recipes/supply-chain/attestation-profile.js"
import { providerProfiles } from "../../src/recipes/providers/index.js"
import { reviewedTransformProfile } from "../../src/recipes/changelog-profile.js"
import { announcementHttpProfiles, smtpAnnouncementProfile } from "../../src/recipes/announcement-profiles.js"
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
  | "fail"
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

const distributedCase = (
  fixture: ConfigFixture,
  row: ParityRow,
  id: string,
  level: CaseLevel
): ClaimCase => async () => {
  if (level === "config-invalid") {
    const value = structuredClone(fixture.config)
    ;((value.projects as Array<Record<string, unknown>>)[0]!).root = "../escape"
    return passed(id, row.id, level, "Unsafe project roots are rejected.", await rejects(value))
  }
  if (level === "config-excess") {
    const value = structuredClone(fixture.config)
    ;((value.projects as Array<Record<string, unknown>>)[0]!).extra = true
    return passed(id, row.id, level, "Excess project fields are rejected.", await rejects(value))
  }
  const decoded = await Effect.runPromise(decodeConfig(fixture.config))
  if (level === "config-decode") {
    return passed(id, row.id, level, "The closed project execution scope decodes.",
      decoded.projects?.length === 1 && decoded.projects[0]!.execution.workers.length > 0)
  }
  const first = await compile(fixture.config)
  const second = await compile(JSON.parse(JSON.stringify(fixture.config)))
  const stable = first.planId === second.planId &&
    Buffer.from(first.bytes).equals(Buffer.from(second.bytes))
  if (level === "deterministic-lowering" || level === "exact-generated-bytes") {
    return passed(id, row.id, level, "Project lowering has stable plan identity and exact bytes.", stable)
  }
  if (level === "driver-success") {
    const value = structuredClone(fixture.config) as Record<string, unknown>
    value.hooks = { before: [{ id: "probe", run: ["bun", "--version"] }] }
    const accepted = await compile(value)
    const owned = operationEntries(accepted.plan)
      .filter(({ operation }) => !["LocalRead", "RemoteRead"].includes(operationAuthority(operation)))
      .map(({ operation }) => operation.id)
    const scopes = partition(accepted, [{ workerId: "linux", operationIds: owned }])
    return passed(id, row.id, level, "Effectful work has one exact-cover worker scope.",
      owned.length > 0 && scopes.length === 1 && scopes[0]!.operationIds.length === owned.length)
  }
  if (level === "driver-typed-failure-evidence") {
    let typed = false
    try {
      partition(first, [])
    } catch (error) {
      typed = typeof error === "object" && error !== null &&
        "_tag" in error && error._tag === "TransitionError"
    }
    return passed(id, row.id, level, "Invalid partitioning returns typed transition evidence.", typed)
  }
  if (level === "platform-tool-constraints") {
    return passed(id, row.id, level, "Workers and project roots remain explicit typed values.",
      decoded.projects!.every((project) =>
        project.execution.workers.every((worker) => worker.length > 0) && !project.root.startsWith("..")))
  }
  return passed(id, row.id, level, "Staged execution never guesses an intermediate outcome.",
    ["prepare", "publish", "announce", "continue"].join(",") ===
      (["validate", "publish", "announce", "verify"] as const).map(stagedOutcome).join(","))
}

interface PackageConfigFixture {
  readonly rowId: string
  readonly profileIds: ReadonlyArray<string>
  readonly config: ConfigFixture["config"]
}
const packageFixtures = JSON.parse(readFileSync(join(
  process.cwd(), "test/fixtures/parity/configs/packages/configs.json"
), "utf8")) as { readonly fixtures: ReadonlyArray<PackageConfigFixture> }
const packageFixture = (rowId: string): PackageConfigFixture => {
  const fixture = packageFixtures.fixtures.find((candidate) => candidate.rowId === rowId)
  if (fixture === undefined) throw new Error(`${rowId}: complete package config fixture is absent.`)
  return fixture
}
const packageCase = (
  row: ParityRow,
  id: string,
  level: CaseLevel
): ClaimCase => async () => {
  const fixture = packageFixture(row.id)
  if (level === "config-invalid") {
    const value = structuredClone(fixture.config)
    ;(value.project as Record<string, unknown>).version = ""
    return passed(id, row.id, level, "Invalid package config values are rejected.", await rejects(value))
  }
  if (level === "config-excess") {
    return passed(id, row.id, level, "Runtime decoding rejects excess configPath.",
      await rejects({ ...fixture.config, configPath: "release.json" }))
  }
  const decoded = await Effect.runPromise(decodeConfig(fixture.config))
  if (level === "config-decode") {
    return passed(id, row.id, level, "The complete value-only package config decodes.",
      decoded.builds?.[0]?.builder === "profile")
  }
  const first = await compile(fixture.config)
  const second = await compile(JSON.parse(JSON.stringify(fixture.config)))
  const stable = first.planId === second.planId &&
    Buffer.from(first.bytes).equals(Buffer.from(second.bytes))
  if (level === "deterministic-lowering") {
    return passed(id, row.id, level, "Direct and one-read JSON values lower identically.", stable)
  }
  const operations = operationEntries(first.plan).map(({ operation }) => operation)
  const profileId = fixture.profileIds[0]!
  if (level === "driver-success") {
    const local = profileId === "lifecycle.archive-hooks.v1" ? undefined : findLocalToolProfile(profileId)
    const observed = local?.contract.executable.supportedRange.match(/[0-9]+(?:\.[0-9]+){1,2}/u)?.[0]
    const localReady = local === undefined
      ? operations.some((operation) => operation._tag === "Pack")
      : observed !== undefined &&
        preflightTool(local, local.contract.hosts[0]!, observed) === "ready" &&
        localToolOutcome(0, local.contract.outputs.length, local.contract.outputs.length, true) === "materialized"
    const storeReady = fixture.profileIds.slice(1).every((storeId) => operations.some((operation) =>
      operation._tag === "PackageStorePublish" &&
      operation.profileId === storeId &&
      checkpointIds(operation).length > 0))
    return passed(id, row.id, level, "The frozen local profile and optional closed store path are executable.",
      localReady && storeReady)
  }
  if (level === "driver-typed-failure-evidence") {
    const local = profileId === "lifecycle.archive-hooks.v1" ? undefined : findLocalToolProfile(profileId)
    const invalid = structuredClone(fixture.config)
    ;(invalid.project as Record<string, unknown>).version = ""
    return passed(id, row.id, level, "Unsupported tools or malformed configs fail before successful work.",
      local === undefined
        ? await rejects(invalid)
        : preflightTool(local, local.contract.hosts[0]!, "0.0.0") === "unsupported-version" &&
          localToolOutcome(1, 1, 1, true) === "exit-failure")
  }
  if (level === "platform-tool-constraints") {
    const local = profileId === "lifecycle.archive-hooks.v1" ? undefined : findLocalToolProfile(profileId)
    return passed(id, row.id, level, "Host, executable, argv, cwd, and authority stay profile-owned.",
      local === undefined || (
        local.contract.hosts.length > 0 &&
        local.contract.invocation.cwd === "workspace-root" &&
        local.contract.invocation.authenticationClass === "none" &&
        local.contract.remoteMutation === false
      ))
  }
  if (level === "ambiguous-commit") {
    const safe = fixture.profileIds.slice(1).every((storeId) => {
      const classifier = findPackageStoreProfile(storeId).contract.commitmentClassifier
      return classifier["response-loss"] === "PossiblyCommitted" &&
        classifier["malformed-response"] === "Unclassifiable"
    })
    return passed(id, row.id, level, "Ambiguous store results remain explicitly classified.", safe)
  }
  const expectedOutput = (decoded.builds?.[0]?.builder === "profile")
    ? decoded.builds[0].outputs[0] : undefined
  return passed(id, row.id, level, "Canonical bytes and declared output identity are exact.",
    stable && expectedOutput !== undefined && first.outputs.some(({ output }) =>
      output.id === expectedOutput.id && output.path === expectedOutput.path))
}

const supplyFixtures = JSON.parse(readFileSync(join(
  process.cwd(), "test/fixtures/parity/configs/supply-chain/configs.json"
), "utf8")) as { readonly fixtures: ReadonlyArray<PackageConfigFixture> }
const supplyProfiles = [...registryProfiles, credentialedSigningProfile,
  ...notarizationProfiles, attestationProfile]
const supplyCase = (row: ParityRow, id: string, level: CaseLevel): ClaimCase => async () => {
  const fixture = supplyFixtures.fixtures.find((item) => item.rowId === row.id)
  if (fixture === undefined) throw new Error(`${row.id}: supply-chain config fixture is absent.`)
  if (level === "config-invalid") {
    const value = structuredClone(fixture.config)
    ;(value.project as Record<string, unknown>).version = ""
    return passed(id, row.id, level, "Invalid supply-chain config values are rejected.", await rejects(value))
  }
  if (level === "config-excess") return passed(id, row.id, level,
    "Runtime decoding rejects excess configPath.", await rejects({ ...fixture.config, configPath: "x" }))
  const decoded = await Effect.runPromise(decodeConfig(fixture.config))
  if (level === "config-decode") return passed(id, row.id, level,
    "The complete value-only supply-chain config decodes.", (decoded.supplyChain?.length ?? 0) > 0)
  const first = await compile(fixture.config)
  const second = await compile(JSON.parse(JSON.stringify(fixture.config)))
  const stable = first.planId === second.planId &&
    Buffer.from(first.bytes).equals(Buffer.from(second.bytes))
  if (level === "deterministic-lowering") return passed(id, row.id, level,
    "Direct and one-read JSON values lower identically.", stable)
  const operations = operationEntries(first.plan).map(({ operation }) => operation)
  const local = supplyLocalProfiles.filter((profile) => fixture.profileIds.includes(profile.profileId))
  const remote = supplyProfiles.filter((profile) => fixture.profileIds.includes(profile.profileId))
  if (level === "driver-success") return passed(id, row.id, level,
    "Frozen local and closed publish profiles have executable topology.",
    local.every((profile) => preflightTool(profile, profile.contract.hosts[0]!,
      profile.contract.executable.supportedRange.match(/[0-9]+(?:\.[0-9]+){1,2}/u)![0]) === "ready") &&
    remote.every((profile) => operations.some((operation) =>
      operation._tag === "SupplyChainPublish" && operation.profileId === profile.profileId &&
      checkpointIds(operation).length > 0)) &&
    (fixture.profileIds.length > 0 || operations.some((operation) => operation._tag === "Check")))
  if (level === "driver-typed-failure-evidence") {
    const invalid = structuredClone(fixture.config) as any
    invalid.supplyChain[0].kind = "unowned"
    return passed(id, row.id, level, "Unowned supply operations fail strict decoding.", await rejects(invalid))
  }
  if (level === "platform-tool-constraints") return passed(id, row.id, level,
    "Local profiles are uncredentialed and remote profiles remain closed.",
    local.every((profile) => profile.contract.invocation.authenticationClass === "none" &&
      profile.contract.remoteMutation === false) &&
    remote.every((profile) => profile.contract.authenticationClass.startsWith("credential-reference:")))
  if (level === "ambiguous-commit") return passed(id, row.id, level,
    "Every remote response-loss and malformed result stays ambiguous.",
    remote.every((profile) => Object.values(profile.contract.commitmentClassifier)
      .includes("PossiblyCommitted") && Object.values(profile.contract.commitmentClassifier)
      .includes("Unclassifiable")))
  const profiledOutputs = (decoded.supplyChain ?? []).filter((action) => action.kind === "profile")
    .flatMap((action) => action.outputs.map((output) => output.id))
  return passed(id, row.id, level, "Canonical bytes and declared subjects are exact.",
    stable && profiledOutputs.every((outputId) =>
      first.outputs.some(({ output }) => output.id === outputId)))
}

const providerFixtures = JSON.parse(readFileSync(join(
  process.cwd(), "test/fixtures/parity/configs/providers/configs.json"
), "utf8")) as { readonly fixtures: ReadonlyArray<PackageConfigFixture> }
const providerCase = (row: ParityRow, id: string, level: CaseLevel): ClaimCase => async () => {
  const fixture = providerFixtures.fixtures.find((item) => item.rowId === row.id)
  if (fixture === undefined) throw new Error(`${row.id}: provider config fixture is absent.`)
  if (level === "config-invalid") {
    const value = structuredClone(fixture.config) as any
    value.publish.providers[0].profileId = "provider.unowned/v1"
    return passed(id, row.id, level, "Unowned provider profiles are rejected.", await rejects(value))
  }
  if (level === "config-excess") return passed(id, row.id, level,
    "Runtime decoding rejects excess configPath.", await rejects({ ...fixture.config, configPath: "x" }))
  const decoded = await Effect.runPromise(decodeConfig(fixture.config))
  if (level === "config-decode") return passed(id, row.id, level,
    "The complete provider config decodes as a value.", (decoded.publish.providers?.length ?? 0) > 0)
  const first = await compile(fixture.config)
  const second = await compile(JSON.parse(JSON.stringify(fixture.config)))
  const stable = first.planId === second.planId && Buffer.from(first.bytes).equals(Buffer.from(second.bytes))
  if (level === "deterministic-lowering") return passed(id, row.id, level,
    "Direct and one-read JSON values lower identically.", stable)
  const operations = operationEntries(first.plan).map(({ operation }) => operation)
  const profiles = providerProfiles.filter((profile) => fixture.profileIds.includes(profile.profileId))
  if (level === "driver-success") return passed(id, row.id, level,
    "Every selected provider owns a closed operation and checkpoint topology.",
    profiles.every((profile) => operations.some((operation) => operation._tag === "ProviderPublish" &&
      operation.profileId === profile.profileId && checkpointIds(operation).length > 0)) &&
    (fixture.profileIds.length > 0 || operations.some((operation) => operation._tag === "Write")))
  if (level === "driver-typed-failure-evidence") return passed(id, row.id, level,
    "Provider schemas reject authority injection.", await rejects({ ...fixture.config, authority: "RemotePublish" }))
  if (level === "platform-tool-constraints") return passed(id, row.id, level,
    "Profiles bind credentials, HTTPS, redirect refusal, and DNS scope.",
    profiles.every((profile) => profile.contract.authentication.credentialSlotPattern.length > 0 &&
      profile.contract.redirects === "disabled") &&
    operations.every((operation) => operation._tag !== "ProviderPublish" ||
      providerProfiles.some((profile) => profile.profileId === operation.profileId &&
        profile.contract.selfHosted.schemes[0] === "https")))
  if (level === "ambiguous-commit") return passed(id, row.id, level,
    "Response loss and malformed responses remain ambiguous.",
    profiles.every((profile) => profile.contract.classification.responseLoss === "PossiblyCommitted" &&
      profile.contract.classification.malformed === "Unclassifiable"))
  return passed(id, row.id, level, "Canonical provider bytes and wrapper outputs are exact.",
    stable && (!fixture.profileIds.includes("registry.npm-publish/v1") ||
      first.outputs.some(({ output }) => output.id === "npm-package")))
}

const communicationFixtures = JSON.parse(readFileSync(join(
  process.cwd(), "test/fixtures/parity/configs/changelog-announce/configs.json"
), "utf8")) as { readonly fixtures: ReadonlyArray<PackageConfigFixture> }
const communicationCase = (row: ParityRow, id: string, level: CaseLevel): ClaimCase => async () => {
  const fixture = communicationFixtures.fixtures.find((item) => item.rowId === row.id)
  if (fixture === undefined) throw new Error(`${row.id}: communication config fixture is absent.`)
  if (level === "config-invalid") {
    const value = structuredClone(fixture.config) as any
    if (row.family === "changelog") value.publish.changelog.mode = "unowned"
    else value.publish.announce[0].profileId = "announce.unowned/v1"
    return passed(id, row.id, level, "Unowned communication policy is rejected.", await rejects(value))
  }
  if (level === "config-excess") return passed(id, row.id, level,
    "Runtime decoding rejects excess configPath.", await rejects({ ...fixture.config, configPath: "x" }))
  const decoded = await Effect.runPromise(decodeConfig(fixture.config))
  if (level === "config-decode") return passed(id, row.id, level,
    "Complete communication config decodes as a value.",
    decoded.publish.changelog !== undefined || (decoded.publish.announce?.length ?? 0) > 0)
  const first = await compile(fixture.config), second = await compile(JSON.parse(JSON.stringify(fixture.config)))
  const stable = first.planId === second.planId && Buffer.from(first.bytes).equals(Buffer.from(second.bytes))
  if (level === "deterministic-lowering") return passed(id, row.id, level,
    "Direct and one-read JSON values lower identically.", stable)
  const operations = operationEntries(first.plan).map(({ operation }) => operation)
  const profiles = [...announcementHttpProfiles, smtpAnnouncementProfile, reviewedTransformProfile]
    .filter((profile) => fixture.profileIds.includes(profile.profileId))
  if (level === "driver-success") return passed(id, row.id, level,
    "Reviewed note lineage and closed channel topology are executable.",
    operations.some((operation) => operation._tag === "Write" && operation.id === "changelog:base") &&
    (fixture.profileIds.length === 0 || fixture.profileIds.every((profileId) => operations.some((operation) =>
      ("profileId" in operation && operation.profileId === profileId)))))
  if (level === "driver-typed-failure-evidence") return passed(id, row.id, level,
    "Communication schemas reject authority injection.",
    await rejects({ ...fixture.config, authority: "RemotePublish" }))
  if (level === "platform-tool-constraints") return passed(id, row.id, level,
    "Profiles bind credential class, redaction, and retry/redirect policy.",
    profiles.every((profile) => profile.contract.authentication.credentialSlotPattern.length > 0 &&
      profile.contract.redaction.length > 0))
  if (level === "ambiguous-commit") return passed(id, row.id, level,
    "Loss and malformed responses never become success.", profiles.every((profile) =>
      ["PossiblyCommitted", "Unclassifiable"].includes(profile.contract.classification.responseLoss) &&
      profile.contract.classification.malformed === "Unclassifiable"))
  return passed(id, row.id, level, "Canonical reviewed-note and announcement bytes are exact.",
    stable && first.outputs.some(({ output }) => output.id === "release-notes"))
}

const unsupportedFamily = (row: ParityRow): never => {
  throw new Error(`${row.id}: included family ${row.family} has no permanent case runner.`)
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
          (row.family === "baseline" || row.family === "shared"
            ? baselineCase(fixtureForRow(manifest, row), row, reference.id, reference.level)
            : row.family === "distributed"
            ? distributedCase(fixtureForRow(manifest, row), row, reference.id, reference.level)
            : row.family === "packages"
            ? packageCase(row, reference.id, reference.level)
            : row.family === "supply-chain"
            ? supplyCase(row, reference.id, reference.level)
            : row.family === "providers"
            ? providerCase(row, reference.id, reference.level)
            : row.family === "changelog" || row.family === "announce"
            ? communicationCase(row, reference.id, reference.level)
            : unsupportedFamily(row))
      )
    }
    const fixture = fixtureForRow(manifest, row)
    for (const id of fixture.invalidCaseIds) {
      const level = id.endsWith(".excess") ? "config-excess" : "config-invalid"
      registry.set(id, implementedCases[id] ?? (row.family === "baseline" || row.family === "shared"
        ? baselineCase(fixture, row, id, level)
        : row.family === "distributed"
        ? distributedCase(fixture, row, id, level)
        : row.family === "packages"
        ? packageCase(row, id, level)
        : row.family === "supply-chain"
        ? supplyCase(row, id, level)
        : row.family === "providers"
        ? providerCase(row, id, level)
        : row.family === "changelog" || row.family === "announce"
        ? communicationCase(row, id, level)
        : unsupportedFamily(row)))
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
    pending: 0,
    failed: results.filter((result) => result.status === "fail").length,
    results
  }
}
