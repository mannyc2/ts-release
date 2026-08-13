import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { installedPublicationProfiles } from "../../src/publication/profiles.js"
import type { PublicationProfileRegistration } from "../../src/publication/recovery.js"

export interface RecoveryDocsReport {
  readonly profiles: number
  readonly failures: ReadonlyArray<string>
}

const outputPath = (root: string): string => join(
  root,
  "docs",
  "release-program",
  "remediation",
  "229-provider-recovery.md"
)

const text = (value: string): string => value.replaceAll("|", "\\|")
const list = (values: ReadonlyArray<string>): string =>
  values.length === 0 ? "none" : values.map((value) => `\`${value}\``).join(", ")
const linkList = (values: ReadonlyArray<string>): string =>
  values.map((value, index) => `[${index + 1}](${value})`).join(", ")
const backoff = (profile: PublicationProfileRegistration): string => {
  const policy = profile.recovery.readConvergence.observationRetry
  return `${policy.maxAttempts} attempts; ${policy.backoff.baseMs} ms base × ${policy.backoff.factor}; ${policy.backoff.capMs} ms cap; ${policy.totalBudgetMs} ms budget`
}
const convergenceContract = (profile: PublicationProfileRegistration): string => {
  const contract = profile.recovery.readConvergence.contract
  switch (contract._tag) {
    case "documented": return `DOCUMENTED: [contract](${contract.url}), reviewed ${contract.date}`
    case "assumed": return text(contract.basis)
    case "unknown": return "UNKNOWN"
  }
}

const profileRows = (profiles: ReadonlyArray<PublicationProfileRegistration>): string =>
  profiles.map((profile) => {
    const recovery = profile.recovery
    return `| \`${profile.id}\` | \`${profile.preparedTag}\` | ${recovery.observation} | ${recovery.authoritativeAbsence} | ${recovery.createAuthorization} | ${recovery.replay} | ${recovery.identifierReuse} | ${recovery.exposure} | ${recovery.historyRequirement} | ${list(recovery.correction)} |`
  }).join("\n")

const convergenceRows = (profiles: ReadonlyArray<PublicationProfileRegistration>): string =>
  profiles.map((profile) => `| \`${profile.id}\` | ${convergenceContract(profile)} | ${backoff(profile)} | \`${profile.recovery.readConvergence.retryEligible}\` | \`${profile.recovery.readConvergence.exhaustion}\` |`).join("\n")

const evidenceSections = (profiles: ReadonlyArray<PublicationProfileRegistration>): string =>
  profiles.map((profile) => `### ${profile.provider}

Evidence was reviewed ${profile.evidence.reviewedAt}. Observation sources:
${linkList(profile.evidence.observationSources)}. Correction sources:
${linkList(profile.evidence.correctionSources)}.

Correction conclusion: ${profile.evidence.correctionFinding} Therefore the
installed correction-adapter list and the profile's correction axis are both
empty. The public authored request remains useful only as a canonical,
exactly-bound operator proposal; ts-release sends no corrective mutation.
`).join("\n")

export const renderProviderRecovery = (
  profiles: ReadonlyArray<PublicationProfileRegistration> = Object.values(installedPublicationProfiles)
): string => `# Plan 229 — Provider recovery and forward correction

Status: IMPLEMENTED / CONTRACT-TESTED / ZERO-LIVE-MUTATION

Date: 2026-08-12

This document is generated from \`installedPublicationProfiles\`, the same
registered values consumed by the publication adapter and recovery coordinator.
Edit the registry, not this table, then run \`bun run generate:recovery-docs\`.
Only installed npm and GitHub publication modules appear here. PyPI and catalog
profiles remain owned by Plans 230 and 231 and are not presented as installed.

## Independent recovery axes

No column implies another: in particular, identifier reuse, replay, exposure,
correction, and history are independent facts.

| Module | Prepared variant | Observation | Authoritative absence | Create authorization | Replay | Identifier reuse | Exposure | History | Installed correction adapters |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${profileRows(profiles)}

## Read-convergence policy

The numeric timing policies remain **ASSUMED/UNVERIFIED**. No authorized live
mutation established provider visibility timing. They may bound confirming
reads after one same-invocation mutation, but they never authorize retrying a
mutation, provider decision, conclusive fact, or pre-mutation observation.
Pre-mutation \`Inconclusive\` fails closed. \`AuthoritativelyAbsent\` and
conclusive \`PresentDifferent\` stop immediately. Exhaustion preserves the
full ordered trace in \`UncertainSubject\`.

| Module | Contract label and basis | Observation retry | Fixed eligible result | Fixed exhaustion |
| --- | --- | --- | --- | --- |
${convergenceRows(profiles)}

For GitHub set equality, observation recursively peels annotated tags, reads
the exact release coordinate, and exhausts the paginated release-asset list.
A malformed or failed later page is \`Inconclusive\`; search indexes are not
observation evidence.

## Provider evidence and correction decision

${evidenceSections(profiles)}
For npm, deprecation adds a consumer-visible warning and does not erase or free
the published package/version. npm's unpublish policy says a used
\`package@version\` cannot be reused even after unpublish, so the registered
identifier-reuse axis is \`consumed-after-delete\`; unpublish is outside this
plan. For GitHub, release metadata and assets may remain exposed to consumers;
release/tag/asset deletion is neither modeled nor admitted as correction.

Every authored correction is bound only after loading the exact prepared
bundle. Its canonical intent carries the whole prepared digest, the selected
publication id and destination, and an internally derived SHA-256 of that
exact prepared publication subject. npm additionally binds the prepared
tarball SHA-512 integrity. Authored input cannot supply or override destination
or baseline fields. Catalog and PyPI correction variants are unreachable.

Two actors cannot silently overwrite each other: absent an installed
conditional correction adapter, both receive independently canonical operator
proposals and neither sends a provider mutation. Ordinary publication cannot
apply those proposals, erase a correction, resurrect a consumed npm coordinate,
or interpret deletion as rollback.

## Verification boundary

The local contract suite exercises canonical profile equality, registration
mismatch rejection, bounded reread behavior, exact provider observations,
pagination failure, authored correction binding, baseline tampering, and two
concurrent unsupported correction actors. This plan performed no live npm or
GitHub provider-resource read or mutation and acquired no credentials.
`

export const checkProviderRecoveryOutput = (root: string): RecoveryDocsReport => {
  const profiles = Object.values(installedPublicationProfiles)
  const path = outputPath(root)
  if (!existsSync(path)) {
    return { profiles: profiles.length, failures: ["Plan 229 provider recovery documentation is missing; run generate:recovery-docs."] }
  }
  return readFileSync(path, "utf8") === renderProviderRecovery(profiles)
    ? { profiles: profiles.length, failures: [] }
    : { profiles: profiles.length, failures: ["Plan 229 provider recovery documentation is stale; run generate:recovery-docs."] }
}

export const generateProviderRecoveryOutput = (root: string): void => {
  writeFileSync(outputPath(root), renderProviderRecovery())
}
