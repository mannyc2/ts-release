const classification = { beforeDispatch: "DefinitelyNotCommitted", success: "DefinitelyCommitted",
  rejection: "DefinitelyNotCommitted", responseLoss: "PossiblyCommitted", malformed: "Unclassifiable" } as const
const httpProfile = (channel: string) => Object.freeze({
  profileId: `announce.${channel}/v1`, contractFixtureId: `contract.announce.${channel}/v1`,
  provenance: "maintainer-product-decision" as const, checkpoints: ["message"] as const,
  contract: Object.freeze({
    transport: "http", protocolVersion: "ts-release-announcement-envelope/v1", channel,
    authentication: { variant: "bearer", credentialSlotPattern: "^[A-Z][A-Z0-9_]*$" },
    request: { method: "POST", baseUrl: `https://${channel}.example.invalid`,
      pathTemplate: "/v1/messages/{destination}",
      headers: ["authorization", "content-type", "x-ts-release-key"],
      bodySchema: "reviewed-note/v1", reconciliationKeyLocation: "x-ts-release-key" },
    response: { successSchema: "message-receipt/v1", errorSchema: "announcement-error/v1",
      successStatuses: [200, 201, 202, 204] },
    commitmentPoint: "decoded-success-response", classification,
    reconciliation: { supported: false, method: "NONE", pathTemplate: "none", equality: "manual-only" },
    rateLimit: "definite-before-commit", redirects: "disabled", maximumPayloadBytes: 65_536,
    redaction: ["authorization"], messageId: "ts-release/reconciliation-key" })
})
const channels = ["bluesky", "discord", "discourse", "linkedin", "mastodon", "mattermost",
  "opencollective", "reddit", "slack", "teams", "telegram", "x", "webhook"] as const
export const announcementHttpProfiles = channels.map(httpProfile)
