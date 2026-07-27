const hosts = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"] as const
const classifier = {
  "before-dispatch": "DefinitelyNotCommitted", "http-2xx-valid-digest": "DefinitelyCommitted",
  "http-4xx": "DefinitelyNotCommitted", "http-5xx": "PossiblyCommitted",
  "response-loss": "PossiblyCommitted", "malformed-response": "Unclassifiable"
} as const
const profile = <const Variant extends string>(input: {
  readonly id: string, readonly variant: Variant, readonly authenticationClass: string,
  readonly inputSelector: string, readonly output: string, readonly targetCoordinates: ReadonlyArray<string>,
  readonly method: "POST" | "PUT", readonly endpointTemplate: string, readonly bodyShape: string,
  readonly successShape: string, readonly transmittedStreamRule: string,
  readonly checkpoints: ReadonlyArray<string>, readonly reconcileMethod: "GET" | "HEAD"
}) => Object.freeze({
  profileId: `supply.${input.id}.v1`,
  contract: Object.freeze({
    kind: "supply-chain-publish" as const, variant: input.variant, hosts,
    authenticationClass: input.authenticationClass, authorityClass: "remote-publish" as const,
    inputSelectors: [input.inputSelector], outputs: [{ type: input.output }],
    targetCoordinates: input.targetCoordinates,
    request: { method: input.method, endpointTemplate: input.endpointTemplate,
      headers: ["authorization", "content-type", "x-reconciliation-key"],
      bodyShape: input.bodyShape },
    response: { successShape: input.successShape, failureShape: "registry-error/v1" },
    transmittedStreamRule: input.transmittedStreamRule,
    checkpoints: input.checkpoints, commitmentClassifier: classifier,
    reconciliation: { method: input.reconcileMethod, endpointTemplate: input.endpointTemplate,
      responseShape: input.successShape, outcomes: ["MatchingCommit", "ProvenAbsent", "Inconclusive"] }
  })
})
export const registryProfiles = [
  profile({ id: "registry-image", variant: "RegistryImage",
    authenticationClass: "credential-reference:oci-registry", inputSelector: "verified-oci-layout",
    output: "observed-container-digest", targetCoordinates: ["repository", "tag"], method: "PUT",
    endpointTemplate: "https://registry.invalid/v2/{repository}/manifests/{tag}",
    bodyShape: "verified-oci-manifest-stream/v1", successShape: "registry-digest-header/v1",
    transmittedStreamRule: "sha256-equals-reviewed-subject", checkpoints: ["blobs", "manifest"],
    reconcileMethod: "HEAD" }),
  profile({ id: "registry-manifest", variant: "RegistryManifest",
    authenticationClass: "credential-reference:oci-registry", inputSelector: "verified-manifest-list",
    output: "observed-container-digest", targetCoordinates: ["repository", "tag"], method: "PUT",
    endpointTemplate: "https://registry.invalid/v2/{repository}/manifests/{tag}",
    bodyShape: "verified-oci-index-stream/v1", successShape: "registry-digest-header/v1",
    transmittedStreamRule: "sha256-equals-reviewed-subject", checkpoints: ["manifest"],
    reconcileMethod: "HEAD" }),
  profile({ id: "registry-signature", variant: "RegistrySignature",
    authenticationClass: "credential-reference:cosign", inputSelector: "observed-container-digest",
    output: "observed-signature-digest", targetCoordinates: ["repository", "digest"], method: "POST",
    endpointTemplate: "https://registry.invalid/v2/{repository}/signatures/{digest}",
    bodyShape: "digest-bound-signature-envelope/v1", successShape: "signature-digest-response/v1",
    transmittedStreamRule: "subject-digest-equals-reviewed-observed-digest", checkpoints: ["signature"],
    reconcileMethod: "GET" })
]
