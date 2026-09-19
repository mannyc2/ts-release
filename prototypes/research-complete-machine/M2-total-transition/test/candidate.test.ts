import { describe, expect, test } from "bun:test"
import { LimitedStore, exerciseArtifactBoundary, exerciseCasContenders, exerciseExternalProvider, exerciseHostOwnership, exerciseMalformedProviderDag } from "../src/boundaries.js"
import { TypedInterpreter } from "../src/interpreter.js"
import { EVENTS, FORBIDDEN_TRANSITION_COUNT, STATES, TRANSITION_CELLS, TRANSITION_TABLE, transition } from "../src/transition-table.js"
import { selfCheck } from "../src/scenarios.js"

describe("M2 total-transition candidate", () => {
  test("owns every state/event cell explicitly", () => {
    expect(TRANSITION_CELLS).toHaveLength(STATES.length * EVENTS.length)
    expect(TRANSITION_CELLS).toHaveLength(81)
    expect(FORBIDDEN_TRANSITION_COUNT).toBeGreaterThan(0)
    for (const state of STATES) for (const event of EVENTS) expect(TRANSITION_TABLE[state][event]).toBeDefined()
    expect(transition("Planned", "Authorize")).toBe("Authorized")
    expect(() => transition("Planned", "Dispatch")).toThrow()
    selfCheck()
  })

  test("uses a typed interpreter and real hostile boundaries", () => {
    expect(new TypedInterpreter().snapshot.state).toBe("Idle")
    exerciseCasContenders()
    exerciseExternalProvider()
    exerciseMalformedProviderDag()
    exerciseArtifactBoundary()
    exerciseHostOwnership()
  })

  test("applies the same bound on write and read", () => {
    const store = new LimitedStore(4)
    store.write("exact", new Uint8Array(4))
    expect(store.read("exact")).toHaveLength(4)
    expect(() => store.write("over", new Uint8Array(5))).toThrow()
    store.inject("over", new Uint8Array(5))
    expect(() => store.read("over")).toThrow()
  })
})
