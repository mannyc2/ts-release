import { Effect, Schema } from "effect"
import * as Apple from "effect-build-apple"
import { SubmissionReference } from "./Model.js"
import { PROVIDER_CONTRACT, makeRequest, type ProviderDefinition } from "../Provider.js"
import { NoReplay, type RequestFacts } from "../internal/ReleaseModel.js"
import { attempt, fail, reject } from "../internal/Error.js"
import { canonical, decodeOwned, sameData } from "../internal/Identity.js"
import { AppleEvidence, ApplePreparation, PREPARATION_FORMAT } from "./Model.js"
import { productOf, sourceIdentity } from "./Model.js"

/** Apps upload as ZIP archives; disk images and installers upload as themselves. */
const submissionKind = (input: ApplePreparation): "zip" | "dmg" | "pkg" =>
  input._tag === "AppPreparation" ? "zip" : input._tag === "DmgPreparation" ? "dmg" : "pkg"
/** A notarization reference names exactly this preparation's signed source. */
export const sourceCorresponds = (
  input: ApplePreparation,
  reference: SubmissionReference,
): boolean => {
  const artifact = reference.artifact
  if (!("product" in artifact)) return false
  const identity = sourceIdentity(input)
  return (
    reference.kind === submissionKind(input) &&
    artifact.product === productOf(input) &&
    artifact.bytes === identity.bytes &&
    artifact.sha256 === identity.sha256 &&
    sameData(artifact.signature, input.signature) &&
    (input._tag !== "AppPreparation" || artifact.path.split("/").at(-1) === input.bundleName)
  )
}
const ENDPOINT = "effect-build-apple/Notary.submit"
const requestCorresponds = (input: ApplePreparation, request: RequestFacts) =>
  request.transport === "opaque/1" &&
  request.endpoint === ENDPOINT &&
  request.method === "invoke" &&
  request.principal === input.principal &&
  request.scope === input.credentialRef &&
  request.headers.length === 0 &&
  request.replay._tag === "None"
/** A lookup has its own tool metadata; only the submission and signed source
 * identify the notarization that was recorded by the original runner. */
const submissionIdentity = ({ submissionId, kind, artifact }: SubmissionReference) => ({
  submissionId,
  kind,
  artifact,
})
export const classifyEvidence = (
  input: ApplePreparation,
  operationId: string,
  value: unknown,
  receipts: readonly unknown[],
) => {
  const evidence = decodeOwned(AppleEvidence, value)
  const correlated = "_tag" in evidence ? evidence.assessed.ticket : undefined
  const recorded = receipts.some((receipt) => {
    const submission = decodeOwned(SubmissionReference, receipt)
    return (
      sourceCorresponds(input, submission) &&
      ("_tag" in evidence
        ? sameData(submissionIdentity(submission), submissionIdentity(evidence.assessed.ticket))
        : submission.submissionId === evidence.submissionId)
    )
  })
  if ((correlated && !sourceCorresponds(input, correlated)) || !recorded)
    fail(
      "apple-correlation",
      "Apple observation has no matching recorded submission for this source",
    )
  if (!("_tag" in evidence))
    return evidence.status._tag === "Rejected" ? ("Conflict" as const) : ("Pending" as const)
  const product = productOf(input)
  const { assessed, finalArtifact } = evidence
  if (
    evidence.preparationId !== operationId ||
    finalArtifact.logicalName !== input.artifactName ||
    finalArtifact.product !== product ||
    assessed.product !== product ||
    assessed.bytes !== finalArtifact.identity.bytes ||
    assessed.sha256 !== finalArtifact.identity.sha256 ||
    !sameData(assessed.signature, input.signature)
  )
    fail("apple-assessment", "Selected final artifact does not match its assessed stapled product")
  return "Satisfied" as const
}

export const preparationProvider: ProviderDefinition = Object.freeze<ProviderDefinition>({
  contract: PROVIDER_CONTRACT,
  definitionId: "effect-build-apple.prepare",
  intentVersion: PREPARATION_FORMAT,
  intentCodec: ApplePreparation,
  receiptVersion: "ts-release/apple-submission/3",
  receiptCodec: SubmissionReference,
  requestCorresponds: (operation, request) =>
    requestCorresponds(decodeOwned(ApplePreparation, operation.intent), request),
  receiptCorresponds: (operation, request, value) => {
    const input = decodeOwned(ApplePreparation, operation.intent),
      receipt = decodeOwned(SubmissionReference, value)
    return requestCorresponds(input, request) && sourceCorresponds(input, receipt)
  },
  classifyReceipt: () => "Pending",
  // notarytool may have uploaded before its response became unreadable; that
  // submission is then remembered as an unresolved dispatch, never resent.
  dispatchError: {
    version: "effect-build-apple/Notary.ResponseInvalid/0.8.0",
    codec: Apple.Notary.ResponseInvalid,
    corresponds: (operation, request, value) => {
      const input = decodeOwned(ApplePreparation, operation.intent)
      const native = Schema.is(Apple.Notary.ResponseInvalid)(value)
        ? value
        : decodeOwned(Apple.Notary.ResponseInvalid, value)
      return requestCorresponds(input, request) && native.operation === "submit"
    },
  },
  observationVersion: "ts-release/apple-evidence/3",
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
      endpoint: ENDPOINT,
      method: "invoke",
      headers: [],
      body: new TextEncoder().encode(canonical(input)),
      principal: input.principal,
      scope: input.credentialRef,
      replay: new NoReplay({}),
    })
  }),
})
