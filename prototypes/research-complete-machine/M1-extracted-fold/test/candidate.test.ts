import { describe, expect, test } from "bun:test"
import {
  BoundedJournalStore,
  proveConsumerCannotShadowHost,
  proveExactlyOneCasWinner,
  proveExternalProviderIsOrdinary,
  proveFinalizedArtifactAdoption,
  proveInvalidProviderGraphRejected
} from "../src/boundaries.js"
import { FORBIDDEN_TRANSITION_COUNT, GRAMMAR_BRANCHES, decide, foldJournal } from "../src/machine.js"
import { selfCheck } from "../src/scenarios.js"

describe("M1 extracted fold candidate", () => {
  test("publishes a complete extracted grammar", () => {
    expect(GRAMMAR_BRANCHES).toHaveLength(14)
    expect(FORBIDDEN_TRANSITION_COUNT).toBe(4)
    expect(foldJournal([{ _tag: "Planned" }, { _tag: "DispatchAuthorized" }, { _tag: "DispatchStarted" }, { _tag: "ObservationSatisfied" }])).toBe("Satisfied")
    expect(decide("Satisfied", "action.derive-terminal-report")).toEqual({ _tag: "Complete", outcome: "Succeeded" })
    selfCheck()
  })

  test("executes the hostile construction boundaries", () => {
    proveExactlyOneCasWinner()
    proveExternalProviderIsOrdinary()
    proveInvalidProviderGraphRejected()
    proveFinalizedArtifactAdoption()
    proveConsumerCannotShadowHost()
  })

  test("enforces journal limits symmetrically", () => {
    const store = new BoundedJournalStore(4)
    store.write("exact", new Uint8Array(4))
    expect(store.read("exact")).toHaveLength(4)
    expect(() => store.write("over", new Uint8Array(5))).toThrow()
    store.injectHistorical("over", new Uint8Array(5))
    expect(() => store.read("over")).toThrow()
  })
})
