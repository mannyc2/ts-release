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

interface ManifestFile {
  readonly path: string
  readonly laneId: string
  readonly moduleId: string | null
  readonly packageId: string | null
  readonly ownerRoleIds: Array<string>
  readonly conceptIds: Array<string>
  readonly centralBranchIds: Array<string>
}

interface ManifestEdge {
  readonly id: string
  readonly fromId: string
  readonly toId: string
  readonly kind: "static" | "type-only" | "dynamic" | "manifest"
}

interface CandidateManifest {
  readonly schemaVersion: string
  readonly candidateId: string
  readonly scope: string
  readonly model: string
  readonly implementationRoot: string
  files: Array<ManifestFile>
  publicSurfaceIds: Array<string>
  durableFormatIds: Array<string>
  dependencyEdges: Array<ManifestEdge>
}

interface ProbeMutation {
  readonly expectedActionId: string
  readonly path: string
  readonly ownerRoleId: string
  readonly moduleId: string
  readonly packageId: string
  readonly conceptId: "concept.main-path" | "concept.difficult-path"
  readonly centralBranchIds: ReadonlyArray<string>
  readonly source: string
  readonly publicSurfaceId?: string
  readonly durableFormatId?: string
  readonly dependencyEdge?: ManifestEdge
}

const probeMutations: Record<string, ProbeMutation> = {
  "P01-second-provider-instance": {
    expectedActionId: "probe.add-second-provider-instance",
    path: "src/probes/p01-second-provider-instance.ts",
    ownerRoleId: "role-first-party-provider-a",
    moduleId: "module.provider-a-instance-b",
    packageId: "package.provider-a",
    conceptId: "concept.main-path",
    centralBranchIds: [],
    source: "export const providerInstances = [{ id: \"provider-a-primary\", endpointRef: \"endpoint.primary\" }, { id: \"provider-a-canary\", endpointRef: \"endpoint.canary\" }] as const\n"
  },
  "P02-packed-external-provider": {
    expectedActionId: "probe.add-packed-external-provider",
    path: "src/probes/p02-packed-external-provider.ts",
    ownerRoleId: "role-packed-external-provider",
    moduleId: "module.packed-external-provider",
    packageId: "package.packed-external-provider",
    conceptId: "concept.main-path",
    centralBranchIds: [],
    dependencyEdge: { id: "package.packed-external-provider->package.machine:manifest", fromId: "package.packed-external-provider", toId: "package.machine", kind: "manifest" },
    source: "export const packedProviderLayer = { packageName: \"@trial/external-provider\", instances: [\"primary\", \"secondary\"] } as const\nexport const consumePackedProvider = (instance: string): string => `packed:${instance}`\n"
  },
  "P03-new-first-party-provider": {
    expectedActionId: "probe.add-first-party-provider",
    path: "src/probes/p03-new-first-party-provider.ts",
    ownerRoleId: "role-first-party-provider-c",
    moduleId: "module.provider-c",
    packageId: "package.provider-c",
    conceptId: "concept.main-path",
    centralBranchIds: [],
    dependencyEdge: { id: "package.provider-c->package.machine:static", fromId: "package.provider-c", toId: "package.machine", kind: "static" },
    source: "export const providerC = { id: \"provider-c-primary\", prepare: (requestId: string) => ({ requestId, endpointId: \"provider-c\" }) } as const\n"
  },
  "P04-new-commitment-mechanism": {
    expectedActionId: "probe.add-commitment-mechanism",
    path: "src/probes/p04-new-commitment-mechanism.ts",
    ownerRoleId: "role-machine",
    moduleId: "module.commitment-mechanism",
    packageId: "package.machine",
    conceptId: "concept.difficult-path",
    centralBranchIds: ["branch.commitment"],
    source: "export type DelayedRemoteCommitment = { readonly authorityEventId: string; readonly notBeforeRevision: number }\nexport const authorizeDelayedCommitment = (authorityEventId: string, notBeforeRevision: number): DelayedRemoteCommitment => ({ authorityEventId, notBeforeRevision })\nexport const delayedCommitmentState = (revision: number, commitment: DelayedRemoteCommitment): \"authorized\" | \"waiting\" => revision >= commitment.notBeforeRevision ? \"authorized\" : \"waiting\"\n"
  },
  "P05-existing-provider-operation": {
    expectedActionId: "probe.add-existing-provider-operation",
    path: "src/probes/p05-existing-provider-operation.ts",
    ownerRoleId: "role-first-party-provider-a",
    moduleId: "module.provider-a-operation",
    packageId: "package.provider-a",
    conceptId: "concept.main-path",
    centralBranchIds: [],
    source: "export const reconcileExistingProviderOperation = (operationId: string) => ({ _tag: \"ReconcileOperation\" as const, operationId })\n"
  },
  "P06-journal-store-backend": {
    expectedActionId: "probe.add-journal-store-backend",
    path: "src/probes/p06-journal-store-backend.ts",
    ownerRoleId: "role-node-host",
    moduleId: "module.node-journal-store",
    packageId: "package.node-host",
    conceptId: "concept.main-path",
    centralBranchIds: [],
    dependencyEdge: { id: "package.node-host->package.machine:static", fromId: "package.node-host", toId: "package.machine", kind: "static" },
    source: "export class MemoryCasJournalStore { readonly entries: string[] = []; append(expected: number, event: string): boolean { if (expected !== this.entries.length) return false; this.entries.push(event); return true } }\n"
  },
  "P07-file-tree-producer-adapter": {
    expectedActionId: "probe.add-file-tree-producer-adapter",
    path: "src/probes/p07-file-tree-producer-adapter.ts",
    ownerRoleId: "role-effect-build-adopter",
    moduleId: "module.effect-build-adapter",
    packageId: "package.effect-build-adapter",
    conceptId: "concept.main-path",
    centralBranchIds: [],
    dependencyEdge: { id: "package.effect-build-adapter->package.machine:static", fromId: "package.effect-build-adapter", toId: "package.machine", kind: "static" },
    source: "export const finalizedTreeV2Adapter = (entries: ReadonlyArray<{ readonly name: string; readonly bytes: Uint8Array }>) => entries.map((entry) => ({ ...entry, bytes: entry.bytes.slice() }))\n"
  },
  "P08-deliberate-public-export": {
    expectedActionId: "probe.add-public-export",
    path: "src/probes/p08-deliberate-public-export.ts",
    ownerRoleId: "role-surface-generator",
    moduleId: "module.public-surface",
    packageId: "package.machine",
    conceptId: "concept.main-path",
    centralBranchIds: [],
    publicSurfaceId: "public.trial-deliberate-export",
    source: "export const deliberateTrialExport = { runtime: true, declaration: \"deliberateTrialExport\", inventory: \"public.trial-deliberate-export\" } as const\n"
  },
  "P09-difficult-recovery-transition": {
    expectedActionId: "probe.change-difficult-recovery",
    path: "src/probes/p09-difficult-recovery-transition.ts",
    ownerRoleId: "role-machine",
    moduleId: "module.recovery-transition",
    packageId: "package.machine",
    conceptId: "concept.difficult-path",
    centralBranchIds: ["branch.recovery"],
    durableFormatId: "format.recovery-transition-v2",
    source: "export interface RecoveryV2 { readonly schemaVersion: \"recovery-v2\"; readonly priorAuthorityId: string; readonly observedRevision: number }\nexport const migrateRecoveryV1 = (authorityId: string, observedRevision: number): RecoveryV2 => ({ schemaVersion: \"recovery-v2\", priorAuthorityId: authorityId, observedRevision })\n"
  }
}

const compareCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

const runProbe = (invocation: ProbeInvocation): ProbeObservation => {
  const mutation = probeMutations[invocation.probeId]
  if (mutation === undefined) throw new Error(`unsupported probe ${invocation.probeId}`)
  if (invocation.changeDefinition.probeId !== invocation.probeId || invocation.changeDefinition.baseFixtureSha256 !== invocation.baseFixtureSha256) {
    throw new Error("probe invocation bindings differ from the change definition")
  }
  if (invocation.changeDefinition.actionId !== mutation.expectedActionId) throw new Error("unexpected frozen probe action")
  if (invocation.changeDefinition.requiredZeroTouchRoleIds.includes(mutation.ownerRoleId)) {
    throw new Error(`probe ${invocation.probeId} would touch protected role ${mutation.ownerRoleId}`)
  }

  mkdirSync("src/probes", { recursive: true })
  writeFileSync(mutation.path, mutation.source, { encoding: "utf8", mode: 0o644, flag: "wx" })
  const manifest = JSON.parse(readFileSync("trial-candidate.json", "utf8")) as CandidateManifest
  manifest.files.push({
    path: mutation.path,
    laneId: "product-source",
    moduleId: mutation.moduleId,
    packageId: mutation.packageId,
    ownerRoleIds: [mutation.ownerRoleId],
    conceptIds: [mutation.conceptId],
    centralBranchIds: [...mutation.centralBranchIds]
  })
  manifest.files.sort((left, right) => compareCodePoint(left.path, right.path))
  if (mutation.publicSurfaceId !== undefined) manifest.publicSurfaceIds.push(mutation.publicSurfaceId)
  if (mutation.durableFormatId !== undefined) manifest.durableFormatIds.push(mutation.durableFormatId)
  if (mutation.dependencyEdge !== undefined) manifest.dependencyEdges.push(mutation.dependencyEdge)
  manifest.publicSurfaceIds.sort(compareCodePoint)
  manifest.durableFormatIds.sort(compareCodePoint)
  manifest.dependencyEdges.sort((left, right) => compareCodePoint(left.id, right.id))
  writeFileSync("trial-candidate.json", canonicalStringify(manifest), "utf8")

  const factPairs: Array<readonly [string, ReturnType<typeof text>]> = [
    ["probe.observed-change", text(invocation.probeId)]
  ]
  for (const kind of invocation.changeDefinition.requiredChangeKinds) {
    factPairs.push([`change-kind.${kind}.path`, text(mutation.path)])
  }
  return {
    schemaVersion: "architecture-probe-observation-v2",
    runContextSha256: invocation.runContextSha256,
    candidateId: invocation.candidateId,
    candidateTreeSha256: invocation.candidateTreeSha256,
    definitionSha256: invocation.definitionSha256,
    probeId: invocation.probeId,
    baseFixtureSha256: invocation.baseFixtureSha256,
    changeDefinitionSha256: invocation.changeDefinitionSha256,
    changeId: invocation.changeDefinition.changeId,
    facts: sortedFacts(factPairs)
  }
}

const runGate = (invocation: GateInvocation): GateObservation => {
  selfCheck()
  return {
    schemaVersion: "architecture-gate-observation-v2",
    runContextSha256: invocation.runContextSha256,
    candidateId: invocation.candidateId,
    candidateTreeSha256: invocation.candidateTreeSha256,
    definitionSha256: invocation.definitionSha256,
    gateId: invocation.gateId,
    facts: sortedFacts([
      ["gate.candidate-local-conformance", text("passed")],
      ["gate.supported-case-count", integer(16)],
      ["gate.supported-probe-count", integer(9)]
    ])
  }
}

const mode = process.argv[2]
const input = JSON.parse(readFileSync(0, "utf8")) as unknown
let output: unknown
switch (mode) {
  case "case":
    output = runCase(input as CaseInvocation)
    break
  case "probe":
    output = runProbe(input as ProbeInvocation)
    break
  case "gate":
    output = runGate(input as GateInvocation)
    break
  default:
    throw new Error(`expected case, probe, or gate mode; received ${String(mode)}`)
}
process.stdout.write(canonicalStringify(output))
