import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import {
  ArtifactIntent,
  ArtifactRecipe,
  BunExecutableArtifactRecipe,
  artifactInventoryOrder
} from "../domain/artifact.js"
import { CommandSpec } from "../domain/operation.js"
import {
  PackageManifestReleaseIdentitySource,
  ReleaseIdentity,
  ReleaseIdentitySource,
  ReleaseIntent,
  ReleaseModel,
  ReleasePackageManifest,
  SourceMetadata,
  StaticReleaseIdentitySource
} from "../domain/release.js"
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

export const validateNonEmptySafeRelativePath = (
  field: string,
  value: string
): Effect.Effect<void, ReleaseNormalizationError> => {
  const isEmpty = value.trim().length === 0
  const isAbsolute = value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)
  const hasTraversal = value.split(/[\\/]+/).includes("..")
  if (!isEmpty && !isAbsolute && !hasTraversal) {
    return Effect.void
  }
  return Effect.fail(
    ReleaseNormalizationError.make({
      field,
      reason: "Path must be non-empty, relative, and must not contain parent traversal."
    })
  )
}

export const normalizedArtifactPackageName = (name: string): string => {
  const withoutScopePrefix = name.startsWith("@") ? name.slice(1) : name
  return withoutScopePrefix.replaceAll("/", "-")
}

export const renderReleaseTemplate = (value: string, identity: ReleaseIdentity): string =>
  value
    .split("{version}").join(identity.version)
    .split("{name}").join(identity.name)
    .split("{normalizedName}").join(normalizedArtifactPackageName(identity.name))

export const renderReleaseVersionTemplate = (value: string, version: string): string =>
  value.split("{version}").join(version)

