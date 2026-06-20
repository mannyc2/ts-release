import * as Effect from "effect/Effect"
import {
  executeGate,
  Operation,
  RenderFileOperation,
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  ScoopBucketTarget,
  TargetCapabilities,
  TargetDryRunSupport
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"
import { ScoopTargetAdapter } from "./adapter.js"
import {
  catalogGitPushOperation,
  catalogPathBaseName,
  findRequiredArtifact,
  requireSha256FileArtifact,
  rejectNoDryRunInStrictMode,
  rejectUnsupportedCatalogTokenEnv,
  targetCapabilitiesFor,
  validationNoteOperation,
  validationStrategyForDryRun
} from "./adapter-helpers.js"

export type * from "../types/effect-internal.js"

const rejectUnsupportedTokenEnv = Effect.fn("rejectUnsupportedScoopTokenEnv")(function*(target: ScoopBucketTarget) {
  return yield* rejectUnsupportedCatalogTokenEnv({
    targetId: target.id,
    targetLabel: "Scoop bucket",
    tokenEnv: target.tokenEnv
  })
})

export const scoopTargetCapabilities = (target: ScoopBucketTarget): TargetCapabilities =>
  targetCapabilitiesFor(target, validationStrategyForDryRun(target.dryRunSupport))

interface ScoopManifest {
  readonly version: string
  readonly description: string
  readonly homepage: string
  readonly license?: string
  readonly url: string
  readonly hash: string
  readonly bin?: string
}

const renderManifest = (target: ScoopBucketTarget, model: ReleaseModel): Effect.Effect<string, PlanConstructionError> =>
  Effect.gen(function*() {
    const artifact = yield* findRequiredArtifact(
      model,
      target.id,
      target.artifactId,
      `Scoop target references missing artifact ${target.artifactId}.`
    )
    const validated = yield* requireSha256FileArtifact(artifact, {
      targetId: target.id,
      directoryReason: "Scoop manifest artifacts must be file-like, not directories.",
      checksumReason: "Scoop manifest rendering requires a sha256 artifact checksum."
    })

    const manifest: ScoopManifest = {
      version: model.identity.version,
      description: target.description ?? `${model.identity.name} ${model.identity.version} release artifact`,
      homepage: target.homepage ?? `https://github.com/${target.repository}`,
      ...(target.license === undefined ? {} : { license: target.license }),
      url: target.url ?? validated.artifact.path,
      hash: validated.checksum.value,
      ...(target.bin === undefined ? {} : { bin: target.bin })
    }

    return `${JSON.stringify(manifest, null, 2)}\n`
  })

const dryRunOperation = (
  target: ScoopBucketTarget,
  dryRunSupport: Exclude<TargetDryRunSupport, "native">
): Operation =>
  validationNoteOperation({
    id: `${target.id}:scoop-manifest-validation`,
    targetId: target.id,
    dryRunSupport,
    simulatedDescription: "Record simulated Scoop manifest validation.",
    skippedDescription: "Record skipped Scoop manifest validation.",
    simulatedMessage: "Scoop manifest validation is simulated by the deterministic release plan.",
    skippedMessage: "Scoop manifest validation was skipped because this target declares no dry-run support."
  })

export const planScoopOperations = Effect.fn("planScoopOperations")(function*(
  target: ScoopBucketTarget,
  model: ReleaseModel
) {
  yield* rejectUnsupportedTokenEnv(target)
  const dryRunSupport = target.dryRunSupport
  if (dryRunSupport === "native") {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: "Scoop bucket targets do not support native validation in the portable adapter yet."
      })
    )
  }
  yield* rejectNoDryRunInStrictMode(target, model, "Scoop bucket target declares no dry-run support in strict mode.")

  const manifest = yield* renderManifest(target, model)

  return [
    RenderFileOperation.make({
      id: `${target.id}:scoop-render-manifest`,
      targetId: target.id,
      description: `Render Scoop manifest ${catalogPathBaseName(target.manifestPath)}.`,
      risk: "writes-local",
      gate: executeGate("Rendering a Scoop manifest writes a local generated file."),
      path: target.manifestPath,
      contents: manifest
    }),
    dryRunOperation(target, dryRunSupport),
    catalogGitPushOperation({
      id: `${target.id}:scoop-push`,
      targetId: target.id,
      description: `Push Scoop bucket update for ${model.identity.name}@${model.identity.version}.`,
      mutability: target.mutability,
      directory: target.bucketDirectory,
      irreversibleReason: "Pushing a Scoop bucket update is configured as irreversible.",
      externallyVisibleReason: "Pushing a Scoop bucket update is externally visible."
    })
  ] satisfies ReadonlyArray<Operation>
})

export const ScoopAdapter: ScoopTargetAdapter = {
  targetTag: "ScoopBucketTarget",
  capabilities: scoopTargetCapabilities,
  planOperations: planScoopOperations
}
