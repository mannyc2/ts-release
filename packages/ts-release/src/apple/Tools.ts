import { Context, Effect, Layer } from "effect"
import type * as Artifact from "effect-build/Artifact"
import type * as Commit from "effect-build/Commit"
import type * as Tool from "effect-build/Tool"
import * as Apple from "effect-build-apple"

export type AppleToolError =
  | Tool.InputInvalid
  | Tool.Failed
  | Tool.SpawnFailed
  | Artifact.ArtifactError
  | Commit.CommitError
  | Apple.Notary.ResponseInvalid
/**
 * The native Apple operations a preparation needs, with credentials already
 * bound by the host. effect-build-apple runs them as xcrun commands; tests
 * substitute protocol doubles.
 */
export interface AppleToolsShape {
  readonly submit: (
    artifact: Apple.SignedProduct,
  ) => Effect.Effect<Apple.Notary.SubmissionReference, AppleToolError>
  readonly info: (
    reference: Apple.Notary.SubmissionReference,
  ) => Effect.Effect<Apple.Notary.Info, AppleToolError>
  readonly staple: (input: Apple.StapleInput) => Effect.Effect<Apple.StapledProduct, AppleToolError>
  readonly assess: (
    artifact: Apple.StapledProduct,
  ) => Effect.Effect<Apple.StapledProduct, AppleToolError>
}
export class AppleTools extends Context.Service<AppleTools, AppleToolsShape>()(
  "ts-release/AppleTools",
) {}
/** Live tools for one notarization credential; provide `Apple.layer()` and platform services beneath it. */
export const appleToolsLayer = (
  credential: Apple.Notary.Credential,
): Layer.Layer<AppleTools, never, Apple.Apple | Apple.Env> =>
  Layer.effect(
    AppleTools,
    Effect.gen(function* () {
      const context = yield* Effect.context<Apple.Apple | Apple.Env>()
      const native = <A, E>(effect: Effect.Effect<A, E, Apple.Apple | Apple.Env>) =>
        Effect.provideContext(effect, context)
      return {
        submit: (artifact) => native(Apple.Notary.submit({ artifact, credential })),
        info: (reference) => native(Apple.Notary.info({ reference, credential })),
        staple: (input) => native(Apple.staple(input)),
        assess: (artifact) => native(Apple.assess({ artifact })),
      }
    }),
  )