const templateField = (field: string, value: string): Effect.Effect<void, ReleaseNormalizationError> => {
  if (value.includes("{name}") || value.includes("{normalizedName}")) {
    return Effect.fail(
      ReleaseNormalizationError.make({
        field,
        reason: "Only the {version} placeholder is supported here."
      })
    )
  }
  return Effect.void
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

export const resolveIdentityCommit = Effect.fn("resolveIdentityCommit")(function*(identity: ReleaseIdentity, root: string) {
  if (identity.commit !== "HEAD") {
    return identity
  }

  const commandRunner = yield* ReleaseCommandRunner
  const result = yield* commandRunner.runCommand(gitHeadCommand(root)).pipe(
    Effect.mapError((error) =>
      ReleaseNormalizationError.make({
        field: "identity.commit",
        reason: error.reason,
        cause: error
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

const decodePackageManifest = Schema.decodeUnknownEffect(ReleasePackageManifest)

export const readReleasePackageManifest = Effect.fn("readReleasePackageManifest")(function*(
  root: string,
  packagePath: string,
  field: string
) {
  yield* validateNonEmptySafeRelativePath(field, packagePath)
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const readPath = path.resolve(root, packagePath)
  const contents = yield* fs.readFileString(readPath).pipe(
    Effect.mapError((error) =>
      ReleaseNormalizationError.make({
        field,
        reason: error.message,
        cause: error
      })
    )
  )
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) =>
      ReleaseNormalizationError.make({
        field,
        reason: "Package manifest is not valid JSON.",
        cause
      })
  })
  return yield* decodePackageManifest(parsed).pipe(
    Effect.mapError((error) =>
      ReleaseNormalizationError.make({
        field,
        reason: `Package manifest must include name and version: ${error.message}`
      })
    )
  )
})

const releaseIdentityFromStaticSource = (source: StaticReleaseIdentitySource): ReleaseIdentity =>
  ReleaseIdentity.make({
    name: source.name,
    version: source.version,
    commit: source.commit,
    ...(source.tag === undefined ? {} : { tag: source.tag }),
    ...(source.notes === undefined ? {} : { notes: source.notes })
  })

const releaseIdentityFromManifestSource = Effect.fn("releaseIdentityFromManifestSource")(function*(
  source: PackageManifestReleaseIdentitySource,
  root: string
) {
  const manifest = yield* readReleasePackageManifest(root, source.packagePath ?? "package.json", "identity.packagePath")
  const tagTemplate = source.tagTemplate ?? "v{version}"
  yield* templateField("identity.tagTemplate", tagTemplate)
  return ReleaseIdentity.make({
    name: manifest.name,
    version: manifest.version,
    commit: source.commit,
    tag: renderReleaseVersionTemplate(tagTemplate, manifest.version),
    ...(source.notes === undefined ? {} : { notes: source.notes })
  })
})

export const resolveReleaseIdentitySource = Effect.fn("resolveReleaseIdentitySource")(function*(
  source: ReleaseIdentitySource,
  root: string
) {
  const identity = source instanceof PackageManifestReleaseIdentitySource
    ? yield* releaseIdentityFromManifestSource(source, root)
    : releaseIdentityFromStaticSource(source)
  return yield* resolveIdentityCommit(identity, root)
})

const expandArtifactIntent = (
  artifact: ArtifactIntent,
  identity: ReleaseIdentity
): ArtifactIntent =>
  ArtifactIntent.make({
    id: artifact.id,
    path: renderReleaseTemplate(artifact.path, identity),
    format: artifact.format,
    consumers: [...artifact.consumers],
    ...(artifact.checksum === undefined ? {} : { checksum: artifact.checksum })
  })

export const artifactIntentsFromRecipe = (
  recipe: ArtifactRecipe,
  identity: ReleaseIdentity
): ReadonlyArray<ArtifactIntent> => {
  if (recipe instanceof BunExecutableArtifactRecipe) {
    return recipe.outputs.map((output) =>
      ArtifactIntent.make({
        id: output.id,
        path: renderReleaseTemplate(output.path, identity),
        format: "file",
        consumers: [...output.consumers]
      })
    )
  }
  return []
}

export const artifactIntentsFromRecipes = (
  recipes: ReadonlyArray<ArtifactRecipe>,
  identity: ReleaseIdentity
): ReadonlyArray<ArtifactIntent> =>
  recipes.flatMap((recipe) => artifactIntentsFromRecipe(recipe, identity))

export const normalizeReleaseIntent = Effect.fn("normalizeReleaseIntent")(function*(
  intent: ReleaseIntent,
  root: string = ".",
  configPath: string | undefined = undefined
) {
  const artifactRecipes = intent.artifactRecipes ?? []
  yield* validateUnique(artifactRecipes.map((recipe) => recipe.id), "artifactRecipes.id")
  yield* validateUnique(intent.targets.map((target) => target.id), "targets.id")

  const identity = yield* resolveReleaseIdentitySource(intent.identity, root)
  for (const recipe of artifactRecipes) {
    if (recipe instanceof BunExecutableArtifactRecipe) {
      yield* validateNonEmptySafeRelativePath(`artifactRecipes.${recipe.id}.entrypoint`, recipe.entrypoint)
      yield* validateUnique(
        recipe.outputs.map((output) => output.id),
        `artifactRecipes.${recipe.id}.outputs.id`
      )
      for (const output of recipe.outputs) {
        const outputPath = renderReleaseTemplate(output.path, identity)
        yield* validateNonEmptySafeRelativePath(
          `artifactRecipes.${recipe.id}.outputs.${output.id}.path`,
          outputPath
        )
      }
    }
  }

  const artifacts = [
    ...intent.artifacts.map((artifact) => expandArtifactIntent(artifact, identity)),
    ...artifactIntentsFromRecipes(artifactRecipes, identity)
  ]
  yield* validateUnique(artifacts.map((artifact) => artifact.id), "artifacts.id")

  for (const artifact of artifacts) {
    yield* validateNonEmptySafeRelativePath(`artifacts.${artifact.id}.path`, artifact.path)
  }
  for (const target of intent.targets) {
    if (target._tag === "NpmRegistryTarget") {
      yield* validateNonEmptyString(`targets.${target.id}.packageName`, target.packageName)
      yield* validateNonEmptySafeRelativePath(`targets.${target.id}.packagePath`, target.packagePath)
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
      yield* validateNonEmptySafeRelativePath(`targets.${target.id}.formulaPath`, target.formulaPath)
      if (target.tapDirectory !== undefined) {
        yield* validateNonEmptySafeRelativePath(`targets.${target.id}.tapDirectory`, target.tapDirectory)
      }
    }
    if (target._tag === "ScoopBucketTarget") {
      yield* validateNonEmptySafeRelativePath(`targets.${target.id}.manifestPath`, target.manifestPath)
      if (target.bucketDirectory !== undefined) {
        yield* validateNonEmptySafeRelativePath(`targets.${target.id}.bucketDirectory`, target.bucketDirectory)
      }
    }
  }

  const evidenceDirectory = renderReleaseVersionTemplate(
    intent.evidenceDirectory ?? ".release/evidence",
    identity.version
  )
  yield* validateNonEmptySafeRelativePath("evidenceDirectory", evidenceDirectory)
  const inventory = yield* Effect.forEach(artifacts, (artifact) => inventoryArtifact(root, artifact))

  return ReleaseModel.make({
    identity,
    source: SourceMetadata.make({
      root,
      ...(configPath === undefined ? {} : { configPath })
    }),
    artifacts: inventory.sort(artifactInventoryOrder),
    targets: [...intent.targets].sort(targetOrder),
    strict: intent.strict ?? true,
    evidenceDirectory
  })
})
