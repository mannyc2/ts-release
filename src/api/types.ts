import type * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import type { CredentialProvider } from "../publication/authority.js"
import type { AuthoredCorrection } from "../correction/intent.js"
import type { ObservationReport, ReleaseReport as ReleaseReportType } from "../publication/report.js"
import { SafeReason } from "../publication/report.js"
import type {
  AuthorizedMutationHttp,
  HttpAuthorizer
} from "../publication/http.js"
import type {
  CertifiedPublisherSpawn,
  NpmUserConfigResource
} from "../publication/publisher.js"
import type { ReleaseInspection, PreparedReleaseInspection } from "../release/inspect.js"
import {
  CompletePreparedReleaseRef,
  type CompletePreparedReleaseRef as CompletePreparedReleaseRefValue
} from "../release/prepared-ref.js"
import type { PreparedReleaseStore } from "../release/prepared-store.js"
import type { ReleaseRuntime } from "./runtime.js"
import type { CustomProviderAdapter } from "../extensions/provider-adapter.js"

export type ReleaseApiServices =
  | ReleaseRuntime
  | PreparedReleaseStore
  | CredentialProvider
  | HttpAuthorizer
  | AuthorizedMutationHttp
  | NpmUserConfigResource
  | CertifiedPublisherSpawn

export type ReleaseApiLayer = Layer.Layer<ReleaseApiServices>
export type InspectOutput = ReleaseInspection | PreparedReleaseInspection

/** Custom application composition only; stock CLI/Action pass no adapters. */
export interface ReleaseApiOptions {
  readonly providerAdapters?: ReadonlyArray<CustomProviderAdapter>
}

export interface PrepareInput {
  readonly config: unknown
  readonly workspace: string
}

export type InspectInput =
  | {
    readonly config: unknown
    readonly workspace: string
    readonly prepared?: never
  }
  | {
    readonly prepared: CompletePreparedReleaseRefValue
    readonly config?: never
    readonly workspace?: never
  }

export interface ObserveInput {
  readonly prepared: CompletePreparedReleaseRefValue
}

export interface PublishInput {
  readonly prepared: CompletePreparedReleaseRefValue
}

export interface ReleaseInput extends PrepareInput {
  /** Diagnostic-only opt-in for exercising an intentionally empty graph. */
  readonly allowEmpty?: boolean
}

export interface CorrectInput {
  readonly prepared: CompletePreparedReleaseRefValue
  /** Human-authored correction; destination facts are derived from prepared. */
  readonly correction: AuthoredCorrection
}

/**
 * Plan 224 keeps correction on the durable-reference boundary while plan 229
 * owns the first executable authored-correction grammar.
 */
export class CorrectionReport extends Schema.Class<CorrectionReport>("CorrectionReport")({
    prepared: CompletePreparedReleaseRef,
    status: Schema.Literals(["unsupported", "complete", "blocked", "uncertain"]),
    provider: Schema.Literals(["npm", "github", "catalog-git"]),
    reason: SafeReason,
    proposal: Schema.String,
    report: Schema.optionalKey(Schema.Unknown)
  }) {}

export interface ReleaseResult {
  readonly prepared: CompletePreparedReleaseRefValue
  readonly report: ReleaseReportType
}

export interface ReleaseApi {
  readonly inspect: (input: InspectInput) => Promise<InspectOutput>
  readonly prepare: (input: PrepareInput) => Promise<CompletePreparedReleaseRefValue>
  readonly observe: (input: ObserveInput) => Promise<ObservationReport>
  readonly publish: (input: PublishInput) => Promise<ReleaseReportType>
  readonly release: (input: ReleaseInput) => Promise<ReleaseResult>
  readonly correct: (input: CorrectInput) => Promise<CorrectionReport>
  readonly dispose: () => Promise<void>
}
