import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalJsonHash, type JsonValue } from "./canonical-json.js"
import { expectExactKeys, expectObject, parseStrictJson } from "./strict-json.js"

export const PARITY_MANIFEST_PATH = "parity/goreleaser-v2.17.0/manifest.json"
export const FINAL_PARITY_CLAIM =
  "Full in-scope outcome parity for TypeScript/Bun distribution against the pinned GoReleaser v2.17.0 ledger: 107/107 customization rows and 33/33 Pro rows, excluding C005, C008, C017, C023, C028, C047, C050, C051, P029, P035, and P036."

export const caseLevels = [
  "config-decode",
  "deterministic-lowering",
  "driver-success",
  "driver-typed-failure-evidence",
  "platform-tool-constraints",
  "ambiguous-commit",
  "exact-generated-bytes"
] as const
export type CaseLevel = typeof caseLevels[number] | "config-invalid" | "config-excess"

export interface ImplementationKeyReference {
  readonly key: string
  readonly ownerRowId: string
  readonly role: "owner" | "reuse"
}

export interface ParityCaseReference {
  readonly id: string
  readonly level: CaseLevel
}

export interface ParityRow {
  readonly id: string
  readonly population: "customization" | "deprecation" | "pro"
  readonly family: string
  readonly capabilityId: string
  readonly implementationKeys: ReadonlyArray<ImplementationKeyReference>
  readonly semantics: string
  readonly historicalDisposition: string
  readonly scope: "excluded" | "included" | "informational"
  readonly scopeRationale: string
  readonly assertionIds: ReadonlyArray<string>
  readonly requiredCases: ReadonlyArray<ParityCaseReference>
  readonly contractFixtureIds: ReadonlyArray<string>
  readonly configFixtureIds: ReadonlyArray<string>
  readonly divergence: JsonValue
  readonly implementationReferences: ReadonlyArray<string>
  readonly testReferences: ReadonlyArray<string>
}

export interface ConfigFixture {
  readonly id: string
  readonly rowId: string
  readonly provenance: "maintainer-product-decision" | "recorded-evidence"
  readonly decisionId: string
  readonly enclosingSection: string
  readonly config: { readonly [key: string]: JsonValue }
  readonly expectedLowering: { readonly [key: string]: JsonValue }
  readonly invalidCaseIds: ReadonlyArray<string>
}

export interface ExternalContractFixture {
  readonly id: string
  readonly profileId: string
  readonly provenance: "maintainer-product-decision" | "recorded-evidence"
  readonly decisionId: string
  readonly readiness: "maintainer-decision-required" | "recorded-contract-to-elaborate"
  readonly requiredFields: ReadonlyArray<string>
}

export interface ParityManifest {
  readonly schemaVersion: "goreleaser-parity-manifest/v1"
  readonly pin: {
    readonly product: "GoReleaser"
    readonly version: "v2.17.0"
    readonly commit: string
    readonly source: string
  }
  readonly populations: {
    readonly raw: { readonly customization: number; readonly pro: number; readonly deprecations: number }
    readonly eligible: { readonly customization: number; readonly pro: number }
    readonly excluded: {
      readonly customization: ReadonlyArray<string>
      readonly pro: ReadonlyArray<string>
    }
  }
  readonly claim: string
  readonly implementationKeyOwners: ReadonlyArray<{
    readonly key: string
    readonly ownerRowId: string
  }>
  readonly rows: ReadonlyArray<ParityRow>
  readonly configFixtures: ReadonlyArray<ConfigFixture>
  readonly externalContractFixtures: ReadonlyArray<ExternalContractFixture>
}

const rowKeys = [
  "id", "population", "family", "capabilityId", "implementationKeys", "semantics",
  "historicalDisposition", "scope", "scopeRationale", "assertionIds", "requiredCases",
  "contractFixtureIds", "configFixtureIds", "divergence", "implementationReferences",
  "testReferences"
]

const array = (value: JsonValue | undefined, name: string): ReadonlyArray<JsonValue> => {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array.`)
  return value
}

const string = (value: JsonValue | undefined, name: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a nonempty string.`)
  return value
}

