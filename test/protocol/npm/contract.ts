export const npmProtocolContractV1 = {
  schemaVersion: "npm-protocol-contract/v1",
  verifiedOn: "2026-08-12",
  minimumNode: "22.14.0",
  minimumNpm: "11.5.1",
  registry: "https://registry.npmjs.org/",
  githubActionsEnvironment: {
    detection: "GITHUB_ACTIONS",
    oidcRequestValues: [
      "ACTIONS_ID_TOKEN_REQUEST_URL",
      "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
    ],
    provenanceValues: [
      "GITHUB_WORKFLOW_REF",
      "GITHUB_REPOSITORY",
      "GITHUB_SERVER_URL",
      "GITHUB_EVENT_NAME",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REF",
      "GITHUB_SHA",
      "RUNNER_ENVIRONMENT",
      "GITHUB_RUN_ID",
      "GITHUB_RUN_ATTEMPT"
    ]
  },
  endpoints: {
    packageMetadata: {
      method: "GET",
      path: "/{package}",
      accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8"
    },
    oidcExchange: {
      method: "POST",
      path: "/-/npm/v1/oidc/token/exchange/package/{escaped-package-name}",
      audience: "npm:registry.npmjs.org"
    }
  },
  sources: [
    {
      capability: "package metadata versions, dist-tags, integrity, and shasum",
      url: "https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md"
    },
    {
      capability: "trusted publishing support, versions, and short-lived workflow authority",
      url: "https://docs.npmjs.com/trusted-publishers/"
    },
    {
      capability: "GitHub Actions OIDC request URL, bearer token, and custom audience",
      url: "https://docs.github.com/en/actions/reference/security/oidc"
    },
    {
      capability: "npm publish tag, access, provenance, and lifecycle controls",
      url: "https://docs.npmjs.com/cli/v11/commands/npm-publish/"
    },
    {
      capability: "npm 11.5.1 GitHub OIDC exchange implementation",
      url: "https://github.com/npm/cli/blob/v11.5.1/lib/utils/oidc.js"
    },
    {
      capability: "npm 11.5.1 GitHub Actions provenance environment implementation",
      url: "https://github.com/npm/cli/blob/v11.5.1/workspaces/libnpmpublish/lib/provenance.js"
    },
    {
      capability: "GitHub default workflow and runner environment variables",
      url: "https://docs.github.com/en/actions/reference/workflows-and-actions/variables"
    }
  ]
} as const
