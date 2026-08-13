import { describe, expect, test } from "bun:test"
import { unsupportedExecutionHost } from "../../src/index.js"

describe("execution host support", () => {
  test("supports only the certified Linux execution host through one guard", () => {
    expect(unsupportedExecutionHost("linux")).toBeUndefined()
    expect(unsupportedExecutionHost("darwin")).toBe(
      "ts-release is currently certified to run on Linux. Its Bun builder can cross-compile the advertised macOS artifacts."
    )
    expect(unsupportedExecutionHost("win32")).toBe(
      "ts-release is currently certified to run on Linux. Its Bun builder can cross-compile the advertised macOS artifacts."
    )
  })

  test("refuses an unknown host instead of guessing its filesystem semantics", () => {
    expect(unsupportedExecutionHost("freebsd")).toBe(
      "ts-release is currently certified to run on Linux. Its Bun builder can cross-compile the advertised macOS artifacts."
    )
  })
})
