import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  capabilityModules
} from "../../src/capabilities/registry.js"
import type { CapabilityModule } from "../../src/capabilities/module.js"
import { validateFieldOwnership } from "../../src/capabilities/field-ownership.js"
import { authoredConfigPropertyPaths } from "./config-fields.js"

export type EvidenceClass = "source-derived" | "external-docs-derived" | "contract-tested" | "live-read-verified" | "live-write-dogfooded"
export interface CapabilityEvidenceReference { readonly kind: "test" | "source" | "release" | "url", readonly path: string }
export interface CapabilityEvidenceRecord {
  readonly id: string
  readonly evidenceClass: EvidenceClass
  readonly observedAt: string
  readonly references: ReadonlyArray<CapabilityEvidenceReference>
  readonly note?: string
}
export interface CapabilityEvidenceFile { readonly schemaVersion: "ts-release-capability-evidence/v1", readonly records: ReadonlyArray<CapabilityEvidenceRecord> }
export interface CapabilityTruthReport { readonly failures: ReadonlyArray<string>, readonly capabilities: number, readonly fields: number }

const evidencePath = (root: string): string => join(root, "docs", "capability-evidence.json")
const outputPath = (root: string): string => join(root, "docs", "capabilities.md")
const isDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/u.test(value)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

export const readCapabilityEvidence = (root: string): CapabilityEvidenceFile => {
  const value: unknown = JSON.parse(readFileSync(evidencePath(root), "utf8"))
  if (!isRecord(value) || value.schemaVersion !== "ts-release-capability-evidence/v1" || !Array.isArray(value.records)) {
    throw new Error("capability evidence must use ts-release-capability-evidence/v1 with records.")
  }
  return value as unknown as CapabilityEvidenceFile
}

/**
 * Validate executable composition itself. Tests and prose can certify an
 * installed module, but cannot manufacture one or repair a missing method.
 */
export const validateCapabilityTruth = (
  root: string,
  registry: ReadonlyArray<CapabilityModule> = capabilityModules,
  evidence: CapabilityEvidenceFile = readCapabilityEvidence(root)
): CapabilityTruthReport => {
  const failures: Array<string> = []
  const registryIds = new Set<string>()
  for (const module of registry) {
    if (registryIds.has(module.id)) failures.push(`duplicate registry capability id: ${module.id}`)
    registryIds.add(module.id)
    if (module.fields.length === 0) failures.push(`${module.id} owns no exact public config fields`)
    if (module.requirements.executionHosts.length === 0) failures.push(`${module.id} has no execution-host constraint`)
    if (module.certification.tests.length === 0) failures.push(`${module.id} has no certification boundary test`)
    for (const test of module.certification.tests) {
      if (!existsSync(join(root, test))) failures.push(`${module.id} names a missing certification test: ${test}`)
    }
    if (module._tag === "ResolutionCapability" && typeof module.resolve !== "function") {
      failures.push(`${module.id} has no executable resolver`)
    }
    if (module._tag === "PreparationCapability" && typeof module.contribute !== "function") {
      failures.push(`${module.id} has no executable graph contributor`)
    }
    if (module._tag === "PublicationCapability") {
      if (typeof module.contribute !== "function" || typeof module.subjects !== "function") {
        failures.push(`${module.id} does not bind graph contribution to runtime subjects`)
      }
      if (module.profile.id !== module.id || module.profile.preparedTag !== module.preparedTag) {
        failures.push(`${module.id} publication profile does not match its installed module`)
      }
    }
  }

  const ownership = validateFieldOwnership(authoredConfigPropertyPaths(), registry)
  failures.push(...ownership.failures)

  const evidenceIds = new Set<string>()
  const classes = new Set<EvidenceClass>(["source-derived", "external-docs-derived", "contract-tested", "live-read-verified", "live-write-dogfooded"])
  const referenceKinds = new Set<CapabilityEvidenceReference["kind"]>(["test", "source", "release", "url"])
  for (const record of evidence.records) {
    if (evidenceIds.has(record.id)) failures.push(`duplicate evidence capability id: ${record.id}`)
    evidenceIds.add(record.id)
    if (!classes.has(record.evidenceClass)) failures.push(`${record.id} has an unknown evidence class`)
    if (!isDate(record.observedAt)) failures.push(`${record.id} has an invalid evidence date`)
    if (record.references.length === 0) failures.push(`${record.id} has no sanitized evidence reference`)
    for (const reference of record.references) {
      if (!referenceKinds.has(reference.kind)) failures.push(`${record.id} has an unknown evidence reference kind`)
      if (reference.path.startsWith("/") || reference.path.includes("..")) failures.push(`${record.id} has an unsafe evidence reference: ${reference.path}`)
      if (reference.kind === "test" && !existsSync(join(root, reference.path))) failures.push(`${record.id} names a missing evidence test: ${reference.path}`)
    }
    const has = (kind: CapabilityEvidenceReference["kind"]): boolean => record.references.some((reference) => reference.kind === kind)
    if (record.evidenceClass === "source-derived" && !has("source")) failures.push(`${record.id} source evidence names no source reference`)
    if (record.evidenceClass === "external-docs-derived" && !has("url")) failures.push(`${record.id} external-docs evidence names no URL reference`)
    if (record.evidenceClass === "contract-tested" && !has("test")) failures.push(`${record.id} contract evidence names no test reference`)
    if (record.evidenceClass === "live-read-verified" && !has("release") && !has("url")) failures.push(`${record.id} live-read evidence names no release or URL reference`)
    if (record.evidenceClass === "live-write-dogfooded" && (!has("release") || !has("url"))) failures.push(`${record.id} live-write evidence requires release and URL references`)
  }
  for (const id of registryIds) if (!evidenceIds.has(id)) failures.push(`registry capability ${id} has no evidence record`)
  for (const id of evidenceIds) if (!registryIds.has(id)) failures.push(`evidence capability ${id} has no registry entry`)
  return { failures, capabilities: registry.length, fields: ownership.rows.length }
}

