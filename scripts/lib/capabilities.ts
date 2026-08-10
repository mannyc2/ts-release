import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"
import { executableCapabilities, type ExecutableCapability } from "../../src/capabilities/registry.js"

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
export interface CapabilityTruthReport { readonly failures: ReadonlyArray<string>, readonly capabilities: number }

const evidencePath = (root: string): string => join(root, "docs", "capability-evidence.json")
const outputPath = (root: string): string => join(root, "docs", "capabilities.md")
const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
const isDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/u.test(value)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

export const readCapabilityEvidence = (root: string): CapabilityEvidenceFile => {
  const value: unknown = JSON.parse(readFileSync(evidencePath(root), "utf8"))
  if (!isRecord(value) || value.schemaVersion !== "ts-release-capability-evidence/v1" || !Array.isArray(value.records)) {
    throw new Error("capability evidence must use ts-release-capability-evidence/v1 with records.")
  }
  return value as unknown as CapabilityEvidenceFile
}

const entrySource = (root: string, entrypoint: string): boolean => {
  const [path, symbol] = entrypoint.split(":", 2)
  if (path === undefined || symbol === undefined || !existsSync(join(root, path))) return false
  const source = readFileSync(join(root, path), "utf8")
  const escaped = escape(symbol)
  return new RegExp(`(?:export\\s+(?:const|function|class)\\s+${escaped}\\b|export\\s*\\{[^}]*\\b${escaped}\\b)`, "su").test(source)
}

export const validateCapabilityTruth = (
  root: string,
  registry: ReadonlyArray<ExecutableCapability> = executableCapabilities,
  evidence: CapabilityEvidenceFile = readCapabilityEvidence(root)
): CapabilityTruthReport => {
  const failures: Array<string> = []
  const registryIds = new Set<string>()
  for (const entry of registry) {
    if (registryIds.has(entry.id)) failures.push(`duplicate registry capability id: ${entry.id}`)
    registryIds.add(entry.id)
    if (!entrySource(root, entry.entrypoint)) failures.push(`${entry.id} has no reachable exported entrypoint: ${entry.entrypoint}`)
    if (!entrySource(root, entry.decoder)) failures.push(`${entry.id} has no strict decoder: ${entry.decoder}`)
    if (!entrySource(root, entry.observation)) failures.push(`${entry.id} has no exact observation semantics: ${entry.observation}`)
    if (!existsSync(join(root, entry.verticalTest))) failures.push(`${entry.id} has no vertical test: ${entry.verticalTest}`)
    else if (!readFileSync(join(root, entry.verticalTest), "utf8").includes("test(")) failures.push(`${entry.id} vertical test is not executable: ${entry.verticalTest}`)
    if (entry.executionHosts.length === 0) failures.push(`${entry.id} has no execution-host constraint`)
  }
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
  return { failures, capabilities: registry.length }
}

const link = (root: string, path: string): string => `../${relative(root, path).replaceAll("\\", "/")}`
export const renderCapabilities = (
  root: string,
  registry: ReadonlyArray<ExecutableCapability> = executableCapabilities,
  evidence: CapabilityEvidenceFile = readCapabilityEvidence(root)
): string => {
  const records = new Map(evidence.records.map((record) => [record.id, record]))
  const rows = registry.map((entry) => {
    const record = records.get(entry.id)
    if (record === undefined) throw new Error(`cannot render capability without evidence: ${entry.id}`)
    const [sourcePath] = entry.entrypoint.split(":", 2)
    const [decoderPath] = entry.decoder.split(":", 2)
    const [observationPath] = entry.observation.split(":", 2)
    return `| \`${entry.id}\` | ${entry.support} | [${entry.entrypoint}](${link(root, join(root, sourcePath!))}) | [${entry.decoder}](${link(root, join(root, decoderPath!))}) | [${entry.observation}](${link(root, join(root, observationPath!))}) | [${entry.verticalTest}](${link(root, join(root, entry.verticalTest))}) | ${entry.executionHosts.join(", ")} | ${entry.artifactTargets.length === 0 ? "—" : entry.artifactTargets.join(", ")} | ${entry.nativeToolHosts.length === 0 ? "—" : entry.nativeToolHosts.join(", ")} | ${record.evidenceClass} | ${record.observedAt} |`
  })
  return `# Executable capabilities

This page is generated from the runtime capability registry and the dated
evidence records in [\`capability-evidence.json\`](capability-evidence.json).
Neither configuration field names nor detached prose can add a capability.

Evidence classes are deliberately distinct: source inspection, external
documentation, contract tests, live read observation, and live write
dogfooding are not interchangeable. The current registry has no live service
claim until a real release exercises and reobserves that destination.

| Capability | Support | Reachable entrypoint | Strict decoder | Observation semantics | Vertical test | Execution hosts | Artifact targets | Native-tool hosts | Evidence | Observed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

Plan 211 outcome: ts-release runs on Linux and macOS. Its Bun builder can
produce Windows artifacts. Native Windows execution and native Windows tools
are not claimed by this registry.
`
}

export const checkCapabilityOutput = (root: string): CapabilityTruthReport => {
  const evidence = readCapabilityEvidence(root)
  const report = validateCapabilityTruth(root, executableCapabilities, evidence)
  if (report.failures.length > 0) return report
  if (!existsSync(outputPath(root))) return { ...report, failures: ["docs/capabilities.md is missing; run generate:capabilities"] }
  if (readFileSync(outputPath(root), "utf8") !== renderCapabilities(root, executableCapabilities, evidence)) return { ...report, failures: ["docs/capabilities.md is stale; run generate:capabilities"] }
  return report
}

export const generateCapabilityOutput = (root: string): void => {
  const evidence = readCapabilityEvidence(root)
  const report = validateCapabilityTruth(root, executableCapabilities, evidence)
  if (report.failures.length > 0) throw new Error(report.failures.join("\n"))
  writeFileSync(outputPath(root), renderCapabilities(root, executableCapabilities, evidence))
}
