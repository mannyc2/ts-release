import { describe, expect, test } from "bun:test"
import { unsupportedExecutionHost } from "../../src/index.js"

describe("execution host support", () => {
  test("supports Linux and macOS and refuses native Windows through one guard", () => {
    expect(unsupportedExecutionHost("linux")).toBeUndefined()
    expect(unsupportedExecutionHost("darwin")).toBeUndefined()
    expect(unsupportedExecutionHost("win32")).toBe(
      "ts-release runs on Linux and macOS. Its Bun builder can produce Windows artifacts."
    )
  })

  test("refuses an unknown host instead of guessing its filesystem semantics", () => {
    expect(unsupportedExecutionHost("freebsd")).toBe(
      "ts-release runs on Linux and macOS. Its Bun builder can produce Windows artifacts."
    )
  })
})
