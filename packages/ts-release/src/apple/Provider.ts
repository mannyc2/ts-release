import { Effect, Schema } from "effect"
import * as Notary from "effect-build-apple/Notary"
import { PROVIDER_CONTRACT, makeRequest, type ProviderDefinition } from "../Provider.js"
import { NoReplay, type RequestFacts } from "../internal/ReleaseModel.js"
import { attempt, fail, reject } from "../internal/Error.js"
import { canonical, decodeOwned } from "../internal/Identity.js"
import { AppleEvidence, ApplePreparation } from "./Model.js"

export const sourceCorresponds = (input: ApplePreparation, result: Notary.SubmissionReference) => {
  const target = result.stapleTarget
  if (!target || result.architecture !== input.architecture) return false
  if (input._tag === "AppPreparation")
    return (
      result.kind === "zip" &&
      target.kind === "app" &&
      target.identityKind === "tree-manifest" &&
      target.bundleName === input.bundleName &&
      target.artifactBytes === input.source.totalBytes &&
      target.artifactDigest.value === input.source.upstreamManifestSha256 &&
      result.transportTool?.name === "ditto"
    )
  const kind = input._tag === "DmgPreparation" ? "dmg" : "pkg"
  return (
    result.kind === kind &&
    target.kind === kind &&
    target.identityKind === "file-bytes" &&
    target.artifactBytes === input.source.content.bytes &&
    target.artifactDigest.value === input.source.content.sha256 &&
    result.artifactBytes === input.source.content.bytes &&
    result.artifactDigest.value === input.source.content.sha256 &&
    target.bundleName === undefined &&
    result.transportTool === undefined
  )
}
const endpoint = (input: ApplePreparation) =>
  input._tag === "AppPreparation"
    ? "effect-build-apple/Notary.submitApp"
    : "effect-build-apple/Notary.submit"
const requestCorresponds = (input: ApplePreparation, request: RequestFacts) =>
  request.transport === "opaque/1" &&
  request.endpoint === endpoint(input) &&
  request.method === "invoke" &&
  request.principal === input.principal &&
  request.scope === input.credentialRef &&
  request.headers.length === 0 &&
  request.replay._tag === "None"
const reference = (value: Notary.SubmissionReference) => ({
  submissionId: value.submissionId,
  kind: value.kind,
  architecture: value.architecture,
  artifactBytes: value.artifactBytes,
  artifactDigest: value.artifactDigest,
  submissionTool: value.submissionTool,
  ...(value.stapleTarget && { stapleTarget: value.stapleTarget }),
  ...(value.transportTool && { transportTool: value.transportTool }),
})
export const classifyEvidence = (
  input: ApplePreparation,
  operationId: string,
  value: unknown,
  receipts: readonly unknown[],
) => {
  const evidence = decodeOwned(AppleEvidence, value)
  const correlated = "_tag" in evidence ? evidence.acceptance : evidence
  if (
    !sourceCorresponds(input, correlated) ||
    !receipts.some((value) => {
      const receipt = decodeOwned(Notary.Submission, value)
      return (
        sourceCorresponds(input, receipt) &&
        canonical(reference(receipt)) === canonical(reference(correlated))
      )
    })
  )
    fail(
      "apple-correlation",
      "Apple observation has no matching recorded submission for this source",
    )
  if (!("_tag" in evidence))
    return evidence.status._tag === "Rejected" ? ("Conflict" as const) : ("Pending" as const)
  const final = evidence.finalArtifact,
    assessment = evidence.assessment
  const kind =
    input._tag === "AppPreparation" ? "app" : input._tag === "DmgPreparation" ? "dmg" : "pkg"
  if (
    evidence.preparationId !== operationId ||
    final.logicalName !== input.artifactName ||
    final.kind !== kind ||
    assessment.kind !== kind ||
    assessment.architecture !== input.architecture ||
    assessment.identityKind !== final.identityKind ||
    assessment.artifactBytes !== final.artifactBytes ||
    assessment.artifactDigest.value !== final.artifactDigest.value ||
    assessment.gatekeeper.name !== "spctl" ||
    assessment.structuralVerifier.name !== (kind === "pkg" ? "pkgutil" : "codesign")
  )
    fail(
      "apple-assessment",
      "Selected final artifact does not match its native Gatekeeper assessment",
    )
  return "Satisfied" as const
}

export const preparationProvider: ProviderDefinition = Object.freeze<ProviderDefinition>({
  contract: PROVIDER_CONTRACT,
  definitionId: "effect-build-apple.prepare",
  intentVersion: "ts-release/apple-preparation/1",
  intentCodec: ApplePreparation,
  receiptVersion: "effect-build-apple/Submission/0.6.3",
  receiptCodec: Notary.Submission,
  requestCorresponds: (operation, request) =>
    requestCorresponds(decodeOwned(ApplePreparation, operation.intent), request),
  receiptCorresponds: (operation, request, value) => {
    const input = decodeOwned(ApplePreparation, operation.intent),
      receipt = decodeOwned(Notary.Submission, value)
    return requestCorresponds(input, request) && sourceCorresponds(input, receipt)
  },
  classifyReceipt: () => "Pending",
  dispatchError: {
    version: "effect-build-apple/SubmissionOutcomeUnknown/0.6.3",
    codec: Notary.SubmissionOutcomeUnknown,
    corresponds: (operation, request, value) => {
      const input = decodeOwned(ApplePreparation, operation.intent),
        native = Schema.is(Notary.SubmissionOutcomeUnknown)(value)
          ? value
          : decodeOwned(Notary.SubmissionOutcomeUnknown, value)
      return (
        requestCorresponds(input, request) &&
        /^[0-9a-f]{64}$/u.test(native.artifactDigest) &&
        (input._tag === "AppPreparation" || native.artifactDigest === input.source.content.sha256)
      )
    },
  },
  observationVersion: "ts-release/apple-evidence/1",
  observationCodec: AppleEvidence,
  classifyObservation: (operation, evidence, receipts) =>
    classifyEvidence(
      decodeOwned(ApplePreparation, operation.intent),
      operation.operationId,
      evidence,
      receipts,
    ),
  observe: () =>
    reject("apple-completion-required", "Apple observations require recorded completion"),
  prepare: Effect.fn("apple.prepareOpaqueCall")(function* (operation) {
    const input = yield* attempt(() => decodeOwned(ApplePreparation, operation.intent))
    return yield* makeRequest({
      transport: "opaque/1",
      endpoint: endpoint(input),
      method: "invoke",
      headers: [],
      body: new TextEncoder().encode(canonical(input)),
      principal: input.principal,
      scope: input.credentialRef,
      replay: new NoReplay({}),
    })
  }),
})
