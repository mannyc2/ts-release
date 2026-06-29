import * as Effect from "effect/Effect"
import type { ArtifactInventoryItem } from "../domain/artifact.js"
import {
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
  catalogGitPublishOperations,
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
  readonly bin?: string | ReadonlyArray<ReadonlyArray<string>>
}

const artifactUrl = (artifact: ArtifactInventoryItem, fallbackUrl: string | undefined): string =>
  fallbackUrl ?? artifact.downloadUrl ?? artifact.path

const artifactBin = (
  target: ScoopBucketTarget,
  artifact: ArtifactInventoryItem
): string | ReadonlyArray<ReadonlyArray<string>> | undefined => {
  if (target.bin !== undefined) {
    return target.bin
  }
  const binaryName = artifact.variant?.binaryName
  return binaryName === undefined
    ? undefined
    : [[catalogPathBaseName(artifact.path), binaryName]]
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
    const bin = artifactBin(target, validated.artifact)

    const manifest: ScoopManifest = {
      version: model.identity.version,
      description: target.description ?? `${model.identity.name} ${model.identity.version} release artifact`,
      homepage: target.homepage ?? `https://github.com/${target.repository}`,
      ...(target.license === undefined ? {} : { license: target.license }),
      url: artifactUrl(validated.artifact, target.url),
      hash: validated.checksum.value,
      ...(bin === undefined ? {} : { bin })
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
      path: target.manifestPath,
      contents: manifest
    }),
    dryRunOperation(target, dryRunSupport),
    ...catalogGitPublishOperations({
      id: `${target.id}:scoop-push`,
      targetId: target.id,
      description: `Push Scoop bucket update for ${model.identity.name}@${model.identity.version}.`,
      mutability: target.mutability,
      directory: target.bucketDirectory,
      filePath: target.manifestPath,
      commitMessage: `Update ${target.manifestName} to ${model.identity.version}`
    })
  ] satisfies ReadonlyArray<Operation>
})

export const ScoopAdapter: ScoopTargetAdapter = {
  targetTag: "ScoopBucketTarget",
  capabilities: scoopTargetCapabilities,
  planOperations: planScoopOperations
}
