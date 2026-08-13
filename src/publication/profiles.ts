import {
  githubRecoveryCapabilityProfile
} from "./github.js"
import {
  npmRecoveryCapabilityProfile
} from "./npm.js"
import { validatePublicationProfiles } from "./recovery.js"

/**
 * Canonical provider registrations shared by executable capability modules,
 * runtime dispatch, and generated recovery documentation. An authored
 * correction proposal is not an installed conditional correction adapter.
 */
export const installedPublicationProfiles = validatePublicationProfiles(Object.freeze({
  npm: Object.freeze({
    id: "publish.npm",
    provider: "npm",
    preparedTag: "PreparedNpmPublication",
    recovery: npmRecoveryCapabilityProfile,
    correctionAdapters: [] as const,
    evidence: Object.freeze({
      reviewedAt: "2026-08-12",
      observationSources: Object.freeze([
        "https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md",
        "https://docs.npmjs.com/cli/v11/commands/npm-publish/"
      ]),
      correctionSources: Object.freeze([
        "https://docs.npmjs.com/cli/v11/commands/npm-deprecate/",
        "https://docs.npmjs.com/policies/unpublish/"
      ]),
      correctionFinding: "Official npm documentation exposes deprecation but no conditional update bound to an observed package generation."
    })
  }),
  github: Object.freeze({
    id: "publish.github",
    provider: "github",
    preparedTag: "PreparedGitHubPublication",
    recovery: githubRecoveryCapabilityProfile,
    correctionAdapters: [] as const,
    evidence: Object.freeze({
      reviewedAt: "2026-08-12",
      observationSources: Object.freeze([
        "https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28",
        "https://docs.github.com/en/rest/git/tags?apiVersion=2022-11-28",
        "https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28",
        "https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28"
      ]),
      correctionSources: Object.freeze([
        "https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#update-a-release",
        "https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28#use-conditional-requests"
      ]),
      correctionFinding: "GitHub documents conditional reads, but unsafe-method conditions are unsupported unless an endpoint says otherwise; the release update endpoint documents none."
    })
  })
}))
