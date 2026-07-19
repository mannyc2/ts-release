// Invariant: trusted-publishing config compaction and credential environment derivation have one owner.
import * as Schema from "effect/Schema"
import { WorkflowFileName } from "../../grammar/artifact.js"
import { defaulted } from "../../grammar/defaulted.js"
export const trustedPublishingAuthEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
]

export const TrustedPublishingProvider = Schema.Literals(["github-actions"])
export const trustedPublishingConfigFields = {
  provider: defaulted(TrustedPublishingProvider, "github-actions"),
  workflow: defaulted(WorkflowFileName, "release.yml")
}
export const publishingAuthEnvNames = (
  trustedPublishing: boolean,
  credentialEnvNames: ReadonlyArray<string | undefined>
): ReadonlyArray<string> =>
  trustedPublishing
    ? trustedPublishingAuthEnvNames
    : credentialEnvNames.filter((name): name is string => name !== undefined)
