export const credentialedSigningProfile = Object.freeze({
  profileId: "supply.credentialed-artifact-sign.v1",
  contract: Object.freeze({
    kind: "supply-chain-publish" as const, variant: "CredentialedArtifactSignature" as const,
    hosts: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"],
    authenticationClass: "credential-reference:artifact-signing",
    authorityClass: "credentialed-local" as const,
    inputSelectors: ["verified-artifact"], outputs: [{ type: "detached-signature" }],
    targetCoordinates: ["artifactName"],
    request: { method: "LOCAL", executable: "internal:credentialed-signer",
      argv: ["sign", "--subject-digest", "{digest}", "--output", "{stagingOutput}"],
      environmentNames: [] },
    response: { successShape: "validated-detached-signature/v1",
      failureShape: "typed-credentialed-tool-evidence/v1" },
    transmittedStreamRule: "sha256-equals-reviewed-subject", checkpoints: ["sign"],
    commitmentClassifier: {
      "before-dispatch": "DefinitelyNotCommitted", "validated-output": "DefinitelyCommitted",
      "tool-refusal": "DefinitelyNotCommitted", "process-loss": "PossiblyCommitted",
      "invalid-output": "Unclassifiable", "staging-loss": "Unclassifiable"
    },
    reconciliation: { method: "LOCAL_STAT", responseShape: "signature-subject-digest/v1",
      outcomes: ["MatchingCommit", "ProvenAbsent", "Inconclusive"] }
  })
})
