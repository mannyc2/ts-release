import type { Sha256Hex } from "./schema/primitives.js"
import { hashCanonicalValue } from "./trial-hash.js"

export const TRIAL_RUNNER_SOURCE_CLOSURE_HASH_DOMAIN =
  "ts-release/architecture-runner-source-closure/v2"

export const TRIAL_RUNNER_SOURCE_CLOSURE_ALGORITHM_ID =
  "canonical-source-tree-plus-execution-inputs-sha256-v2"

/**
 * Binds the complete TypeScript source tree together with the exact package
 * manifest and TypeScript configuration bytes used by every frozen gate command.
 */
export const computeTrialRunnerSourceClosureSha256 = (
  sourceTreeSha256: Sha256Hex,
  packageManifestSha256: Sha256Hex,
  typeScriptConfigSha256: Sha256Hex
): Sha256Hex => hashCanonicalValue(TRIAL_RUNNER_SOURCE_CLOSURE_HASH_DOMAIN, {
  algorithmId: TRIAL_RUNNER_SOURCE_CLOSURE_ALGORITHM_ID,
  packageManifestSha256,
  sourceTreeSha256,
  typeScriptConfigSha256
})
