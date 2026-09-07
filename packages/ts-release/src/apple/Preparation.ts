import { Effect } from "effect"
import * as Notary from "effect-build-apple/Notary"
import { createPreparationScope, loadPlan } from "../Plan.js"
import { observeRelease, runRelease } from "../Release.js"
import type { Scope } from "../Journal.js"
import { Content, type OwnedBundle } from "../internal/ArtifactModel.js"
import { loadBundle } from "../internal/BundleCodec.js"
import { captureContentOwner, type ContentOwner } from "../internal/Content.js"
import { projectReport } from "../internal/Decision.js"
import { Host, currentHost, read } from "../internal/Host.js"
import { ReleaseError, attempt, fail } from "../internal/Error.js"
import { canonical, decodeOwned, freeze, sha256 } from "../internal/Identity.js"
import { Plan, type JournalEvent, type RunOptions } from "../internal/ReleaseModel.js"
import {
  ApplePreparations,
  type AppleEvidence,
  ReadyToPlan,
  loadApplePreparations,
} from "./Model.js"
import { classifyEvidence, preparationProvider } from "./Provider.js"

export const preparationScopes = Effect.fn("apple.preparationScopes")(function* (
  input: ApplePreparations,
) {
  const admitted = yield* loadApplePreparations(input)
  return freeze(
    yield* Effect.forEach(admitted.preparations, (input) =>
      createPreparationScope(preparationProvider, input, admitted.journalId),
    ),
  )
})
const context = Effect.fn("apple.context")(function* (input: ApplePreparations) {
  const host = yield* currentHost,
    admitted = yield* loadApplePreparations(input)
  const scopes = yield* preparationScopes(admitted)
  yield* attempt(() => {
    const known =
      host.journal?.scopes.filter(
        (scope) =>
          scope._tag === "PreparationScope" &&
          scope.plan.operations[0]?.definitionId === preparationProvider.definitionId,
      ) ?? []
    if (
      host.journal?.journalId !== admitted.journalId ||
      known.length !== scopes.length ||
      known.some((scope) => !scopes.some((expected) => expected.plan.planId === scope.plan.planId))
    )
      fail(
        "preparation-set",
        "This journal must admit the complete exact Apple preparation collection",
      )
  })
  return { admitted, host, scopes }
})
const selected = (events: readonly JournalEvent[], plan: Plan) =>
  events.find(
    (event) =>
      event.planId === plan.planId &&
      event.body._tag === "ObservationRecorded" &&
      event.body.evidenceKind === "Observation" &&
      event.body.status === "Satisfied",
  )

/** Dispatch and native completion both pass through the common history laws.
 * An accepted submission is the sole polling handle; no missing ID is guessed. */
