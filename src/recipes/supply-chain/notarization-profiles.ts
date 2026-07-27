const profile = (id: "quill" | "apple-native", executable: string, argv: ReadonlyArray<string>,
  successShape: string) => Object.freeze({
  profileId: `supply.${id}-notarization.v1`,
  contract: Object.freeze({
    kind: "supply-chain-publish" as const, variant: "AppleNotarization" as const,
    hosts: ["darwin-arm64", "darwin-x64"],
    authenticationClass: "credential-reference:apple-notary",
    authorityClass: "credentialed-remote-publish" as const,
    inputSelectors: ["verified-apple-artifact"], outputs: [{ type: "notarized-artifact" }],
    targetCoordinates: ["bundleId", "version"],
    request: { method: "LOCAL_REMOTE", executable, argv, environmentNames: [] },
    response: { successShape, failureShape: "typed-notarization-evidence/v1" },
    transmittedStreamRule: "sha256-equals-reviewed-subject",
    checkpoints: id === "quill" ? ["sign", "submit", "staple"] : ["codesign", "submit", "staple"],
    commitmentClassifier: {
      "before-dispatch": "DefinitelyNotCommitted", "validated-output": "DefinitelyCommitted",
      "service-refusal": "DefinitelyNotCommitted", "response-loss": "PossiblyCommitted",
      "invalid-output": "Unclassifiable", "malformed-response": "Unclassifiable"
    },
    reconciliation: { method: "READ_ONLY_STATUS", responseShape: "apple-notary-status/v1",
      outcomes: ["MatchingCommit", "ProvenAbsent", "Inconclusive"] }
  })
})
export const notarizationProfiles = [
  profile("quill", "quill", ["sign-and-notarize", "--input", "{input}", "--output", "{stagingOutput}"],
    "quill-notarization-result/v1"),
  profile("apple-native", "internal:apple-native-notary",
    ["codesign", "notarytool", "stapler"], "apple-native-notarization-result/v1")
]
