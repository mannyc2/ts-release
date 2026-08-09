import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { NonEmptyName } from "../../src/model/primitives.js"
import {
  Applied, Conflict, Equivalent, Inconclusive, NeedsMutation, OutcomeUnknown,
  PublicationBlocked, PublicationConverged, PublicationObserved, Rejected, publishSubject
} from "../../src/publication/observation.js"

const subjectId = NonEmptyName.make("subject:fixture")

describe("observe-before-mutate coordinator", () => {
  test("equivalent, conflict, and inconclusive subjects never mutate", async () => {
    for (const observation of [
      Equivalent.make({ subject: subjectId }),
      Conflict.make({ subject: subjectId, differences: [] }),
      Inconclusive.make({ subject: subjectId, reason: "timeout" })
    ]) {
      let mutations = 0
      const subject = { id: subjectId, observe: () => Effect.succeed(observation), mutate: () => Effect.sync(() => { mutations++; return Applied.make({ subject: subjectId, detail: "bad" }) }) }
      const result = await Effect.runPromise(publishSubject(subject))
      expect(result._tag).toBe(observation._tag === "Equivalent" ? "PublicationConverged" : "PublicationBlocked")
      expect(mutations).toBe(0)
    }
  })

  test("every mutation result is followed by an exact re-observation", async () => {
    let observations = 0
    let mutations = 0
    const subject = {
      id: subjectId,
      observe: () => Effect.sync(() => observations++ === 0
        ? NeedsMutation.make({ subject: subjectId, precondition: NonEmptyName.make("create") })
        : Inconclusive.make({ subject: subjectId, reason: "visibility lag" })),
      mutate: () => Effect.sync(() => { mutations++; return Rejected.make({ subject: subjectId, phase: "provider", reason: "409" }) })
    }
    const result = await Effect.runPromise(publishSubject(subject))
    expect(result).toBeInstanceOf(PublicationObserved)
    expect(observations).toBe(2)
    expect(mutations).toBe(1)
  })

  test("an unknown mutation can converge only through the second observation", async () => {
    let observations = 0
    const subject = {
      id: subjectId,
      observe: () => Effect.sync(() => observations++ === 0
        ? NeedsMutation.make({ subject: subjectId, precondition: NonEmptyName.make("create") })
        : Equivalent.make({ subject: subjectId })),
      mutate: () => Effect.succeed(OutcomeUnknown.make({ subject: subjectId, reason: "response lost" }))
    }
    const result = await Effect.runPromise(publishSubject(subject))
    expect(result).toBeInstanceOf(PublicationConverged)
    expect(result._tag === "PublicationConverged" ? result.mutation._tag : "").toBe("OutcomeUnknown")
    expect(observations).toBe(2)
  })
})
