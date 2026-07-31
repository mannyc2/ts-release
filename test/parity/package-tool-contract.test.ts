import { describe, expect, test } from "bun:test"
import {
  localToolOutcome, localToolProfile, preflightTool
} from "../../src/recipes/packages/tool.js"

const profile = localToolProfile({
  profileId: "package.fixture.v1",
  contractFixtureId: "contract.package.fixture.v1",
  hosts: ["linux-x64"],
  executable: {
    name: "fixture", versionProbe: ["--version"], versionOutput: "semver-first-token",
    supportedRange: ">=2.0.0 <3.0.0"
  },
  argv: ["build", "{input}", "--output", "{output}"],
  inputSelectors: ["input"],
  outputs: [{ pathTemplate: "{output}", type: "package" }],
  validationOperation: "fixture-and-sha256/v1"
})

describe("strict local package tool runner", () => {
  test("preflights host and version before work", () => {
    expect(preflightTool(profile, "linux-x64", "fixture 2.4.1")).toBe("ready")
    expect(preflightTool(profile, "darwin-arm64", "fixture 2.4.1")).toBe("unsupported-host")
    expect(preflightTool(profile, "linux-x64", "fixture 3.0.0")).toBe("unsupported-version")
  })
  test("accepts only exact validated declared output", () => {
    expect(localToolOutcome(0, 1, 1, true)).toBe("materialized")
    expect(localToolOutcome(1, 1, 1, true)).toBe("exit-failure")
    expect(localToolOutcome(0, 1, 0, true)).toBe("output-mismatch")
    expect(localToolOutcome(0, 1, 1, false)).toBe("validation-failure")
    expect(profile.contract.invocation).toMatchObject({
      authenticationClass: "none", authorityClass: "local-only"
    })
    expect(profile.contract.remoteMutation).toBeFalse()
  })
})