const display = (values: ReadonlyArray<string>): string => values.length === 0 ? "—" : values.join(", ")

export const renderCapabilities = (
  root: string,
  registry: ReadonlyArray<CapabilityModule> = capabilityModules,
  evidence: CapabilityEvidenceFile = readCapabilityEvidence(root)
): string => {
  const records = new Map(evidence.records.map((record) => [record.id, record]))
  const rows = registry.map((module) => {
    const record = records.get(module.id)
    if (record === undefined) throw new Error(`cannot render capability without evidence: ${module.id}`)
    const execution = module._tag === "ResolutionCapability"
      ? "resolve"
      : module._tag === "PreparationCapability"
      ? `contribute:${module.phase}`
      : `contribute + subjects:${module.preparedTag}`
    return `| \`${module.id}\` | installed | ${execution} | ${module.fields.length} | ${module.certification.boundary} | ${module.certification.tests.length} executable test${module.certification.tests.length === 1 ? "" : "s"} | ${display(module.requirements.executionHosts)} | ${display(module.requirements.artifactTargets)} | ${display(module.requirements.nativeTools)} | ${display(module.requirements.credentialStrategies)} | ${record.evidenceClass} | ${record.observedAt} |`
  })
  return `# Executable capabilities

This page is generated from the actual module values composed by the compiler
and runtime, plus the dated records in [\`capability-evidence.json\`](capability-evidence.json).
A filename, schema field, test reference, or prose row cannot install support.

Evidence classes remain distinct. Contract-tested support is not a claim that
a live provider mutation has been dogfooded.

| Capability | State | Executable composition | Owned fields | Boundary | Certification | Declared execution hosts | Declared artifact targets | Native tools | Credentials | Evidence | Observed |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

Native Windows execution is not installed. The source-preparation module
declares only the listed artifact targets and the Linux execution host.
Release support requires separate public-entrypoint host smoke and target
file-format/architecture gates; declarations alone are not certification.
Linux preparation requires an external Bun executable and \`libseccomp.so.2\`.
The standalone CLI still uses those native tools for network-denied commands
and is not a self-contained preparation sandbox.
`
}

export const checkCapabilityOutput = (root: string): CapabilityTruthReport => {
  const evidence = readCapabilityEvidence(root)
  const report = validateCapabilityTruth(root, capabilityModules, evidence)
  if (report.failures.length > 0) return report
  if (!existsSync(outputPath(root))) return { ...report, failures: ["docs/capabilities.md is missing; run generate:capabilities"] }
  if (readFileSync(outputPath(root), "utf8") !== renderCapabilities(root, capabilityModules, evidence)) return { ...report, failures: ["docs/capabilities.md is stale; run generate:capabilities"] }
  return report
}

export const generateCapabilityOutput = (root: string): void => {
  const evidence = readCapabilityEvidence(root)
  const report = validateCapabilityTruth(root, capabilityModules, evidence)
  if (report.failures.length > 0) throw new Error(report.failures.join("\n"))
  writeFileSync(outputPath(root), renderCapabilities(root, capabilityModules, evidence))
}