export const runPreparation = Effect.fn("apple.runPreparation")(function* (
  inputs: ApplePreparations,
  preparationId: string,
  options: Omit<RunOptions, "plan">,
  complete: (
    submission: Notary.Submission,
    preparationId: string,
  ) => Effect.Effect<AppleEvidence, ReleaseError>,
) {
  const runOptions = { ...options }
  const { admitted, host, scopes } = yield* context(inputs)
  const scope = scopes.find((scope) => scope.plan.operations[0]!.operationId === preparationId)
  if (!scope)
    return yield* new ReleaseError({
      code: "preparation-id",
      message: "Selected preparation is absent from this collection",
    })
  const plan = scope.plan,
    input = admitted.preparations[scopes.indexOf(scope)]!
  yield* runRelease({ ...runOptions, plan, observe: false }).pipe(Effect.provideService(Host, host))
  const { snapshot } = yield* read(host, plan)
  if (selected(snapshot.events, plan)) return
  const receipt = snapshot.events.find(
    (event) => event.planId === plan.planId && event.body._tag === "ReceiptAccepted",
  )
  if (!receipt || receipt.body._tag !== "ReceiptAccepted") return
  const body = receipt.body
  const submission = yield* attempt(() => decodeOwned(Notary.Submission, body.receipt))
  const evidence = yield* complete(submission, preparationId)
  const status = yield* attempt(() =>
    classifyEvidence(input, preparationId, evidence, [submission]),
  )
  yield* observeRelease({ plan }).pipe(
    Effect.provideService(Host, {
      ...host,
      providers: host.providers.map((provider) =>
        provider.definitionId === preparationProvider.definitionId
          ? { ...provider, observe: () => Effect.succeed({ status, evidence }) }
          : provider,
      ),
    }),
    Effect.catchIf(
      (error) => error.code === "preparation-selected",
      () =>
        Effect.gen(function* () {
          if (!selected((yield* read(host, plan)).snapshot.events, plan))
            return yield* new ReleaseError({
              code: "preparation-selected",
              message: "No validated selected Apple output exists",
            })
        }),
    ),
  )
})
const ownedBundle = Effect.fn("apple.readOwnedBundle")(function* (
  owner: ContentOwner,
  value: Content,
) {
  const content = yield* attempt(() => decodeOwned(Content, value))
  const bytes = new Uint8Array(yield* owner.read(content))
  if (String(bytes.length) !== content.bytes || (yield* sha256(bytes)) !== content.sha256)
    return yield* new ReleaseError({
      code: "apple-content",
      message: "Selected Bundle bytes differ from their immutable content identity",
    })
  return yield* loadBundle(owner, bytes)
})
const validateOutputs = Effect.fn("apple.validateOutputs")(function* (
  scopes: readonly Extract<Scope, { _tag: "PreparationScope" }>[],
  events: readonly JournalEvent[],
  bundle: OwnedBundle,
  owner: ContentOwner,
) {
  const results: ReadyToPlan[] = []
  for (const scope of scopes) {
    const record = selected(events, scope.plan)
    if (!record || record.body._tag !== "ObservationRecorded")
      return yield* new ReleaseError({
        code: "not-ready",
        message: "Every Apple preparation must select final bytes before publication",
      })
    const body = record.body
    const ready = yield* attempt(() => decodeOwned(ReadyToPlan, body.evidence))
    const outputs = yield* ownedBundle(owner, ready.outputsBundleContent)
    yield* attempt(() => {
      const final = ready.finalArtifact,
        artifact = outputs.artifacts.find((item) => item.logicalName === final.logicalName)
      if (
        !artifact ||
        (artifact._tag === "OwnedTree"
          ? final.kind !== "app" ||
            artifact.totalBytes !== final.artifactBytes ||
            artifact.upstreamManifestSha256 !== final.artifactDigest.value
          : final.kind === "app" ||
            artifact.content.bytes !== final.artifactBytes ||
            artifact.content.sha256 !== final.artifactDigest.value) ||
        outputs.artifacts.some((item) => item._tag === "OwnedTree" && item !== artifact)
      )
        fail(
          "ready-content-binding",
          "Selected output Bundle must contain the exact assessed native artifact and only file derivatives",
        )
      for (const output of outputs.artifacts)
        if (!bundle.artifacts.some((item) => canonical(item) === canonical(output)))
          fail(
            "prepared-output-binding",
            "Complete publication Bundle omits or changes a selected Apple output",
          )
    })
    results.push(ready)
  }
  return freeze(results)
})
const publicationContext = Effect.fn("apple.publicationContext")(function* (
  inputs: ApplePreparations,
  value: Plan,
  finalBundleContent: Content,
  contentOwner: ContentOwner,
) {
  const owner = captureContentOwner(contentOwner)
  const captured = yield* attempt(() => ({
    plan: decodeOwned(Plan, value),
    content: decodeOwned(Content, finalBundleContent),
  }))
  const admitted = yield* context(inputs)
  const plan = yield* loadPlan(captured.plan, admitted.host.providers)
  const publications = admitted.host.journal!.scopes.filter(
    (scope) => scope._tag === "PublicationScope",
  )
  if (
    publications.length !== 1 ||
    publications[0]!.plan.planId !== plan.planId ||
    plan.journalId !== admitted.admitted.journalId ||
    plan.bundleId !== captured.content.sha256
  )
    return yield* new ReleaseError({
      code: "final-bundle-binding",
      message: "The one publication Plan must bind the complete Bundle in the preparation journal",
    })
  const bundle = yield* ownedBundle(owner, captured.content)
  const prefix = yield* read(admitted.host, plan)
  const ready = yield* validateOutputs(admitted.scopes, prefix.snapshot.events, bundle, owner)
  return { ...admitted, plan, prefix, ready }
})
export const validateApplePublication = Effect.fn("apple.validatePublication")(function* (
  inputs: ApplePreparations,
  publication: Plan,
  finalBundleContent: Content,
  owner: ContentOwner,
) {
  return (yield* publicationContext(inputs, publication, finalBundleContent, owner)).ready
})
export const reportAppleContext = Effect.fn("apple.reportContext")(function* (
  inputs: ApplePreparations,
  owner: ContentOwner,
  publication?: { readonly plan: Plan; readonly finalBundleContent: Content },
) {
  const completed = publication
    ? yield* publicationContext(inputs, publication.plan, publication.finalBundleContent, owner)
    : undefined
  const admitted = completed ?? (yield* context(inputs))
  const prefix = completed?.prefix ?? (yield* read(admitted.host, admitted.scopes[0]!.plan))
  const { revision, events } = prefix.snapshot
  return freeze({
    journalId: admitted.admitted.journalId,
    revision,
    preparations: admitted.scopes.map((scope) => ({
      ...projectReport(
        scope.plan,
        events.filter((event) => event.planId === scope.plan.planId),
        "PreparationScope",
      ),
      revision,
    })),
    nativeFacts: events.filter((event) =>
      admitted.scopes.some((scope) => scope.plan.planId === event.planId),
    ),
    ...(completed && { publication: prefix.report() }),
  })
})
