const common = {
  kind: "package-store" as const,
  hosts: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"],
  executable: { name: "internal:package-store-client", versionProbe: ["internal"],
    versionOutput: "literal:1.0.0", supportedRange: "=1.0.0" },
  invocation: { argv: [], cwd: "none", stdin: "verified-content-stream", environmentNames: [],
    authorityClass: "remote-publish" },
  outputs: [], validationOperation: "digest-bound-response/v1",
  commitmentClassifier: {
    "before-dispatch": "DefinitelyNotCommitted", "http-2xx": "DefinitelyCommitted",
    "http-4xx": "DefinitelyNotCommitted", "http-5xx": "PossiblyCommitted",
    "response-loss": "PossiblyCommitted", "malformed-response": "Unclassifiable" }
}
const profile = <const Contract extends object>(id: string, contract: Contract) =>
  Object.freeze({ profileId: `package.store-${id}.v1`, contract: Object.freeze(contract) })
export const packageStoreProfiles = [
  profile("snap", {
    ...common, invocation: { ...common.invocation,
      authenticationClass: "credential-reference:snap-store" },
    inputSelectors: ["verified-snap"],
    request: { method: "POST", endpoint: "https://api.snapcraft.io/v2/snaps/releases",
      headers: ["authorization", "content-type", "x-reconciliation-key"],
      bodyShape: "snap-release-request/v1" },
    response: { successShape: "snap-release-response/v1", failureShape: "package-store-failure/v1" },
    checkpoints: ["upload", "release"], targetCoordinates: ["name", "channel"],
    reconciliation: {
      method: "GET", endpointTemplate: "https://api.snapcraft.io/v2/snaps/{name}/releases/{channel}",
      requestShape: "snap-release-reconcile/v1", responseShape: "snap-release-reconcile-response/v1",
      outcomes: ["MatchingCommit", "ProvenAbsent", "Inconclusive"] }
  }),
  profile("chocolatey", {
    ...common, invocation: { ...common.invocation,
      authenticationClass: "credential-reference:chocolatey-store" },
    inputSelectors: ["verified-nupkg"],
    request: {
      method: "PUT", endpoint: "https://push.chocolatey.org/api/v2/package",
      headers: ["x-nuget-apikey", "content-type", "x-reconciliation-key"],
      bodyShape: "chocolatey-package-push/v1"
    },
    response: { successShape: "empty-2xx/v1", failureShape: "package-store-failure/v1" },
    checkpoints: ["push"], targetCoordinates: ["name", "version"],
    reconciliation: {
      method: "GET",
      endpointTemplate: "https://community.chocolatey.org/api/v2/Packages(Id='{name}',Version='{version}')",
      requestShape: "chocolatey-package-reconcile/v1",
      responseShape: "chocolatey-package-reconcile-response/v1",
      outcomes: ["MatchingCommit", "ProvenAbsent", "Inconclusive"]
    }
  })
]
export type PackageStoreProfile = (typeof packageStoreProfiles)[number]
export const findPackageStoreProfile = (id: string): PackageStoreProfile => {
  const found = packageStoreProfiles.find((candidate) => candidate.profileId === id)
  if (found === undefined) throw new Error(`Unknown immutable package store profile ${id}.`)
  return found
}
