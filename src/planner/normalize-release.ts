import * as Effect from "effect/Effect"
import { ArtifactInventoryItem, artifactInventoryOrder, Checksum } from "../domain/artifact.js"
import { CommandSpec } from "../domain/operation.js"
import { ReleaseIdentity, ReleaseIntent, ReleaseModel, SourceMetadata } from "../domain/release.js"
import { targetOrder } from "../domain/target.js"
import { ReleaseHost } from "../host/host.js"
import { ReleaseNormalizationError } from "./errors.js"

export type * from "../types/effect-internal.js"

const validateUnique = (
  values: ReadonlyArray<string>,
  field: string
): Effect.Effect<void, ReleaseNormalizationError> =>
  Effect.sync(() => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value)
      }
      seen.add(value)
    }
    return [...duplicates].sort()
  }).pipe(
    Effect.flatMap((duplicates) =>
      duplicates.length === 0
        ? Effect.void
        : Effect.fail(
          ReleaseNormalizationError.make({
            field,
            reason: `Duplicate values: ${duplicates.join(", ")}`
          })
        )
    )
  )

const validateSafeRelativePath = (
  field: string,
  value: string
): Effect.Effect<void, ReleaseNormalizationError> => {
  const isAbsolute = value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)
  const hasTraversal = value.split(/[\\/]+/).includes("..")
  if (!isAbsolute && !hasTraversal) {
    return Effect.void
  }
  return Effect.fail(
    ReleaseNormalizationError.make({
      field,
      reason: "Path must be relative and must not contain parent traversal."
    })
  )
}

const gitHeadCommand = (root: string): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: ["rev-parse", "--short", "HEAD"],
    cwd: root,
    requiredEnv: [],
    redactedEnv: []
  })

const resolveIdentityCommit = Effect.fn("resolveIdentityCommit")(function*(identity: ReleaseIdentity, root: string) {
  if (identity.commit !== "HEAD") {
    return identity
  }

  const host = yield* ReleaseHost
  const result = yield* host.runCommand(gitHeadCommand(root)).pipe(
    Effect.mapError((error) =>
      ReleaseNormalizationError.make({
        field: "identity.commit",
        reason: error.reason
      })
    )
  )
  const commit = result.stdout.trim()
  if (result.exitCode !== 0 || commit.length === 0) {
    return yield* Effect.fail(
      ReleaseNormalizationError.make({
        field: "identity.commit",
        reason: result.exitCode === 0
          ? "Git HEAD resolved to an empty commit."
          : "Unable to resolve Git HEAD."
      })
    )
  }

  return ReleaseIdentity.make({
    name: identity.name,
    version: identity.version,
    commit,
    ...(identity.tag === undefined ? {} : { tag: identity.tag }),
    ...(identity.notes === undefined ? {} : { notes: identity.notes })
  })
})

export const normalizeReleaseIntent = Effect.fn("normalizeReleaseIntent")(function*(
  intent: ReleaseIntent,
  root: string = ".",
  configPath: string | undefined = undefined
) {
  yield* validateUnique(intent.artifacts.map((artifact) => artifact.id), "artifacts.id")
  yield* validateUnique(intent.targets.map((target) => target.id), "targets.id")
  yield* validateSafeRelativePath("evidenceDirectory", intent.evidenceDirectory ?? ".release/evidence")
  for (const artifact of intent.artifacts) {
    yield* validateSafeRelativePath(`artifacts.${artifact.id}.path`, artifact.path)
  }
  for (const target of intent.targets) {
    if (target._tag === "NpmRegistryTarget") {
      yield* validateSafeRelativePath(`targets.${target.id}.packagePath`, target.packagePath)
      if (target.trustedPublishing === true && target.tokenEnv !== undefined) {
        return yield* Effect.fail(
          ReleaseNormalizationError.make({
            field: `targets.${target.id}.tokenEnv`,
            reason: "NPM trusted publishing uses CI OIDC and must not also declare tokenEnv."
          })
        )
      }
    }
    if (target._tag === "HomebrewTapTarget") {
      yield* validateSafeRelativePath(`targets.${target.id}.formulaPath`, target.formulaPath)
      if (target.tapDirectory !== undefined) {
        yield* validateSafeRelativePath(`targets.${target.id}.tapDirectory`, target.tapDirectory)
      }
    }
    if (target._tag === "ScoopBucketTarget") {
      yield* validateSafeRelativePath(`targets.${target.id}.manifestPath`, target.manifestPath)
      if (target.bucketDirectory !== undefined) {
        yield* validateSafeRelativePath(`targets.${target.id}.bucketDirectory`, target.bucketDirectory)
      }
    }
  }

  const host = yield* ReleaseHost
  const identity = yield* resolveIdentityCommit(intent.identity, root)
  const inventory: Array<ArtifactInventoryItem> = []

  for (const artifact of intent.artifacts) {
    const info = yield* host.stat(artifact.path).pipe(
      Effect.mapError((error) =>
        ReleaseNormalizationError.make({
          field: `artifacts.${artifact.id}.path`,
          reason: error.reason
        })
      )
    )
    if (artifact.format === "directory" && info.kind !== "directory") {
      return yield* Effect.fail(
        ReleaseNormalizationError.make({
          field: `artifacts.${artifact.id}.format`,
          reason: `Expected directory artifact at ${artifact.path}`
        })
      )
    }
    if (artifact.format !== "directory" && info.kind === "directory") {
      return yield* Effect.fail(
        ReleaseNormalizationError.make({
          field: `artifacts.${artifact.id}.format`,
          reason: `Expected file-like artifact at ${artifact.path}`
        })
      )
    }
    const checksum = artifact.checksum ?? (artifact.format === "directory"
      ? undefined
      : Checksum.make({
        algorithm: "sha256",
        value: yield* host.hashFile(artifact.path, "sha256").pipe(
          Effect.mapError((error) =>
            ReleaseNormalizationError.make({
              field: `artifacts.${artifact.id}.checksum`,
              reason: error.reason
            })
          )
        )
      }))
    inventory.push(
      ArtifactInventoryItem.make({
        id: artifact.id,
        path: artifact.path,
        format: artifact.format,
        consumers: [...artifact.consumers].sort(),
        sizeBytes: info.sizeBytes,
        ...(checksum === undefined ? {} : { checksum })
      })
    )
  }

  return ReleaseModel.make({
    identity,
    source: SourceMetadata.make({
      root,
      ...(configPath === undefined ? {} : { configPath })
    }),
    artifacts: inventory.sort(artifactInventoryOrder),
    targets: [...intent.targets].sort(targetOrder),
    strict: intent.strict ?? true,
    evidenceDirectory: intent.evidenceDirectory ?? ".release/evidence"
  })
})
