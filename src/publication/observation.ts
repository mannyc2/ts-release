import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { NonEmptyName } from "../model/primitives.js"

export class PublicationError
  extends Schema.TaggedErrorClass<PublicationError>()("PublicationError", {
    phase: Schema.Literals(["decode", "observe", "mutate"]),
    commitment: Schema.Literals(["before-dispatch", "unknown"]),
    reason: Schema.String
  }) {}

export type PublicationCredentials = { readonly read: string, readonly publish: string }

export class ObservationDifference extends Schema.Class<ObservationDifference>("ObservationDifference")({
  field: NonEmptyName, expected: Schema.String, observed: Schema.String
}) {}

export class Equivalent extends Schema.TaggedClass<Equivalent>()("Equivalent", {
  subject: NonEmptyName
}) {}
export class NeedsMutation extends Schema.TaggedClass<NeedsMutation>()("NeedsMutation", {
  subject: NonEmptyName, precondition: NonEmptyName
}) {}
export class Conflict extends Schema.TaggedClass<Conflict>()("Conflict", {
  subject: NonEmptyName, differences: Schema.Array(ObservationDifference)
}) {}
export class Inconclusive extends Schema.TaggedClass<Inconclusive>()("Inconclusive", {
  subject: NonEmptyName, reason: Schema.String
}) {}
export const Observation = Schema.Union([Equivalent, NeedsMutation, Conflict, Inconclusive])
export type Observation = typeof Observation.Type

export class Applied extends Schema.TaggedClass<Applied>()("Applied", {
  subject: NonEmptyName, detail: Schema.String
}) {}
export class Rejected extends Schema.TaggedClass<Rejected>()("Rejected", {
  subject: NonEmptyName, phase: Schema.Literals(["before-dispatch", "provider"]), reason: Schema.String
}) {}
export class OutcomeUnknown extends Schema.TaggedClass<OutcomeUnknown>()("OutcomeUnknown", {
  subject: NonEmptyName, reason: Schema.String
}) {}
export const MutationResult = Schema.Union([Applied, Rejected, OutcomeUnknown])
export type MutationResult = typeof MutationResult.Type

export type PublicationSubject = {
  readonly id: NonEmptyName
  readonly observe: () => Effect.Effect<Observation, PublicationError>
  readonly mutate: (needs: NeedsMutation) => Effect.Effect<MutationResult, PublicationError>
}

export class PublicationConverged extends Schema.TaggedClass<PublicationConverged>()("PublicationConverged", {
  subject: NonEmptyName, mutation: MutationResult
}) {}
export class PublicationBlocked extends Schema.TaggedClass<PublicationBlocked>()("PublicationBlocked", {
  subject: NonEmptyName, observation: Schema.Union([Conflict, Inconclusive])
}) {}
export class PublicationObserved extends Schema.TaggedClass<PublicationObserved>()("PublicationObserved", {
  subject: NonEmptyName, mutation: MutationResult, observation: Schema.Union([Equivalent, NeedsMutation, Conflict, Inconclusive])
}) {}
export const PublicationOutcome = Schema.Union([PublicationConverged, PublicationBlocked, PublicationObserved])
export type PublicationOutcome = typeof PublicationOutcome.Type

/** The coordinator never constructs NeedsMutation; only an adapter can return it. */
export const publishSubject = Effect.fn("publishSubject")(function*(subject: PublicationSubject) {
  const first = yield* subject.observe()
  switch (first._tag) {
    case "Equivalent":
      return PublicationConverged.make({ subject: subject.id, mutation: Applied.make({ subject: subject.id, detail: "Already equivalent." }) })
    case "Conflict":
    case "Inconclusive":
      return PublicationBlocked.make({ subject: subject.id, observation: first })
    case "NeedsMutation": {
      const mutation = yield* subject.mutate(first)
      const after = yield* subject.observe()
      if (after._tag === "Equivalent") return PublicationConverged.make({ subject: subject.id, mutation })
      return PublicationObserved.make({ subject: subject.id, mutation, observation: after })
    }
  }
})
