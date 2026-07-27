type Input = {
  readonly id: string, readonly kind: string, readonly variant: "ForgeRelease" | "ForgeCatalogPullRequest" |
    "MilestoneClose" | "ObjectStorePublish" | "GenericHttp" | "RepositoryPublish" | "RegistryMetadata",
  readonly protocol: string, readonly target: readonly [string, ...string[]],
  readonly options: ReadonlyArray<string>, readonly auth: "bearer" | "signed-request" | "shared-key",
  readonly method: "CONFIGURED" | "PATCH" | "POST" | "PUT", readonly base: string, readonly path: string,
  readonly headers: readonly [string, ...string[]], readonly body: string, readonly success: string,
  readonly statuses: readonly [number, ...number[]], readonly reconcile: "GET" | "HEAD" | "NONE",
  readonly reconcilePath: string, readonly equality: string, readonly checkpoints: readonly [string, ...string[]],
  readonly pagination?: "none" | "link-header", readonly selfHosted?: boolean
}
const classification = { beforeDispatch: "DefinitelyNotCommitted", success: "DefinitelyCommitted",
  rejection: "DefinitelyNotCommitted", responseLoss: "PossiblyCommitted", malformed: "Unclassifiable" } as const
export const providerProfile = <const I extends Input>(i: I) => Object.freeze({
  profileId: i.id, contractFixtureId: `contract.${i.id}`, provenance: "maintainer-product-decision" as const,
  checkpoints: i.checkpoints, contract: Object.freeze({
    kind: i.kind, variant: i.variant, protocolVersion: i.protocol,
    targetCoordinates: i.target, allowedOptions: i.options,
    authentication: { variant: i.auth, credentialSlotPattern: "^[A-Z][A-Z0-9_]*$" },
    request: { method: i.method, baseUrl: i.base, pathTemplate: i.path, headers: i.headers,
      bodySchema: i.body, reconciliationKeyLocation: "x-ts-release-key" },
    response: { successSchema: i.success, errorSchema: "provider-error/v1", successStatuses: i.statuses },
    commitmentPoint: "decoded-success-response" as const,
    clientReconciliationKey: { construction: "ts-release/provider-reconcile/v1" as const,
      transmitted: "x-ts-release-key" },
    classification, reconciliation: { supported: i.reconcile !== "NONE", method: i.reconcile,
      pathTemplate: i.reconcilePath, equality: i.equality },
    pagination: i.pagination ?? "none", rateLimit: "definite-before-commit" as const,
    redirects: "disabled" as const, redaction: ["authorization"] as const,
    selfHosted: { allowed: i.selfHosted ?? false, schemes: ["https"] as const,
      dnsScopes: i.selfHosted ? ["PublicOnly", "PrivateNetwork"] as const : ["PublicOnly"] as const,
      bindResolvedAddresses: true as const }
  })})
