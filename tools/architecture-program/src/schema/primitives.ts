import { Schema } from "effect"

const nfcText = Schema.makeFilter(
  (value: string) => value === value.normalize("NFC") ? undefined : "must be NFC-normalized"
)

const boundedText = Schema.NonEmptyString.check(
  nfcText,
  Schema.isTrimmed(),
  Schema.makeFilter((value: string) => /[\u0000-\u001f\u007f]/u.test(value) ? "must not contain control characters" : undefined),
  Schema.makeFilter((value: string) => value.length <= 4_096 ? undefined : "must contain at most 4096 characters")
)

const stableLowerId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u)
)

const numberedId = (prefix: string) => Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(new RegExp(`^${prefix}[0-9]{2}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`, "u"))
)

const candidateId = (prefix: string) => Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(new RegExp(`^${prefix}[1-9][0-9]*-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`, "u"))
)

const repositoryPath = Schema.NonEmptyString.check(
  nfcText,
  Schema.makeFilter((value: string) => {
    if (value.length > 512) return "must contain at most 512 characters"
    if (value.startsWith("/") || value.includes("\\")) return "must be a relative POSIX path"
    if (!/^[A-Za-z0-9._@/+~-]+$/u.test(value)) return "contains a non-portable character"
    const segments = value.split("/")
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      return "must not contain empty, dot, or parent segments"
    }
    return undefined
  })
)

export const Description = boundedText.pipe(Schema.brand("Description"))
export type Description = typeof Description.Type

export const ProgramId = stableLowerId.pipe(Schema.brand("ProgramId"))
export type ProgramId = typeof ProgramId.Type

export const LawId = numberedId("L").pipe(Schema.brand("LawId"))
export type LawId = typeof LawId.Type

export const CaseId = numberedId("C").pipe(Schema.brand("CaseId"))
export type CaseId = typeof CaseId.Type

export const GateId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^G[MT][0-9]{2}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
).pipe(Schema.brand("GateId"))
export type GateId = typeof GateId.Type

export const ProbeId = numberedId("P").pipe(Schema.brand("ProbeId"))
export type ProbeId = typeof ProbeId.Type

export const MachineCandidateId = candidateId("M").pipe(Schema.brand("MachineCandidateId"))
export type MachineCandidateId = typeof MachineCandidateId.Type

export const TopologyCandidateId = candidateId("T").pipe(Schema.brand("TopologyCandidateId"))
export type TopologyCandidateId = typeof TopologyCandidateId.Type

export const RoleId = stableLowerId.pipe(Schema.brand("RoleId"))
export type RoleId = typeof RoleId.Type

export const MetricId = stableLowerId.pipe(Schema.brand("MetricId"))
export type MetricId = typeof MetricId.Type

export const OwnerId = stableLowerId.pipe(Schema.brand("OwnerId"))
export type OwnerId = typeof OwnerId.Type

export const ArtifactId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^(?:[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*|[A-Z][0-9]{2}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/u)
).pipe(Schema.brand("ArtifactId"))
export type ArtifactId = typeof ArtifactId.Type

export const Sha256Hex = Schema.NonEmptyString.check(
  Schema.isPattern(/^[0-9a-f]{64}$/u)
).pipe(Schema.brand("Sha256Hex"))
export type Sha256Hex = typeof Sha256Hex.Type

export const GitRevision = Schema.NonEmptyString.check(
  Schema.isPattern(/^[0-9a-f]{40}$/u)
).pipe(Schema.brand("GitRevision"))
export type GitRevision = typeof GitRevision.Type

export const ExistingRepositoryPath = repositoryPath.pipe(Schema.brand("ExistingRepositoryPath"))
export type ExistingRepositoryPath = typeof ExistingRepositoryPath.Type

export const PlannedRepositoryPath = repositoryPath.pipe(Schema.brand("PlannedRepositoryPath"))
export type PlannedRepositoryPath = typeof PlannedRepositoryPath.Type

export const TraceabilityId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u)
).pipe(Schema.brand("TraceabilityId"))
export type TraceabilityId = typeof TraceabilityId.Type

export const TraceabilityTargetId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u),
  Schema.makeFilter((value: string) => value.length <= 256 ? undefined : "must contain at most 256 characters")
).pipe(Schema.brand("TraceabilityTargetId"))
export type TraceabilityTargetId = typeof TraceabilityTargetId.Type

export const SourceRecordId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^[A-Z][A-Z0-9]*(?:-[0-9]{2})?$/u)
).pipe(Schema.brand("SourceRecordId"))
export type SourceRecordId = typeof SourceRecordId.Type

export const EvidenceId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^[A-Za-z][A-Za-z0-9]*(?:[._/-][A-Za-z0-9]+)*$/u)
).pipe(Schema.brand("EvidenceId"))
export type EvidenceId = typeof EvidenceId.Type

export const WitnessKindId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^witness\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
).pipe(Schema.brand("WitnessKindId"))
export type WitnessKindId = typeof WitnessKindId.Type
