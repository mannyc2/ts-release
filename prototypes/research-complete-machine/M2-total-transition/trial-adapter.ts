import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { runCase, selfCheck } from "./src/scenarios.js"
import {
  canonicalStringify,
  integer,
  sortedFacts,
  text,
  type CaseInvocation,
  type GateInvocation,
  type GateObservation,
  type ProbeInvocation,
  type ProbeObservation
} from "./src/contracts.js"

interface FileEntry {
  path: string
  laneId: string
  moduleId: string | null
  packageId: string | null
  ownerRoleIds: Array<string>
  conceptIds: Array<string>
  centralBranchIds: Array<string>
}
interface Edge { id: string; fromId: string; toId: string; kind: "static" | "type-only" | "dynamic" | "manifest" }
interface Manifest {
  files: Array<FileEntry>
  publicSurfaceIds: Array<string>
  durableFormatIds: Array<string>
  dependencyEdges: Array<Edge>
  [key: string]: unknown
}
interface Mutation {
  action: string
  path: string
  owner: string
  module: string
  package: string
  concept: "concept.main-path" | "concept.difficult-path"
  branches: ReadonlyArray<string>
  source: string
  publicId?: string
  formatId?: string
  edge?: Edge
}

const MUTATIONS: Record<string, Mutation> = {
  "P01-second-provider-instance": {
    action: "probe.add-second-provider-instance", path: "src/probes/p01-second-provider-instance.ts", owner: "role-first-party-provider-a", module: "module.provider-a-instance-b", package: "package.provider-a", concept: "concept.main-path", branches: [],
    source: "export const providerInstances = [{ id: \"provider-a-primary\", endpointRef: \"endpoint.primary\" }, { id: \"provider-a-canary\", endpointRef: \"endpoint.canary\" }] as const\n"
  },
  "P02-packed-external-provider": {
    action: "probe.add-packed-external-provider", path: "src/probes/p02-packed-external-provider.ts", owner: "role-packed-external-provider", module: "module.packed-external-provider", package: "package.packed-external-provider", concept: "concept.main-path", branches: [],
    source: "export const packedProviderLayer = { packageName: \"@trial/external-provider\", instances: [\"primary\", \"external-provider-secondary\"] } as const\nexport const consumePackedProvider = (instance: string): string => `packed:${instance}`\n",
    edge: { id: "package.packed-external-provider->package.machine:manifest", fromId: "package.packed-external-provider", toId: "package.machine", kind: "manifest" }
  },
  "P03-new-first-party-provider": {
    action: "probe.add-first-party-provider", path: "src/probes/p03-new-first-party-provider.ts", owner: "role-first-party-provider-c", module: "module.provider-c", package: "package.provider-c", concept: "concept.main-path", branches: [],
    source: "export const providerC = { id: \"provider-c-primary\", prepare: (requestId: string) => ({ requestId, endpointId: \"provider-c\" }) } as const\n",
    edge: { id: "package.provider-c->package.machine:static", fromId: "package.provider-c", toId: "package.machine", kind: "static" }
  },
  "P04-new-commitment-mechanism": {
    action: "probe.add-commitment-mechanism", path: "src/probes/p04-new-commitment-mechanism.ts", owner: "role-machine", module: "module.commitment-mechanism", package: "package.machine", concept: "concept.difficult-path", branches: ["branch.commitment"],
    source: "export type DelayedRemoteCommitment = { readonly authorityEventId: string; readonly notBeforeRevision: number }\nexport const authorizeDelayedCommitment = (authorityEventId: string, notBeforeRevision: number): DelayedRemoteCommitment => ({ authorityEventId, notBeforeRevision })\nexport const delayedCommitmentState = (revision: number, value: DelayedRemoteCommitment): \"authorized\" | \"waiting\" => revision >= value.notBeforeRevision ? \"authorized\" : \"waiting\"\n"
  },
  "P05-existing-provider-operation": {
    action: "probe.add-existing-provider-operation", path: "src/probes/p05-existing-provider-operation.ts", owner: "role-first-party-provider-a", module: "module.provider-a-operation", package: "package.provider-a", concept: "concept.main-path", branches: [],
    source: "export const reconcileExistingProviderOperation = (operationId: string) => ({ _tag: \"ReconcileOperation\" as const, operationId })\n"
  },
  "P06-journal-store-backend": {
    action: "probe.add-journal-store-backend", path: "src/probes/p06-journal-store-backend.ts", owner: "role-node-host", module: "module.memory-cas-store", package: "package.node-host", concept: "concept.main-path", branches: [],
    source: "export class MemoryCasJournalStore { readonly events: string[] = []; append(expected: number, event: string): boolean { if (expected !== this.events.length) return false; this.events.push(event); return true } }\n",
    edge: { id: "package.node-host->package.machine:static", fromId: "package.node-host", toId: "package.machine", kind: "static" }
  },
  "P07-file-tree-producer-adapter": {
    action: "probe.add-file-tree-producer-adapter", path: "src/probes/p07-file-tree-producer-adapter.ts", owner: "role-effect-build-adopter", module: "module.effect-build-adapter", package: "package.effect-build-adapter", concept: "concept.main-path", branches: [],
    source: "export const finalizedTreeV2Adapter = (entries: ReadonlyArray<{ readonly name: string; readonly bytes: Uint8Array }>) => entries.map((entry) => ({ ...entry, bytes: entry.bytes.slice() }))\n",
    edge: { id: "package.effect-build-adapter->package.machine:static", fromId: "package.effect-build-adapter", toId: "package.machine", kind: "static" }
  },
  "P08-deliberate-public-export": {
    action: "probe.add-public-export", path: "src/probes/p08-deliberate-public-export.ts", owner: "role-surface-generator", module: "module.public-surface", package: "package.machine", concept: "concept.main-path", branches: [], publicId: "public.trial-deliberate-export",
    source: "export const deliberateTrialExport = { runtime: true, declaration: \"deliberateTrialExport\", inventory: \"public.trial-deliberate-export\" } as const\n"
  },
  "P09-difficult-recovery-transition": {
    action: "probe.change-difficult-recovery", path: "src/probes/p09-difficult-recovery-transition.ts", owner: "role-machine", module: "module.recovery-transition", package: "package.machine", concept: "concept.difficult-path", branches: ["branch.recovery"], formatId: "format.recovery-transition-v2",
    source: "export interface RecoveryV2 { readonly schemaVersion: \"recovery-v2\"; readonly priorAuthorityId: string; readonly observedRevision: number }\nexport const migrateRecoveryV1 = (priorAuthorityId: string, observedRevision: number): RecoveryV2 => ({ schemaVersion: \"recovery-v2\", priorAuthorityId, observedRevision })\n"
  }
}

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)
const probe = (input: ProbeInvocation): ProbeObservation => {
  const change = MUTATIONS[input.probeId]
  if (change === undefined) throw new Error(`unsupported probe ${input.probeId}`)
  if (input.changeDefinition.probeId !== input.probeId || input.changeDefinition.baseFixtureSha256 !== input.baseFixtureSha256 || input.changeDefinition.actionId !== change.action) {
    throw new Error("probe invocation disagrees with frozen change definition")
  }
  if (input.changeDefinition.requiredZeroTouchRoleIds.includes(change.owner)) throw new Error(`protected owner ${change.owner}`)
  mkdirSync("src/probes", { recursive: true })
  writeFileSync(change.path, change.source, { encoding: "utf8", mode: 0o644, flag: "wx" })
  const manifest = JSON.parse(readFileSync("trial-candidate.json", "utf8")) as Manifest
  manifest.files.push({ path: change.path, laneId: "product-source", moduleId: change.module, packageId: change.package, ownerRoleIds: [change.owner], conceptIds: [change.concept], centralBranchIds: [...change.branches] })
  manifest.files.sort((a, b) => compare(a.path, b.path))
  if (change.publicId !== undefined) manifest.publicSurfaceIds.push(change.publicId)
  if (change.formatId !== undefined) manifest.durableFormatIds.push(change.formatId)
  if (change.edge !== undefined) manifest.dependencyEdges.push(change.edge)
  manifest.publicSurfaceIds.sort(compare)
  manifest.durableFormatIds.sort(compare)
  manifest.dependencyEdges.sort((a, b) => compare(a.id, b.id))
  writeFileSync("trial-candidate.json", canonicalStringify(manifest), "utf8")
  return {
    schemaVersion: "architecture-probe-observation-v2",
    runContextSha256: input.runContextSha256,
    candidateId: input.candidateId,
    candidateTreeSha256: input.candidateTreeSha256,
    definitionSha256: input.definitionSha256,
    probeId: input.probeId,
    baseFixtureSha256: input.baseFixtureSha256,
    changeDefinitionSha256: input.changeDefinitionSha256,
    changeId: input.changeDefinition.changeId,
    facts: sortedFacts([
      ...input.changeDefinition.requiredChangeKinds.map((kind) => [`change-kind.${kind}.path`, text(change.path)] as const),
      ["probe.observed-change", text(input.probeId)]
    ])
  }
}

const gate = (input: GateInvocation): GateObservation => {
  selfCheck()
  return {
    schemaVersion: "architecture-gate-observation-v2",
    runContextSha256: input.runContextSha256,
    candidateId: input.candidateId,
    candidateTreeSha256: input.candidateTreeSha256,
    definitionSha256: input.definitionSha256,
    gateId: input.gateId,
    facts: sortedFacts([
      ["gate.candidate-local-conformance", text("passed")],
      ["gate.supported-case-count", integer(16)],
      ["gate.supported-probe-count", integer(9)]
    ])
  }
}

const mode = process.argv[2]
const input = JSON.parse(readFileSync(0, "utf8")) as unknown
const output = mode === "case" ? runCase(input as CaseInvocation)
  : mode === "probe" ? probe(input as ProbeInvocation)
  : mode === "gate" ? gate(input as GateInvocation)
  : (() => { throw new Error(`expected case, probe, or gate; received ${String(mode)}`) })()
process.stdout.write(canonicalStringify(output))
