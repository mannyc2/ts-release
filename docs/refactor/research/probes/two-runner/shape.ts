export interface IntentSchema<I> {
  readonly encode: (intent: I) => unknown
  readonly decode: (encoded: unknown) => I
}

/**
 * The original probe-selected provider shape. This interface is exercised by
 * the two-runner fixture; it is not asserted to be minimal or canonical.
 */
export interface SelectedProviderDefinition<I> {
  readonly definitionId: string
  readonly intentSchema: IntentSchema<I>
  readonly intentSchemaVersion: string
  readonly behaviorId: string
  readonly operationId: (intent: I) => string
}

/**
 * A smaller candidate used by the identity comparison. Core can derive the
 * operation identifier from plan identity, definition identity, schema
 * version, and canonical Intent bytes. behaviorId can then be provenance
 * rather than an identity or replay-authority field.
 */
export interface CoreDerivedProviderDefinitionCandidate<I> {
  readonly definitionId: string
  readonly intentSchema: IntentSchema<I>
  readonly intentSchemaVersion: string
}

export type ReplaySchemeId =
  | "replay.none/1"
  | "replay.idempotency-key/1"
  | "replay.cas/1"
  | "replay.exact-duplicate/1"

export type ReplayProtection =
  | {
      readonly schemeId: "replay.none/1"
    }
  | {
      readonly schemeId: "replay.idempotency-key/1"
      readonly originDispatchId: string
      readonly baseRequestFingerprint: string
      readonly keyFingerprint: string
      readonly scopeFingerprint: string
      readonly requestFingerprint: string
      readonly validFrom: string
      readonly expiresAt: string
    }
  | {
      readonly schemeId: "replay.cas/1"
      readonly coordinateFingerprint: string
      readonly expectedRevision: string
      readonly desiredRevision: string
      readonly requestFingerprint: string
    }
  | {
      readonly schemeId: "replay.exact-duplicate/1"
      readonly coordinateFingerprint: string
      readonly contentFingerprint: string
      readonly requestFingerprint: string
      readonly expiresAt?: string
    }

export interface CorePreparedHttpRequest {
  readonly transportId: "core.http/1"
  readonly method: string
  readonly url: string
  readonly headers: ReadonlyArray<readonly [string, string]>
  readonly bodyBase64: string
}

/** The strict candidate exercised by runner A and runner B. */
export interface SelectedPreparedDispatch {
  readonly operationId: string
  readonly providerDefinitionId: string
  readonly providerBehaviorId: string
  readonly providerLockfileIdentity: string
  readonly endpointIdentity: string
  readonly authorizationIdentity: string
  readonly request: CorePreparedHttpRequest
  readonly requestFingerprint: string
  readonly replayProtection: ReplayProtection
}

/**
 * A correspondence-focused candidate. It retains request, endpoint,
 * authorization, and replay-protection facts, while behavior and lockfile
 * identity are optional provenance rather than replay gates.
 */
export interface WireCorrespondencePreparedDispatchCandidate {
  readonly operationId: string
  readonly providerDefinitionId: string
  readonly endpointIdentity: string
  readonly authorizationIdentity: string
  readonly request: CorePreparedHttpRequest
  readonly requestFingerprint: string
  readonly replayProtection: ReplayProtection
  readonly implementationProvenance?: {
    readonly packageVersion?: string
    readonly sourceRevision?: string
    readonly lockfileDigest?: string
  }
}

export type ReplayBasis =
  | { readonly kind: "initial" }
  | {
      readonly kind: "recorded-protection"
      readonly priorDispatchId: string
      readonly schemeId: ReplaySchemeId
    }
  | {
      readonly kind: "risk-accepted"
      readonly riskAcceptedEventId: string
    }

/** The strict historical event shape currently exercised by the fixture. */
export interface SelectedDispatchStarted {
  readonly type: "DispatchStarted"
  readonly dispatchId: string
  readonly attempt: number
  readonly operationId: string
  readonly providerDefinitionId: string
  readonly providerBehaviorId: string
  readonly providerLockfileIdentity: string
  readonly transportId: "core.http/1" | "core.git/1" | "provider.opaque/1"
  readonly endpointIdentity: string
  readonly requestFingerprint: string
  readonly authorizationIdentity: string
  readonly replayProtection: ReplayProtection
  readonly replayBasis: ReplayBasis
  readonly startedAt: string
}

/** Candidate event if implementation identity is retained as provenance only. */
export interface WireCorrespondenceDispatchStartedCandidate {
  readonly type: "DispatchStarted"
  readonly dispatchId: string
  readonly attempt: number
  readonly operationId: string
  readonly providerDefinitionId: string
  readonly transportId: "core.http/1" | "core.git/1" | "provider.opaque/1"
  readonly endpointIdentity: string
  readonly requestFingerprint: string
  readonly authorizationIdentity: string
  readonly replayProtection: ReplayProtection
  readonly replayBasis: ReplayBasis
  readonly implementationProvenance?: {
    readonly packageVersion?: string
    readonly sourceRevision?: string
    readonly lockfileDigest?: string
  }
  readonly startedAt: string
}

export interface ReplayFactComparison {
  readonly fact: string
  readonly recorded: string | null
  readonly candidate: string | null
  readonly result: "match" | "mismatch" | "unsupported" | "expired"
  readonly consequence: "allow" | "block" | "diagnostic"
}

export interface RiskAcceptanceAssertion {
  readonly assertion: string
  readonly priorDispatchId: string
  readonly operationId: string
  readonly candidateRequestFingerprint: string
  readonly acceptedRisks: ReadonlyArray<string>
}

export interface ReplayStopExplanation {
  readonly decision: "stop"
  readonly code:
    | "provider-identity-drift"
    | "implementation-provenance-drift"
    | "request-mismatch"
    | "unsupported-replay-scheme"
    | "expired-replay-protection"
    | "unsupported-transport"
    | "journal-cas-lost"
  readonly comparisons: ReadonlyArray<ReplayFactComparison>
  readonly riskAcceptance: RiskAcceptanceAssertion
}

// These assignments prove that both candidate shapes are usable by ordinary
// TypeScript. They intentionally do not claim exactness or minimality.
type ProbeIntent = {
  readonly coordinate: string
  readonly payload: Readonly<Record<string, string>>
}

export type ProbeShapeCandidates =
  | SelectedProviderDefinition<ProbeIntent>
  | CoreDerivedProviderDefinitionCandidate<ProbeIntent>
  | SelectedDispatchStarted
  | WireCorrespondenceDispatchStartedCandidate
