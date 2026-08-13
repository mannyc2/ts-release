import { describe, expect, test } from "bun:test"
import { report } from "../apps/release-ts/scripts/self-release-facts.js"

describe("self-release report protocol", () => {
  test("details cannot shadow the protocol, status, or failures", () => {
    const logged: Array<string> = []
    const original = console.log
    console.log = (value?: unknown): void => { logged.push(String(value)) }
    try {
      report("fixture-report/v1", [], {
        schemaVersion: "hostile-report/v1",
        status: "failed",
        failures: ["hostile"]
      })
    } finally {
      console.log = original
    }
    expect(logged).toHaveLength(1)
    expect(JSON.parse(logged[0]!)).toMatchObject({
      schemaVersion: "fixture-report/v1",
      status: "ready",
      failures: []
    })
  })
})
