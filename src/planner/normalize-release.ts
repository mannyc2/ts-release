import * as Effect from "effect/Effect"
import { artifactInventoryOrder } from "../domain/artifact.js"
import { CommandSpec } from "../domain/operation.js"
import { ReleaseIdentity, ReleaseIntent, ReleaseModel, SourceMetadata } from "../domain/release.js"
import { targetOrder } from "../domain/target.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { inventoryArtifact } from "./artifact-inventory.js"
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

const validateWorkflowFileName = (
  field: string,
  value: string
): Effect.Effect<void, ReleaseNormalizationError> => {
  const hasPathSeparator = value.includes("/") || value.includes("\\")
  const hasWorkflowExtension = value.endsWith(".yml") || value.endsWith(".yaml")
  if (value.length > 0 && !hasPathSeparator && hasWorkflowExtension) {
    return Effect.void
  }
  return Effect.fail(
    ReleaseNormalizationError.make({
      field,
      reason: "Workflow must be a .yml or .yaml filename without path separators."
    })
  )
}

const validateNonEmptyString = (
  field: string,
  value: string
): Effect.Effect<void, ReleaseNormalizationError> => {
  if (value.trim().length > 0) {
    return Effect.void
  }
  return Effect.fail(
    ReleaseNormalizationError.make({
      field,
      reason: "Value must not be empty."
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

  const commandRunner = yield* ReleaseCommandRunner
  const result = yield* commandRunner.runCommand(gitHeadCommand(root)).pipe(
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
      yield* validateNonEmptyString(`targets.${target.id}.packageName`, target.packageName)
      yield* validateSafeRelativePath(`targets.${target.id}.packagePath`, target.packagePath)
      if (target.trustedPublishing !== undefined && target.tokenEnv !== undefined) {
        return yield* Effect.fail(
          ReleaseNormalizationError.make({
            field: `targets.${target.id}.tokenEnv`,
            reason: "NPM trusted publishing uses CI OIDC and must not also declare tokenEnv."
          })
        )
      }
      if (target.trustedPublishing !== undefined) {
        yield* validateWorkflowFileName(
          `targets.${target.id}.trustedPublishing.workflow`,
          target.trustedPublishing.workflow
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

  const identity = yield* resolveIdentityCommit(intent.identity, root)
  const inventory = yield* Effect.forEach(intent.artifacts, (artifact) => inventoryArtifact(root, artifact))

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
