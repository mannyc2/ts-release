export const attestationProfile = Object.freeze({
  profileId: "supply.remote-attestation.v1",
  contract: Object.freeze({
    kind: "supply-chain-publish" as const, variant: "RemoteAttestation" as const,
    hosts: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"],
    authenticationClass: "credential-reference:github-oidc",
    authorityClass: "remote-publish" as const,
    inputSelectors: ["verified-subject-set"], outputs: [{ type: "attestation-id" }],
    targetCoordinates: ["repository", "workflow"],
    request: { method: "POST",
      endpointTemplate: "https://api.github.com/repos/{repository}/attestations",
      headers: ["authorization", "content-type", "x-reconciliation-key"],
      bodyShape: "digest-bound-attestation/v1" },
    response: { successShape: "attestation-response/v1", failureShape: "attestation-error/v1" },
    transmittedStreamRule: "subject-set-equals-reviewed-material-bindings", checkpoints: ["attest"],
    commitmentClassifier: {
      "before-dispatch": "DefinitelyNotCommitted", "http-2xx-valid-id": "DefinitelyCommitted",
      "http-4xx": "DefinitelyNotCommitted", "http-5xx": "PossiblyCommitted",
      "response-loss": "PossiblyCommitted", "malformed-response": "Unclassifiable"
    },
    reconciliation: { method: "GET",
      endpointTemplate: "https://api.github.com/repos/{repository}/attestations/{key}",
      responseShape: "attestation-response/v1",
      outcomes: ["MatchingCommit", "ProvenAbsent", "Inconclusive"] }
  })
})