const stringArray = (value: JsonValue | undefined, name: string): ReadonlyArray<string> =>
  array(value, name).map((item, index) => string(item, `${name}[${index}]`))

const unique = (values: ReadonlyArray<string>, name: string): void => {
  if (new Set(values).size !== values.length) throw new Error(`${name} contains duplicates.`)
}

const forbiddenConfigKeys = new Set([
  "adapter", "adapterDefinition", "authority", "configPath", "credentialValue", "renderer",
  "rendererCode", "responseSchema", "runtimeProfile", "templateCode"
])

const scanConfig = (value: JsonValue, path: string): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanConfig(item, `${path}[${index}]`))
    return
  }
  if (typeof value !== "object" || value === null) return
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenConfigKeys.has(key)) throw new Error(`${path}.${key} is forbidden at the config boundary.`)
    scanConfig(item, `${path}.${key}`)
  }
}

const decodeRow = (value: JsonValue, index: number): ParityRow => {
  const row = expectObject(value, `rows[${index}]`)
  expectExactKeys(row, rowKeys)
  const id = string(row.id, `rows[${index}].id`)
  const population = string(row.population, `${id}.population`)
  const scope = string(row.scope, `${id}.scope`)
  if (!["customization", "deprecation", "pro"].includes(population)) {
    throw new Error(`${id}: invalid population.`)
  }
  if (!["excluded", "included", "informational"].includes(scope)) {
    throw new Error(`${id}: invalid scope.`)
  }
  const implementationKeys = array(row.implementationKeys, `${id}.implementationKeys`).map((item) => {
    const reference = expectObject(item, `${id}.implementationKey`)
    expectExactKeys(reference, ["key", "ownerRowId", "role"])
    const role = string(reference.role, `${id}.implementationKey.role`)
    if (role !== "owner" && role !== "reuse") throw new Error(`${id}: invalid implementation role.`)
    const checkedRole: "owner" | "reuse" = role
    return {
      key: string(reference.key, `${id}.implementationKey.key`),
      ownerRowId: string(reference.ownerRowId, `${id}.implementationKey.ownerRowId`),
      role: checkedRole
    }
  })
  const requiredCases = array(row.requiredCases, `${id}.requiredCases`).map((item) => {
    const reference = expectObject(item, `${id}.requiredCase`)
    expectExactKeys(reference, ["id", "level"])
    const level = string(reference.level, `${id}.requiredCase.level`)
    if (!caseLevels.includes(level as typeof caseLevels[number])) {
      throw new Error(`${id}: invalid case level ${level}.`)
    }
    return {
      id: string(reference.id, `${id}.requiredCase.id`),
      level: level as typeof caseLevels[number]
    }
  })
  return {
    id,
    population: population as ParityRow["population"],
    family: string(row.family, `${id}.family`),
    capabilityId: string(row.capabilityId, `${id}.capabilityId`),
    implementationKeys,
    semantics: string(row.semantics, `${id}.semantics`),
    historicalDisposition: string(row.historicalDisposition, `${id}.historicalDisposition`),
    scope: scope as ParityRow["scope"],
    scopeRationale: string(row.scopeRationale, `${id}.scopeRationale`),
    assertionIds: stringArray(row.assertionIds, `${id}.assertionIds`),
    requiredCases,
    contractFixtureIds: stringArray(row.contractFixtureIds, `${id}.contractFixtureIds`),
    configFixtureIds: stringArray(row.configFixtureIds, `${id}.configFixtureIds`),
    divergence: row.divergence!,
    implementationReferences: stringArray(row.implementationReferences, `${id}.implementationReferences`),
    testReferences: stringArray(row.testReferences, `${id}.testReferences`)
  }
}

