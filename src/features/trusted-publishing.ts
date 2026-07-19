// Invariant: trusted-publishing config compaction and credential environment derivation have one owner.
import * as Schema from "effect/Schema"
import { WorkflowFileName } from "../grammar/artifact.js"
export const trustedPublishingAuthEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
]

export const TrustedPublishingProvider = Schema.Literals(["github-actions"])
export const trustedPublishingConfigFields = {
  provider: Schema.optionalKey(TrustedPublishingProvider),
  workflow: Schema.optionalKey(WorkflowFileName)
}

export interface TrustedPublishingSection {
  readonly provider: "github-actions"
  readonly workflow: string
}

export const compactTrustedPublishing = (
  config:
    | boolean
    | {
      readonly provider?: "github-actions" | undefined
      readonly workflow?: string | undefined
    }
    | undefined
): TrustedPublishingSection | undefined => {
  if (config === undefined || config === false) {
    return undefined
  }
  if (config === true) {
    return { provider: "github-actions", workflow: "release.yml" }
  }
  return {
    provider: config.provider ?? "github-actions",
    workflow: config.workflow ?? "release.yml"
  }
}

export const publishingAuthEnvNames = (
  trustedPublishing: TrustedPublishingSection | undefined,
  credentialEnvNames: ReadonlyArray<string | undefined>
): ReadonlyArray<string> =>
  trustedPublishing === undefined
    ? credentialEnvNames.filter((name): name is string => name !== undefined)
    : trustedPublishingAuthEnvNames
