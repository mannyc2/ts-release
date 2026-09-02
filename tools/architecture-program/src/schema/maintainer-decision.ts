import { Effect, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "../canonical-document.js"
import { hashCanonicalValue } from "../trial-hash.js"
import { Sha256Hex, type Sha256Hex as Sha256HexType } from "./primitives.js"
import {
  type TrialSelectionOutcome,
  MaintainerDecisionRequired
} from "./trial-selection.js"
import { computeTrialSelectionOutcomeSha256 } from "./trial-results-aggregate.js"
import {
  V2CandidateId,
  V2CandidateScope,
  V2_CANDIDATE_DEFINITIONS
} from "./v2-ids.js"

export const MAINTAINER_DECISION_DOCUMENT_HASH_DOMAIN =
  "ts-release/architecture-maintainer-decision/v2"

const wellFormedText = Schema.makeFilter(
  (value: string) => value.isWellFormed()
    ? undefined
    : "must not contain an unpaired UTF-16 surrogate"
)
const nfcText = Schema.makeFilter(
  (value: string) => value === value.normalize("NFC") ? undefined : "must be NFC-normalized"
)
const noControlText = Schema.makeFilter(
  (value: string) => /[\u0000-\u001f\u007f]/u.test(value)
    ? "must not contain control characters"
    : undefined
)
const boundedText = (maximumLength: number) => Schema.NonEmptyString.check(
  wellFormedText,
  nfcText,
  Schema.isTrimmed(),
  noControlText,
  Schema.makeFilter(
    (value: string) => value.length <= maximumLength
      ? undefined
      : `must contain at most ${maximumLength} characters`
  )
)

export const MaintainerIdentity = boundedText(256)
export type MaintainerIdentity = typeof MaintainerIdentity.Type

export const MaintainerAuthority = boundedText(1_024)
export type MaintainerAuthority = typeof MaintainerAuthority.Type

export const MaintainerDecisionRationale = boundedText(4_096)
export type MaintainerDecisionRationale = typeof MaintainerDecisionRationale.Type

export class MaintainerDecisionV2 extends Schema.Class<MaintainerDecisionV2>(
  "MaintainerDecisionV2"
)({
  scope: V2CandidateScope,
  trialSpecSha256: Sha256Hex,
  selectionOutcomeSha256: Sha256Hex,
  selectedCandidateId: V2CandidateId,
  selectedReceiptId: Sha256Hex,
  rationale: MaintainerDecisionRationale,
  maintainerIdentity: MaintainerIdentity,
  maintainerAuthority: MaintainerAuthority
}) {}

const MaintainerDecisionDocumentBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-maintainer-decision/v2"),
  programId: Schema.Literal("ts-release-architecture-program"),
  decisions: Schema.NonEmptyArray(MaintainerDecisionV2)
} as const

export const MaintainerDecisionDocumentBodyV2 = Schema.Struct(
  MaintainerDecisionDocumentBodyFields
)
export type MaintainerDecisionDocumentBodyV2 =
  typeof MaintainerDecisionDocumentBodyV2.Type
export type MaintainerDecisionDocumentBodyV2Encoded =
  typeof MaintainerDecisionDocumentBodyV2.Encoded

export class MaintainerDecisionDocumentV2 extends Schema.Class<MaintainerDecisionDocumentV2>(
  "MaintainerDecisionDocumentV2"
)({
  documentId: Sha256Hex,
  ...MaintainerDecisionDocumentBodyFields
}) {}

export interface MaintainerDecisionValidationContext {
  readonly trialSpecSha256: Sha256HexType
  readonly machineSelection: TrialSelectionOutcome
  readonly topologySelection: TrialSelectionOutcome | null
}

export class MaintainerDecisionInvariantError extends Schema.TaggedError<
  MaintainerDecisionInvariantError