const decodeConfigFixture = (value: JsonValue, index: number): ConfigFixture => {
  const fixture = expectObject(value, `configFixtures[${index}]`)
  expectExactKeys(fixture, [
    "id", "rowId", "provenance", "decisionId", "enclosingSection", "config",
    "expectedLowering", "invalidCaseIds"
  ])
  const provenance = string(fixture.provenance, `configFixtures[${index}].provenance`)
  if (provenance !== "recorded-evidence" && provenance !== "maintainer-product-decision") {
    throw new Error(`configFixtures[${index}] has invalid provenance.`)
  }
  const config = expectObject(fixture.config!, `configFixtures[${index}].config`)
  if (!("project" in config) || !("publish" in config)) {
    throw new Error(`configFixtures[${index}] must be a complete config with project and publish.`)
  }
  scanConfig(config, `configFixtures[${index}].config`)
  const invalidCaseIds = stringArray(fixture.invalidCaseIds, `configFixtures[${index}].invalidCaseIds`)
  if (
    invalidCaseIds.length !== 2 ||
    !invalidCaseIds.some((id) => id.endsWith(".invalid")) ||
    !invalidCaseIds.some((id) => id.endsWith(".excess"))
  ) {
    throw new Error(`configFixtures[${index}] must name invalid and excess cases.`)
  }
  return {
    id: string(fixture.id, `configFixtures[${index}].id`),
    rowId: string(fixture.rowId, `configFixtures[${index}].rowId`),
    provenance,
    decisionId: string(fixture.decisionId, `configFixtures[${index}].decisionId`),
    enclosingSection: string(fixture.enclosingSection, `configFixtures[${index}].enclosingSection`),
    config,
    expectedLowering: expectObject(fixture.expectedLowering!, `configFixtures[${index}].expectedLowering`),
    invalidCaseIds
  }
}

const decodeExternalFixture = (value: JsonValue, index: number): ExternalContractFixture => {
  const fixture = expectObject(value, `externalContractFixtures[${index}]`)
  expectExactKeys(fixture, [
    "id", "profileId", "provenance", "decisionId", "readiness", "requiredFields"
  ])
  const provenance = string(fixture.provenance, `externalContractFixtures[${index}].provenance`)
  const readiness = string(fixture.readiness, `externalContractFixtures[${index}].readiness`)
  if (provenance !== "recorded-evidence" && provenance !== "maintainer-product-decision") {
    throw new Error(`externalContractFixtures[${index}] has invalid provenance.`)
  }
  if (readiness !== "maintainer-decision-required" && readiness !== "recorded-contract-to-elaborate") {
    throw new Error(`externalContractFixtures[${index}] has invalid readiness.`)
  }
  const requiredFields = stringArray(fixture.requiredFields, `externalContractFixtures[${index}].requiredFields`)
  const expectedFields = [
    "supportedVersionRange", "versionProbe", "requestOrArgv", "authenticationClass",
    "strictResponseShape", "commitmentClassifier", "readOnlyReconciliation"
  ]
  if (JSON.stringify(requiredFields) !== JSON.stringify(expectedFields)) {
    throw new Error(`externalContractFixtures[${index}] has an incomplete field contract.`)
  }
  return {
    id: string(fixture.id, `externalContractFixtures[${index}].id`),
    profileId: string(fixture.profileId, `externalContractFixtures[${index}].profileId`),
    provenance,
    decisionId: string(fixture.decisionId, `externalContractFixtures[${index}].decisionId`),
    readiness,
    requiredFields
  }
}

