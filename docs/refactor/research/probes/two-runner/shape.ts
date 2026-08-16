export interface IntentSchema<I> {
  readonly encode: (intent: I) => unknown
  readonly decode: (encoded: unknown) => I
}

export interface ProviderDefinition<I> {
  readonly definitionId: string
  readonly intentSchema: IntentSchema<I>
  readonly intentSchemaVersion: string
  readonly behaviorId: string
  readonly operationId: (intent: I) => string
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

export interface PreparedDispatch {
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

export interface DispatchStarted {
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

export interface ReplayFactComparison {
  readonly fact: string
  readonly recorded: string | null
  readonly candidate: string | null
  readonly result: "match" | "mismatch" | "unsupported" | "expired"
  readonly consequence: "allow" | "block"
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
    | "request-mismatch"
    | "unsupported-replay-scheme"
    | "expired-replay-protection"
    | "unsupported-transport"
    | "journal-cas-lost"
  readonly comparisons: ReadonlyArray<ReplayFactComparison>
  readonly riskAcceptance: RiskAcceptanceAssertion
}

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? (<T>() => T extends B ? 1 : 2) extends
      (<T>() => T extends A ? 1 : 2)
      ? true
      : false
    : false

type Assert<T extends true> = T

type ProbeIntent = {
  readonly coordinate: string
  readonly payload: Readonly<Record<string, string>>
}

type ExpectedProviderDefinitionKeys =
  | "definitionId"
  | "intentSchema"
  | "intentSchemaVersion"
  | "behaviorId"
  | "operationId"

type ExpectedDispatchStartedKeys =
  | "type"
  | "dispatchId"
  | "attempt"
  | "operationId"
  | "providerDefinitionId"
  | "providerBehaviorId"
  | "providerLockfileIdentity"
  | "transportId"
  | "endpointIdentity"
  | "requestFingerprint"
  | "authorizationIdentity"
  | "replayProtection"
  | "replayBasis"
  | "startedAt"

type ProviderDefinitionFieldListIsExact = Assert<
  Equal<keyof ProviderDefinition<ProbeIntent>, ExpectedProviderDefinitionKeys>
>

type DispatchStartedFieldListIsExact = Assert<
  Equal<keyof DispatchStarted, ExpectedDispatchStartedKeys>
>

export type ProbeShapeAssertions =
  | ProviderDefinitionFieldListIsExact
  | DispatchStartedFieldListIsExact

export const providerDefinitionFieldList = [
  "definitionId",
  "intentSchema",
  "intentSchemaVersion",
  "behaviorId",
  "operationId"
] as const satisfies ReadonlyArray<keyof ProviderDefinition<ProbeIntent>>

export const dispatchStartedFieldList = [
  "type",
  "dispatchId",
  "attempt",
  "operationId",
  "providerDefinitionId",
  "providerBehaviorId",
  "providerLockfileIdentity",
  "transportId",
  "endpointIdentity",
  "requestFingerprint",
  "authorizationIdentity",
  "replayProtection",
  "replayBasis",
  "startedAt"
] as const satisfies ReadonlyArray<keyof DispatchStarted>