>()("MaintainerDecisionInvariantError", {
  issues: Schema.NonEmptyArray(Schema.String),
  message: Schema.String
}) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture maintainer decision invariant failure: ${issues.join("; ")}`
    })
  }
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeBodyStructure = Schema.decodeUnknownSync(
  MaintainerDecisionDocumentBodyV2,
  strictOptions
)
const encodeBodyStructure = Schema.encodeUnknownSync(
  MaintainerDecisionDocumentBodyV2,
  strictOptions
)
const decodeDocumentStructure = Schema.decodeUnknownEffect(
  MaintainerDecisionDocumentV2,
  strictOptions
)
const encodeDocumentStructure = Schema.encodeUnknownSync(
  MaintainerDecisionDocumentV2,
  strictOptions
)

const exactOrdered = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const canonicalIssues = (issues: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(issues)].sort()

export const maintainerDecisionBodyInvariantIssues = (
  body: MaintainerDecisionDocumentBodyV2
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const scopes = body.decisions.map(({ scope }) => scope)
  const expectedScopes = scopes.includes("machine") && scopes.includes("topology")
    ? ["machine", "topology"]
    : scopes
  if (body.decisions.length > 2 || !exactOrdered(scopes, expectedScopes) ||
    new Set(scopes).size !== scopes.length) {
    issues.push("decisions must contain each needed scope at most once in machine, topology order")
  }
  if (new Set(body.decisions.map(({ trialSpecSha256 }) => trialSpecSha256)).size !== 1) {
    issues.push("all decisions must bind one exact trial specification")
  }
  for (const decision of body.decisions) {
    if (V2_CANDIDATE_DEFINITIONS[decision.selectedCandidateId].scope !== decision.scope) {
      issues.push(
        `${decision.scope} decision selected ${decision.selectedCandidateId} from the wrong scope`
      )
    }
  }
  return canonicalIssues(issues)
}

const requiredSelections = (
  context: MaintainerDecisionValidationContext
): ReadonlyArray<{
  readonly scope: "machine" | "topology"
  readonly selection: MaintainerDecisionRequired
}> => {
  const required: Array<{
    readonly scope: "machine" | "topology"
    readonly selection: MaintainerDecisionRequired
  }> = []
  if (context.machineSelection._tag === "MaintainerDecisionRequired") {
    required.push({ scope: "machine", selection: context.machineSelection })
  }
  if (context.topologySelection?._tag === "MaintainerDecisionRequired") {
    required.push({ scope: "topology", selection: context.topologySelection })
  }
  return required
}

export const maintainerDecisionContextInvariantIssues = (
  document: MaintainerDecisionDocumentV2,
  context: MaintainerDecisionValidationContext
): ReadonlyArray<string> => {
  const bodyIssues = maintainerDecisionBodyInvariantIssues(document)
  const issues = [...bodyIssues]
  if (context.machineSelection.scope !== "machine") {
    issues.push("machineSelection context must have machine scope")
  }
  if (context.topologySelection !== null && context.topologySelection.scope !== "topology") {
    issues.push("topologySelection context must have topology scope")
  }
  const required = requiredSelections(context)
  if (!exactOrdered(
    document.decisions.map(({ scope }) => scope),
    required.map(({ scope }) => scope)
  )) {
    issues.push(
      "decisions must equal the exact ordered MaintainerDecisionRequired selection scopes"
    )
  }
  required.forEach(({ scope, selection }, index) => {
    const decision = document.decisions[index]
    if (decision === undefined) return
    if (selection.scope !== scope) {
      issues.push(`${scope} MaintainerDecisionRequired outcome has the wrong scope`)
    }
    if (decision.scope !== scope) {
      issues.push(`decision ${index} must have ${scope} scope`)
    }
    if (decision.trialSpecSha256 !== context.trialSpecSha256) {
      issues.push(`${scope} decision does not bind the exact trial specification`)
    }
    if (decision.selectionOutcomeSha256 !== computeTrialSelectionOutcomeSha256(selection)) {
      issues.push(`${scope} decision does not bind the exact selection outcome`)
    }
    if (!selection.nonDominatedCandidateIds.includes(decision.selectedCandidateId)) {
      issues.push(`${scope} decision must select a non-dominated candidate`)
    }
    const vectors = selection.objectiveVectors.filter(
      ({ candidateId }) => candidateId === decision.selectedCandidateId
    )
    if (vectors.length !== 1 || vectors[0]?.receiptId !== decision.selectedReceiptId) {
      issues.push(`${scope} decision must bind the selected candidate's exact receipt`)
    }
  })
  const { documentId: _documentId, ...body } = document
  if (bodyIssues.length === 0 &&
    document.documentId !== computeMaintainerDecisionDocumentId(body)) {
    issues.push("documentId must bind the canonical maintainer-decision body")
  }
  return canonicalIssues(issues)
}

const assertIssues = (issues: ReadonlyArray<string>): void => {
  if (issues.length > 0) {
    throw new MaintainerDecisionInvariantError(issues as [string, ...Array<string>])
  }
}

export const computeMaintainerDecisionDocumentId = (input: unknown) => {
  const body = decodeBodyStructure(input)
  assertIssues(maintainerDecisionBodyInvariantIssues(body))
  return hashCanonicalValue(
    MAINTAINER_DECISION_DOCUMENT_HASH_DOMAIN,
    encodeBodyStructure(body)
  )
}

export const makeMaintainerDecisionDocument = (
  input: unknown,
  context: MaintainerDecisionValidationContext
): MaintainerDecisionDocumentV2 => {
  const body = decodeBodyStructure(input)
  assertIssues(maintainerDecisionBodyInvariantIssues(body))
  const document = new MaintainerDecisionDocumentV2({
    documentId: computeMaintainerDecisionDocumentId(body),
    ...body
  })
  assertIssues(maintainerDecisionContextInvariantIssues(document, context))
  return document
}

export const decodeMaintainerDecisionDocument = Effect.fn(
  "MaintainerDecisionDocumentV2.decode"
)(function* (
  input: unknown,
  context: MaintainerDecisionValidationContext
) {
  const document = yield* decodeDocumentStructure(input)
  const issues = maintainerDecisionContextInvariantIssues(document, context)
  if (issues.length > 0) {
    return yield* new MaintainerDecisionInvariantError(
      issues as [string, ...Array<string>]
    )
  }
  return document
})

export const encodeMaintainerDecisionDocument = (
  document: MaintainerDecisionDocumentV2,
  context: MaintainerDecisionValidationContext
): unknown => {
  assertIssues(maintainerDecisionContextInvariantIssues(document, context))
  return encodeDocumentStructure(document)
}

const causeMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export const decodeCanonicalMaintainerDecisionDocument = Effect.fn(
  "MaintainerDecisionDocumentV2.decodeCanonical"
)(function* (
  bytes: Uint8Array,
  context: MaintainerDecisionValidationContext
) {
  const input = yield* Effect.try({
    try: () => parseCanonicalJsonBytes(bytes),
    catch: (cause) => new MaintainerDecisionInvariantError([
      `canonical document bytes are invalid: ${causeMessage(cause)}`
    ])
  })
  return yield* decodeMaintainerDecisionDocument(input, context)
})

export const encodeCanonicalMaintainerDecisionDocument = (
  document: MaintainerDecisionDocumentV2,
  context: MaintainerDecisionValidationContext
): Uint8Array => canonicalJsonBytes(encodeMaintainerDecisionDocument(document, context))