const expectedIds = (prefix: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(3, "0")}`)

export const decodeParityManifest = (text: string): ParityManifest => {
  const parsed = expectObject(parseStrictJson(text), "parity manifest")
  expectExactKeys(parsed, [
    "schemaVersion", "pin", "populations", "claim", "implementationKeyOwners", "rows",
    "configFixtures", "externalContractFixtures"
  ])
  if (parsed.schemaVersion !== "goreleaser-parity-manifest/v1") {
    throw new Error("Unknown parity manifest schemaVersion.")
  }
  const pin = expectObject(parsed.pin!, "parity pin")
  expectExactKeys(pin, ["product", "version", "commit", "source"])
  if (
    pin.product !== "GoReleaser" || pin.version !== "v2.17.0" ||
    pin.commit !== "770a4fc7a8fb2dca874b6c98cb739dd64fc931c0"
  ) {
    throw new Error("Parity pin drifted.")
  }
  const populations = expectObject(parsed.populations!, "populations")
  expectExactKeys(populations, ["raw", "eligible", "excluded"])
  const raw = expectObject(populations.raw!, "populations.raw")
  const eligible = expectObject(populations.eligible!, "populations.eligible")
  const excluded = expectObject(populations.excluded!, "populations.excluded")
  expectExactKeys(raw, ["customization", "pro", "deprecations"])
  expectExactKeys(eligible, ["customization", "pro"])
  expectExactKeys(excluded, ["customization", "pro"])
  if (
    raw.customization !== 115 || raw.pro !== 36 || raw.deprecations !== 40 ||
    eligible.customization !== 107 || eligible.pro !== 33
  ) {
    throw new Error("Parity population contract drifted.")
  }
  const excludedCustomization = stringArray(excluded.customization, "excluded customization")
  const excludedPro = stringArray(excluded.pro, "excluded pro")
  if (
    JSON.stringify(excludedCustomization) !==
      JSON.stringify(["C005", "C008", "C017", "C023", "C028", "C047", "C050", "C051"]) ||
    JSON.stringify(excludedPro) !== JSON.stringify(["P029", "P035", "P036"])
  ) {
    throw new Error("Parity exclusions drifted.")
  }
  const rows = array(parsed.rows, "rows").map(decodeRow)
  unique(rows.map((row) => row.id), "row ids")
  const customization = rows.filter((row) => row.population === "customization")
  const pro = rows.filter((row) => row.population === "pro")
  const deprecations = rows.filter((row) => row.population === "deprecation")
  if (
    JSON.stringify(customization.map((row) => row.id)) !== JSON.stringify(expectedIds("C", 115)) ||
    JSON.stringify(pro.map((row) => row.id)) !== JSON.stringify(expectedIds("P", 36)) ||
    JSON.stringify(deprecations.map((row) => row.id)) !== JSON.stringify(expectedIds("D", 40))
  ) {
    throw new Error("Parity row ids are not total and ordered.")
  }
  if (
    customization.filter((row) => row.scope === "included").length !== 107 ||
    pro.filter((row) => row.scope === "included").length !== 33 ||
    deprecations.some((row) => row.scope !== "informational")
  ) {
    throw new Error("Derived parity populations drifted.")
  }
  const configFixtures = array(parsed.configFixtures, "configFixtures").map(decodeConfigFixture)
  const externalContractFixtures = array(parsed.externalContractFixtures, "externalContractFixtures")
    .map(decodeExternalFixture)
  unique(configFixtures.map((fixture) => fixture.id), "config fixture ids")
  unique(externalContractFixtures.map((fixture) => fixture.id), "external fixture ids")
  const configById = new Map(configFixtures.map((fixture) => [fixture.id, fixture]))
  const contractIds = new Set(externalContractFixtures.map((fixture) => fixture.id))
  const allCaseIds: Array<string> = []
  for (const row of rows) {
    unique(row.implementationKeys.map((reference) => reference.key), `${row.id} implementation keys`)
    unique(row.requiredCases.map((reference) => reference.id), `${row.id} case ids`)
    unique(row.assertionIds, `${row.id} assertion ids`)
    allCaseIds.push(...row.requiredCases.map((reference) => reference.id))
    if (row.scope === "included") {
      if (
        row.implementationKeys.length === 0 || row.assertionIds.length === 0 ||
        row.requiredCases.length !== caseLevels.length || row.configFixtureIds.length === 0
      ) {
        throw new Error(`${row.id}: included row contract is incomplete.`)
      }
      for (const fixtureId of row.configFixtureIds) {
        const fixture = configById.get(fixtureId)
        if (fixture?.rowId !== row.id) throw new Error(`${row.id}: invalid config fixture ${fixtureId}.`)
        allCaseIds.push(...fixture.invalidCaseIds)
      }
    } else if (
      row.implementationKeys.length !== 0 || row.requiredCases.length !== 0 ||
      row.assertionIds.length !== 0 || row.configFixtureIds.length !== 0
    ) {
      throw new Error(`${row.id}: excluded/informational row carries executable state.`)
    }
    for (const fixtureId of row.contractFixtureIds) {
      if (!contractIds.has(fixtureId)) throw new Error(`${row.id}: unknown contract fixture ${fixtureId}.`)
    }
  }
  unique(allCaseIds, "all case ids")
  const owners = array(parsed.implementationKeyOwners, "implementationKeyOwners").map((value, index) => {
    const owner = expectObject(value, `implementationKeyOwners[${index}]`)
    expectExactKeys(owner, ["key", "ownerRowId"])
    return {
      key: string(owner.key, `implementationKeyOwners[${index}].key`),
      ownerRowId: string(owner.ownerRowId, `implementationKeyOwners[${index}].ownerRowId`)
    }
  })
  unique(owners.map((owner) => owner.key), "implementation key owners")
  const ownerMap = new Map(owners.map((owner) => [owner.key, owner.ownerRowId]))
  for (const owner of owners) {
    const ownerReferences = rows.flatMap((row) =>
      row.implementationKeys.filter((reference) =>
        reference.key === owner.key && reference.role === "owner" && row.id === owner.ownerRowId
      )
    )
    if (ownerReferences.length !== 1) throw new Error(`${owner.key}: expected one owner reference.`)
  }
  for (const row of rows) {
    for (const reference of row.implementationKeys) {
      if (ownerMap.get(reference.key) !== reference.ownerRowId) {
        throw new Error(`${row.id}: ownership mismatch for ${reference.key}.`)
      }
      if (reference.role === "owner" && reference.ownerRowId !== row.id) {
        throw new Error(`${row.id}: owner role belongs to another row.`)
      }
      if (reference.role === "reuse" && reference.ownerRowId === row.id) {
        throw new Error(`${row.id}: reuse role points to itself.`)
      }
    }
  }
  const claim = string(parsed.claim, "claim")
  if (claim !== FINAL_PARITY_CLAIM) throw new Error("Permitted final parity claim drifted.")
  return {
    schemaVersion: "goreleaser-parity-manifest/v1",
    pin: {
      product: "GoReleaser",
      version: "v2.17.0",
      commit: string(pin.commit, "pin.commit"),
      source: string(pin.source, "pin.source")
    },
    populations: {
      raw: { customization: 115, pro: 36, deprecations: 40 },
      eligible: { customization: 107, pro: 33 },
      excluded: { customization: excludedCustomization, pro: excludedPro }
    },
    claim,
    implementationKeyOwners: owners,
    rows,
    configFixtures,
    externalContractFixtures
  }
}

export const readParityManifest = (root: string): ParityManifest =>
  decodeParityManifest(readFileSync(resolve(root, PARITY_MANIFEST_PATH), "utf8"))

export const parityManifestHash = (root: string): string =>
  canonicalJsonHash(parseStrictJson(readFileSync(resolve(root, PARITY_MANIFEST_PATH), "utf8")))

export const requiredCaseIds = (
  manifest: ParityManifest,
  row: ParityRow
): ReadonlyArray<string> => [
  ...row.requiredCases.map((reference) => reference.id),
  ...row.configFixtureIds.flatMap((fixtureId) =>
    manifest.configFixtures.find((fixture) => fixture.id === fixtureId)?.invalidCaseIds ?? []
  )
]

export const validateParityClaim = (
  text: string,
  passingCustomization: number,
  passingPro: number
): void => {
  if (text === FINAL_PARITY_CLAIM) {
    if (passingCustomization !== 107 || passingPro !== 33) {
      throw new Error("The final parity claim requires fresh 107/107 and 33/33 case results.")
    }
    return
  }
  if (/\bfull\b.*\bparity\b|\bparity\b.*\bfull\b/iu.test(text)) {
    throw new Error("Unqualified full-parity claim is forbidden.")
  }
  throw new Error("Parity claim text must use the single frozen final wording.")
}
