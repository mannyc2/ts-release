// Invariant: trusted-publishing config compaction and credential environment derivation have one owner.
import * as Schema from "effect/Schema"
import { WorkflowFileName } from "../grammar/artifact.js"
import { defaulted } from "../grammar/defaulted.js"
export const trustedPublishingAuthEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
]

export const TrustedPublishingProvider = Schema.Literals(["github-actions"])
export const trustedPublishingConfigFields = {
  provider: defaulted(TrustedPublishingProvider, "github-actions"),
  workflow: defaulted(WorkflowFileName, "release.yml")
}
export interface TrustedPublishingSection {
  readonly provider: "github-actions"
  readonly workflow: string
}

export const compactTrustedPublishing = (
  config: boolean | TrustedPublishingSection | undefined
): TrustedPublishingSection | undefined => {
  if (config === undefined || config === false) return undefined
  return config === true ? { provider: "github-actions", workflow: "release.yml" } : config
}

export const publishingAuthEnvNames = (
  trustedPublishing: TrustedPublishingSection | undefined,
  credentialEnvNames: ReadonlyArray<string | undefined>
): ReadonlyArray<string> =>
  trustedPublishing === undefined
    ? credentialEnvNames.filter((name): name is string => name !== undefined)
    : trustedPublishingAuthEnvNames
