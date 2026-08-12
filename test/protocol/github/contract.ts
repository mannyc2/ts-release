export const githubProtocolContractV1 = {
  schemaVersion: "github-protocol-contract/v1",
  verifiedOn: "2026-08-12",
  apiVersion: "2022-11-28",
  sources: [
    {
      capability: "authenticated repository visibility and exact full_name",
      url: "https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28"
    },
    {
      capability: "exact refs",
      url: "https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28"
    },
    {
      capability: "recursive annotated-tag objects",
      url: "https://docs.github.com/en/rest/git/tags?apiVersion=2022-11-28"
    },
    {
      capability: "release observation and creation",
      url: "https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28"
    },
    {
      capability: "release-asset pagination, download, and upload",
      url: "https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28"
    }
  ]
} as const
