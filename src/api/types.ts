import type * as Layer from "effect/Layer"
import type { CorrectionOutcome } from "../correction/coordinator.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { ReleaseInspection, PreparedReleaseInspection } from "../release/inspect.js"
import type { PublicationCredentials, PublicationOutcome } from "../publication/observation.js"
import type { ReleaseRuntime } from "./runtime.js"

export type ReleaseApiLayer = Layer.Layer<ReleaseRuntime>
export type ReleaseApiServices = ReleaseRuntime
export type InspectOutput = ReleaseInspection | PreparedReleaseInspection
export type PublicationCredentialsInput = Partial<{
  readonly npm: PublicationCredentials
  readonly github: PublicationCredentials
}>
export interface PrepareInput { readonly config: unknown, readonly workspace: string, readonly preparedDirectory?: string }
export interface InspectInput {
  readonly config?: unknown, readonly prepared?: string, readonly workspace?: string
}
export interface PublishInput { readonly prepared: string, readonly credentials?: PublicationCredentialsInput }
export interface ReleaseInput extends PrepareInput {
  /** Diagnostic-only opt-in for exercising an intentionally empty graph. */
  readonly allowEmpty?: boolean
  readonly credentials?: PublicationCredentialsInput
}
export interface CorrectInput {
  readonly prepared: string, readonly correction: string, readonly credentials?: PublicationCredentialsInput
}
export interface ReleaseApi {
  readonly inspect: (input: InspectInput) => Promise<InspectOutput>
  readonly prepare: (input: PrepareInput) => Promise<PreparedBundle>
  readonly publish: (input: PublishInput) => Promise<ReadonlyArray<PublicationOutcome>>
  readonly release: (input: ReleaseInput) => Promise<{ readonly prepared: PreparedBundle, readonly publications: ReadonlyArray<PublicationOutcome> }>
  readonly correct: (input: CorrectInput) => Promise<CorrectionOutcome>
  readonly dispose: () => Promise<void>
}
