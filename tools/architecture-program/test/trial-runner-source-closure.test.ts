import { describe, expect, it } from "@effect/vitest"
import { sha256Bytes } from "../src/trial-hash.js"
import {
  TRIAL_RUNNER_SOURCE_CLOSURE_ALGORITHM_ID,
  TRIAL_RUNNER_SOURCE_CLOSURE_HASH_DOMAIN,
  computeTrialRunnerSourceClosureSha256
} from "../src/trial-runner-source-closure.js"

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value)

describe("trial runner source closure", () => {
  it("changes when any exact runner execution input changes", () => {
    const source = sha256Bytes(bytes("source tree"))
    const otherSource = sha256Bytes(bytes("other source tree"))
    const manifest = sha256Bytes(bytes('{"scripts":{}}\n'))
    const otherManifest = sha256Bytes(bytes('{"scripts":{"gate:machine":"other"}}\n'))
    const config = sha256Bytes(bytes('{"compilerOptions":{"strict":true}}\n'))
    const otherConfig = sha256Bytes(bytes('{"compilerOptions":{"paths":{}}}\n'))
    const closure = computeTrialRunnerSourceClosureSha256(source, manifest, config)

    expect(computeTrialRunnerSourceClosureSha256(otherSource, manifest, config)).not.toBe(closure)
    expect(computeTrialRunnerSourceClosureSha256(source, otherManifest, config)).not.toBe(closure)
    expect(computeTrialRunnerSourceClosureSha256(source, manifest, otherConfig)).not.toBe(closure)
    expect(TRIAL_RUNNER_SOURCE_CLOSURE_ALGORITHM_ID).toBe(
      "canonical-source-tree-plus-execution-inputs-sha256-v2"
    )
    expect(TRIAL_RUNNER_SOURCE_CLOSURE_HASH_DOMAIN).toBe(
      "ts-release/architecture-runner-source-closure/v2"
    )
  })
})
