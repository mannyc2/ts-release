import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import {
  ArtifactIntent,
  ArtifactRecipe,
  BunExecutableCompileTarget,
  BunExecutableArtifactRecipe,
  BunExecutableArtifactOutput,
  InstallableArtifactVariant,
  InstallableArtifactVariantOverride,
  PyPiWheelArtifactRecipe,
  artifactInventoryOrder,
  bunExecutableCompileTargetVariant,
  bunExecutableOutputVariant
} from "../domain/artifact.js"
import { CommandSpec } from "../domain/operation.js"
import {
  PackageManifestReleaseIdentitySource,
  ReleaseConfigBunExecutableBuild,
  ReleaseConfigBunExecutableOutput,
  ReleaseConfigGitHubPublish,
  ReleaseConfigHomebrewPublish,
  ReleaseConfigManualArtifact,
  ReleaseConfigNpmPackageBuild,
  ReleaseConfigNpmPublish,
  ReleaseConfigNpmTrustedPublishing,
  ReleaseConfigProject,
  ReleaseConfigPyPiPublish,
  ReleaseConfigPyPiTrustedPublishing,
  ReleaseConfigPyPiWheelBuild,
  ReleaseConfigScoopPublish,
  ReleaseIdentity,
  ReleaseIdentitySource,
  ReleaseIntent,
  ReleaseModel,
  ReleasePackageManifest,
  SourceMetadata,
  StaticReleaseIdentitySource
} from "../domain/release.js"
import {
  GitHubReleaseTarget,
  HomebrewTapTarget,
  NpmRegistryTarget,
  NpmTrustedPublishingConfig,
  PyPiRegistryTarget,
  PyPiTrustedPublishingConfig,
  ScoopBucketTarget,
  TargetConfig,
  targetOrder
} from "../domain/target.js"
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

const requireCompactString = (
  field: string,
  value: string | undefined,
  reason: string
): Effect.Effect<string, ReleaseNormalizationError> => {
  if (value !== undefined && value.trim().length > 0) {
    return Effect.succeed(value)
  }
  return Effect.fail(
    ReleaseNormalizationError.make({
      field,
      reason
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

const projectPackageName = (project: ReleaseConfigProject): string | undefined =>
  project.packageName ?? project.package ?? project.name

const projectManifestPath = (project: ReleaseConfigProject): string | undefined => {
  const packagePath = project.packagePath
  if (packagePath === undefined || packagePath.endsWith("package.json")) {
    return packagePath
  }
  return `${packagePath.replace(/[/\\]+$/, "")}/package.json`
}

const releaseIdentitySourceFromConfig = Effect.fn("releaseIdentitySourceFromConfig")(function*(
  project: ReleaseConfigProject
) {
  const commit = project.commit ?? "HEAD"
  if (project.version !== undefined) {
    const name = yield* requireCompactString(
      "project.name",
      project.name ?? projectPackageName(project),
      "Static project identity requires project.name or project.packageName."
    )
    const tagTemplate = project.tagTemplate ?? "v{version}"
    yield* templateField("project.tagTemplate", tagTemplate)
    return StaticReleaseIdentitySource.make({
      name,
      version: project.version,
      commit,
      tag: project.tag ?? renderReleaseVersionTemplate(tagTemplate, project.version),
      ...(project.notes === undefined ? {} : { notes: project.notes })
    })
  }

  const manifestPath = projectManifestPath(project)
  return PackageManifestReleaseIdentitySource.make({
    ...(manifestPath === undefined ? {} : { packagePath: manifestPath }),
    commit,
    tagTemplate: project.tagTemplate ?? "v{version}",
    ...(project.notes === undefined ? {} : { notes: project.notes })
  })
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
    ...(artifact.downloadUrl === undefined ? {} : { downloadUrl: renderReleaseTemplate(artifact.downloadUrl, identity) }),
    format: artifact.format,
    consumers: [...artifact.consumers],
    ...(artifact.checksum === undefined ? {} : { checksum: artifact.checksum }),
    ...(artifact.variant === undefined ? {} : { variant: artifact.variant })
  })

const validateInstallableArtifactVariant = (
  field: string,
  variant: InstallableArtifactVariant
): Effect.Effect<void, ReleaseNormalizationError> => {
  if (variant.libc !== undefined && variant.os !== "linux") {
    return Effect.fail(
      ReleaseNormalizationError.make({
        field: `${field}.libc`,
        reason: "libc may only be set for linux artifact variants."
      })
    )
  }
  return Effect.void
}

const validateBunExecutableOutputVariant = (
  field: string,
  output: BunExecutableArtifactOutput
): Effect.Effect<void, ReleaseNormalizationError> => {
  const derived = bunExecutableCompileTargetVariant(output.target)
  const override = output.variant
  if (override?.os !== undefined && override.os !== derived.os) {
    return Effect.fail(
      ReleaseNormalizationError.make({
        field: `${field}.os`,
        reason: `Variant os must match Bun compile target ${output.target}.`
      })
    )
  }
  if (override?.arch !== undefined && override.arch !== derived.arch) {
    return Effect.fail(
      ReleaseNormalizationError.make({
        field: `${field}.arch`,
        reason: `Variant arch must match Bun compile target ${output.target}.`
      })
    )
  }
  if (override?.libc !== undefined && override.libc !== derived.libc) {
    return Effect.fail(
      ReleaseNormalizationError.make({
        field: `${field}.libc`,
        reason: `Variant libc must match Bun compile target ${output.target}.`
      })
    )
  }
  if (override?.targetTriple !== undefined && override.targetTriple !== derived.targetTriple) {
    return Effect.fail(
      ReleaseNormalizationError.make({
        field: `${field}.targetTriple`,
        reason: `Variant targetTriple must match Bun compile target ${output.target}.`
      })
    )
  }
  return validateInstallableArtifactVariant(field, bunExecutableOutputVariant(output.target, output.variant))
}

export const artifactIntentsFromRecipe = (
  recipe: ArtifactRecipe,
  identity: ReleaseIdentity
): ReadonlyArray<ArtifactIntent> => {
  if (recipe instanceof BunExecutableArtifactRecipe) {
    return recipe.outputs.map((output) =>
      ArtifactIntent.make({
        id: output.id,
        path: renderReleaseTemplate(output.path, identity),
        ...(output.downloadUrl === undefined ? {} : { downloadUrl: renderReleaseTemplate(output.downloadUrl, identity) }),
        format: "executable",
        consumers: [...output.consumers],
        variant: bunExecutableOutputVariant(output.target, output.variant)
      })
    )
  }
  if (recipe instanceof PyPiWheelArtifactRecipe) {
    return [
      ArtifactIntent.make({
        id: recipe.id,
        path: renderReleaseTemplate(recipe.path, identity),
        format: "file",
        consumers: [...recipe.consumers]
      })
    ]
  }
  return []
}

export const artifactIntentsFromRecipes = (
  recipes: ReadonlyArray<ArtifactRecipe>,
  identity: ReleaseIdentity
): ReadonlyArray<ArtifactIntent> =>
  recipes.flatMap((recipe) => artifactIntentsFromRecipe(recipe, identity))

const compactPackageShortName = (packageName: string): string => {
  const withoutScope = packageName.includes("/") ? packageName.split("/").at(-1) ?? packageName : packageName
  const normalized = withoutScope.replace(/^@/, "").replace(/[^A-Za-z0-9-]+/g, "-")
  return normalized.length === 0 ? "release" : normalized
}

const compactNpmPackageArtifact = (
  config: boolean | ReleaseConfigNpmPackageBuild | undefined,
  project: ReleaseConfigProject
): ArtifactIntent | undefined => {
  if (config === undefined || config === false) {
    return undefined
  }
  const packageConfig = config === true ? undefined : config
  return ArtifactIntent.make({
    id: packageConfig?.id ?? "npm-package",
    path: packageConfig?.path ?? project.packagePath ?? ".",
    format: "directory",
    consumers: [...(packageConfig?.consumers ?? ["npm"])]
  })
}

const compactManualArtifact = (artifact: ReleaseConfigManualArtifact): ArtifactIntent =>
  ArtifactIntent.make({
    id: artifact.id,
    path: artifact.path,
    ...(artifact.downloadUrl === undefined ? {} : { downloadUrl: artifact.downloadUrl }),
    format: artifact.format,
    consumers: [...artifact.consumers],
    ...(artifact.checksum === undefined ? {} : { checksum: artifact.checksum }),
    ...(artifact.variant === undefined ? {} : { variant: artifact.variant })
  })

const defaultBunExecutableTargets: ReadonlyArray<BunExecutableCompileTarget> = [
  "bun-linux-x64-baseline",
  "bun-linux-arm64",
  "bun-darwin-x64",
  "bun-darwin-arm64",
  "bun-windows-x64-baseline"
]

const bunExecutableTargetSuffix = (target: BunExecutableCompileTarget): string => {
  const withoutPrefix = target.startsWith("bun-") ? target.slice("bun-".length) : target
  return withoutPrefix
    .replace("-baseline", "")
    .replace("-modern", "")
}

const bunExecutableTargetPath = (
  target: BunExecutableCompileTarget,
  outDir: string,
  name: string
): string => {
  const suffix = bunExecutableTargetSuffix(target)
  const extension = suffix.startsWith("windows-") ? ".exe" : ""
  return `${outDir.replace(/[/\\]+$/, "")}/${name}-{version}-${suffix}${extension}`
}

const compactBunExecutableVariant = (
  build: ReleaseConfigBunExecutableBuild,
  output: ReleaseConfigBunExecutableOutput | undefined
): InstallableArtifactVariantOverride | undefined => {
  if (output?.variant !== undefined) {
    return output.variant
  }
  if (build.binaryName === undefined && build.installPath === undefined) {
    return undefined
  }
  return InstallableArtifactVariantOverride.make({
    ...(build.binaryName === undefined ? {} : { binaryName: build.binaryName }),
    ...(build.installPath === undefined ? {} : { installPath: build.installPath })
  })
}

const compactBunExecutableOutput = (
  build: ReleaseConfigBunExecutableBuild,
  output: ReleaseConfigBunExecutableOutput | undefined,
  target: BunExecutableCompileTarget,
  name: string
): BunExecutableArtifactOutput => {
  const recipeId = build.id ?? "cli"
  const suffix = bunExecutableTargetSuffix(target)
  const variant = compactBunExecutableVariant(build, output)
  return BunExecutableArtifactOutput.make({
    id: output?.id ?? `${recipeId}-${suffix}`,
    target,
    path: output?.path ?? bunExecutableTargetPath(target, build.outDir ?? ".release/artifacts", name),
    ...(output?.downloadUrl === undefined ? {} : { downloadUrl: output.downloadUrl }),
    consumers: [...(output?.consumers ?? build.consumers ?? ["github"])],
    ...(variant === undefined ? {} : { variant })
  })
}

const compactBunExecutableRecipe = (
  build: ReleaseConfigBunExecutableBuild,
  identity: ReleaseIdentity
): BunExecutableArtifactRecipe => {
  const name = build.name ?? compactPackageShortName(identity.name)
  const outputs = build.outputs === undefined
    ? (build.targets ?? defaultBunExecutableTargets).map((target) =>
      compactBunExecutableOutput(build, undefined, target, name)
    )
    : build.outputs.map((output) => compactBunExecutableOutput(build, output, output.target, name))
  return BunExecutableArtifactRecipe.make({
    id: build.id ?? "cli",
    entrypoint: build.entry,
    outputs,
    ...(build.minify === undefined ? {} : { minify: build.minify })
  })
}

const compactPyPiWheelRecipes = (
  config: ReleaseConfigPyPiWheelBuild | ReadonlyArray<ReleaseConfigPyPiWheelBuild> | undefined
): ReadonlyArray<PyPiWheelArtifactRecipe> => {
  if (config === undefined) {
    return []
  }
  const wheels = Array.isArray(config) ? config : [config]
  return wheels.map((wheel) =>
    PyPiWheelArtifactRecipe.make({
      id: wheel.id,
      path: wheel.path,
      wheelTag: wheel.wheelTag,
      packageName: wheel.packageName,
      moduleName: wheel.moduleName,
      consoleScript: wheel.consoleScript,
      summary: wheel.summary,
      homepage: wheel.homepage,
      license: wheel.license,
      requiresPython: wheel.requiresPython,
      binaries: [...wheel.binaries],
      consumers: [...(wheel.consumers ?? ["pypi"])]
    })
  )
}

const compactArtifacts = (
  intent: ReleaseIntent
): ReadonlyArray<ArtifactIntent> => {
  const npmPackage = compactNpmPackageArtifact(intent.build?.npmPackage, intent.project)
  return [
    ...(npmPackage === undefined ? [] : [npmPackage]),
    ...(intent.build?.artifacts ?? []).map(compactManualArtifact)
  ]
}

const compactArtifactRecipes = (
  intent: ReleaseIntent,
  identity: ReleaseIdentity
): ReadonlyArray<ArtifactRecipe> => [
  ...(intent.build?.bun === undefined ? [] : [compactBunExecutableRecipe(intent.build.bun, identity)]),
  ...compactPyPiWheelRecipes(intent.build?.pypiWheel)
]

const compactNpmTrustedPublishing = (
  config: boolean | ReleaseConfigNpmTrustedPublishing | undefined
): NpmTrustedPublishingConfig | undefined => {
  if (config === undefined || config === false) {
    return undefined
  }
  if (config === true) {
    return NpmTrustedPublishingConfig.make({
      provider: "github-actions",
      workflow: "release.yml",
      packageExists: true
    })
  }
  return NpmTrustedPublishingConfig.make({
    provider: config.provider ?? "github-actions",
    workflow: config.workflow ?? "release.yml",
    packageExists: true,
    ...(config.verifyPackageExists === undefined ? {} : { verifyPackageExists: config.verifyPackageExists })
  })
}

const compactPyPiTrustedPublishing = (
  config: boolean | ReleaseConfigPyPiTrustedPublishing | undefined
): PyPiTrustedPublishingConfig | undefined => {
  if (config === undefined || config === false) {
    return undefined
  }
  if (config === true) {
    return PyPiTrustedPublishingConfig.make({
      provider: "github-actions",
      workflow: "release.yml",
      publisherConfigured: true
    })
  }
  return PyPiTrustedPublishingConfig.make({
    provider: config.provider ?? "github-actions",
    workflow: config.workflow ?? "release.yml",
    publisherConfigured: true
  })
}

const compactNpmTarget = Effect.fn("compactNpmTarget")(function*(
  project: ReleaseConfigProject,
  identity: ReleaseIdentity,
  config: true | ReleaseConfigNpmPublish
) {
  const publish = config === true ? ReleaseConfigNpmPublish.make({}) : config
  const trustedPublishing = compactNpmTrustedPublishing(publish.trustedPublishing)
  const packageName = yield* requireCompactString(
    "publish.npm.packageName",
    publish.packageName ?? projectPackageName(project) ?? identity.name,
    "NPM publishing requires a package name."
  )
  return NpmRegistryTarget.make({
    id: "npm",
    registry: publish.registry ?? "https://registry.npmjs.org",
    packageName,
    packagePath: publish.packagePath ?? project.packagePath ?? ".",
    ...(publish.tokenEnv === undefined ? {} : { tokenEnv: publish.tokenEnv }),
    ...(trustedPublishing === undefined ? {} : { trustedPublishing }),
    ...(publish.access === undefined ? {} : { access: publish.access }),
    ...(publish.provenance === undefined ? {} : { provenance: publish.provenance }),
    dryRunSupport: "native",
    mutability: "immutable",
    recovery: "publish-new-version"
  })
})

const compactGitHubTarget = Effect.fn("compactGitHubTarget")(function*(
  project: ReleaseConfigProject,
  config: true | ReleaseConfigGitHubPublish
) {
  const publish = config === true ? ReleaseConfigGitHubPublish.make({}) : config
  const repository = yield* requireCompactString(
    "publish.github.repository",
    publish.repository ?? project.repository,
    "GitHub publishing requires publish.github.repository or project.repository."
  )
  return GitHubReleaseTarget.make({
    id: "github",
    repository,
    ...(publish.tokenEnv === undefined ? {} : { tokenEnv: publish.tokenEnv }),
    draft: publish.draft ?? true,
    prerelease: publish.prerelease ?? false,
    dryRunSupport: "simulated",
    mutability: "mutable-release",
    recovery: "delete-and-recreate"
  })
})

const firstArtifactConsumerId = (
  artifacts: ReadonlyArray<ArtifactIntent>,
  consumer: string,
  fallback: string
): string =>
  artifacts.find((artifact) => artifact.consumers.includes(consumer))?.id ?? fallback

const compactHomebrewTarget = (
  project: ReleaseConfigProject,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<ArtifactIntent>,
  publish: ReleaseConfigHomebrewPublish
): HomebrewTapTarget => {
  const name = publish.formulaName ?? compactPackageShortName(projectPackageName(project) ?? identity.name)
  const artifactId = publish.artifactId ?? firstArtifactConsumerId(artifacts, "homebrew", "archive")
  return HomebrewTapTarget.make({
    id: "homebrew",
    repository: publish.repository,
    formulaName: name,
    formulaPath: publish.formulaPath ?? `.release/generated/${name}.rb`,
    artifactId,
    ...(publish.artifactIds === undefined ? {} : { artifactIds: [...publish.artifactIds] }),
    ...(publish.homepage === undefined ? {} : { homepage: publish.homepage }),
    ...(publish.description === undefined ? {} : { description: publish.description }),
    ...(publish.url === undefined ? {} : { url: publish.url }),
    ...(publish.tapDirectory === undefined ? {} : { tapDirectory: publish.tapDirectory }),
    ...(publish.installPath === undefined ? {} : { installPath: publish.installPath }),
    ...(publish.tokenEnv === undefined ? {} : { tokenEnv: publish.tokenEnv }),
    dryRunSupport: "simulated",
    mutability: "mutable-index",
    recovery: "manual"
  })
}

const compactScoopTarget = (
  project: ReleaseConfigProject,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<ArtifactIntent>,
  publish: ReleaseConfigScoopPublish
): ScoopBucketTarget => {
  const name = publish.manifestName ?? compactPackageShortName(projectPackageName(project) ?? identity.name)
  return ScoopBucketTarget.make({
    id: "scoop",
    repository: publish.repository,
    manifestName: name,
    manifestPath: publish.manifestPath ?? `.release/generated/${name}.json`,
    artifactId: publish.artifactId ?? firstArtifactConsumerId(artifacts, "scoop", "archive"),
    ...(publish.homepage === undefined ? {} : { homepage: publish.homepage }),
    ...(publish.description === undefined ? {} : { description: publish.description }),
    ...(publish.license === undefined ? {} : { license: publish.license }),
    ...(publish.url === undefined ? {} : { url: publish.url }),
    ...(publish.bin === undefined ? {} : { bin: publish.bin }),
    ...(publish.bucketDirectory === undefined ? {} : { bucketDirectory: publish.bucketDirectory }),
    ...(publish.tokenEnv === undefined ? {} : { tokenEnv: publish.tokenEnv }),
    dryRunSupport: "simulated",
    mutability: "mutable-index",
    recovery: "manual"
  })
}

const compactPyPiTarget = (
  config: true | ReleaseConfigPyPiPublish
): PyPiRegistryTarget => {
  const publish = config === true ? ReleaseConfigPyPiPublish.make({}) : config
  const trustedPublishing = compactPyPiTrustedPublishing(publish.trustedPublishing)
  return PyPiRegistryTarget.make({
    id: "pypi",
    repositoryUrl: publish.repositoryUrl ?? "https://upload.pypi.org/legacy/",
    ...(publish.pythonExecutable === undefined ? {} : { pythonExecutable: publish.pythonExecutable }),
    ...(publish.usernameEnv === undefined ? {} : { usernameEnv: publish.usernameEnv }),
    ...(publish.passwordEnv === undefined ? {} : { passwordEnv: publish.passwordEnv }),
    ...(trustedPublishing === undefined ? {} : { trustedPublishing }),
    dryRunSupport: "native",
    mutability: "immutable",
    recovery: "publish-new-version"
  })
}

const compactTargets = Effect.fn("compactTargets")(function*(
  intent: ReleaseIntent,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<ArtifactIntent>
) {
  const targets: Array<TargetConfig> = []
  if (intent.publish.npm !== undefined && intent.publish.npm !== false) {
    targets.push(yield* compactNpmTarget(intent.project, identity, intent.publish.npm))
  }
  if (intent.publish.github !== undefined && intent.publish.github !== false) {
    targets.push(yield* compactGitHubTarget(intent.project, intent.publish.github))
  }
  if (intent.publish.homebrew !== undefined) {
    targets.push(compactHomebrewTarget(intent.project, identity, artifacts, intent.publish.homebrew))
  }
  if (intent.publish.scoop !== undefined) {
    targets.push(compactScoopTarget(intent.project, identity, artifacts, intent.publish.scoop))
  }
  if (intent.publish.pypi !== undefined && intent.publish.pypi !== false) {
    targets.push(compactPyPiTarget(intent.publish.pypi))
  }
  return targets
})

export const resolveReleaseBuild = Effect.fn("resolveReleaseBuild")(function*(
  intent: ReleaseIntent,
  root: string = "."
) {
  const identitySource = yield* releaseIdentitySourceFromConfig(intent.project)
  const identity = yield* resolveReleaseIdentitySource(identitySource, root)
  return {
    identity,
    artifactInputs: compactArtifacts(intent),
    artifactRecipes: compactArtifactRecipes(intent, identity)
  }
})

export const resolveReleasePlanningInputs = Effect.fn("resolveReleasePlanningInputs")(function*(
  intent: ReleaseIntent,
  root: string = "."
) {
  const build = yield* resolveReleaseBuild(intent, root)
  const targets = yield* compactTargets(intent, build.identity, build.artifactInputs)
  return {
    ...build,
    targets
  }
})

export const normalizeReleaseIntent = Effect.fn("normalizeReleaseIntent")(function*(
  intent: ReleaseIntent,
  root: string = ".",
  configPath: string | undefined = undefined
) {
  const inputs = yield* resolveReleasePlanningInputs(intent, root)
  const identity = inputs.identity
  const artifactRecipes = inputs.artifactRecipes
  const artifactInputs = inputs.artifactInputs
  const targetInputs = inputs.targets
  yield* validateUnique(artifactRecipes.map((recipe) => recipe.id), "artifactRecipes.id")
  yield* validateUnique(targetInputs.map((target) => target.id), "targets.id")

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
        if (output.downloadUrl !== undefined) {
          yield* validateNonEmptyString(
            `artifactRecipes.${recipe.id}.outputs.${output.id}.downloadUrl`,
            renderReleaseTemplate(output.downloadUrl, identity)
          )
        }
        yield* validateBunExecutableOutputVariant(
          `artifactRecipes.${recipe.id}.outputs.${output.id}.variant`,
          output
        )
      }
    }
    if (recipe instanceof PyPiWheelArtifactRecipe) {
      yield* validateNonEmptySafeRelativePath(
        `artifactRecipes.${recipe.id}.path`,
        renderReleaseTemplate(recipe.path, identity)
      )
      yield* validateNonEmptyString(`artifactRecipes.${recipe.id}.wheelTag`, recipe.wheelTag)
      yield* validateNonEmptyString(`artifactRecipes.${recipe.id}.packageName`, recipe.packageName)
      yield* validateNonEmptyString(`artifactRecipes.${recipe.id}.moduleName`, recipe.moduleName)
      yield* validateNonEmptyString(`artifactRecipes.${recipe.id}.consoleScript`, recipe.consoleScript)
      yield* validateNonEmptyString(`artifactRecipes.${recipe.id}.summary`, recipe.summary)
      yield* validateNonEmptyString(`artifactRecipes.${recipe.id}.homepage`, recipe.homepage)
      yield* validateNonEmptyString(`artifactRecipes.${recipe.id}.license`, recipe.license)
      yield* validateNonEmptyString(`artifactRecipes.${recipe.id}.requiresPython`, recipe.requiresPython)
      for (const [index, binary] of recipe.binaries.entries()) {
        yield* validateNonEmptySafeRelativePath(
          `artifactRecipes.${recipe.id}.binaries.${index}.sourcePath`,
          renderReleaseTemplate(binary.sourcePath, identity)
        )
        yield* validateNonEmptySafeRelativePath(
          `artifactRecipes.${recipe.id}.binaries.${index}.wheelPath`,
          binary.wheelPath
        )
      }
    }
  }

  const artifacts = [
    ...artifactInputs.map((artifact) => expandArtifactIntent(artifact, identity)),
    ...artifactIntentsFromRecipes(artifactRecipes, identity)
  ]
  yield* validateUnique(artifacts.map((artifact) => artifact.id), "artifacts.id")

  for (const artifact of artifacts) {
    yield* validateNonEmptySafeRelativePath(`artifacts.${artifact.id}.path`, artifact.path)
    if (artifact.downloadUrl !== undefined) {
      yield* validateNonEmptyString(`artifacts.${artifact.id}.downloadUrl`, artifact.downloadUrl)
    }
    if (artifact.variant !== undefined) {
      yield* validateInstallableArtifactVariant(`artifacts.${artifact.id}.variant`, artifact.variant)
    }
  }
  for (const target of targetInputs) {
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
      if (target.description !== undefined) {
        yield* validateNonEmptyString(`targets.${target.id}.description`, target.description)
      }
      if (target.artifactIds !== undefined) {
        yield* validateUnique(target.artifactIds, `targets.${target.id}.artifactIds`)
        if (target.artifactIds.length === 0) {
          yield* Effect.fail(
            ReleaseNormalizationError.make({
              field: `targets.${target.id}.artifactIds`,
              reason: "Homebrew artifactIds must not be empty."
            })
          )
        }
      }
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
    if (target._tag === "PyPiRegistryTarget") {
      if (target.pythonExecutable !== undefined) {
        yield* validateNonEmptyString(`targets.${target.id}.pythonExecutable`, target.pythonExecutable)
      }
      if (target.trustedPublishing !== undefined) {
        yield* validateWorkflowFileName(
          `targets.${target.id}.trustedPublishing.workflow`,
          target.trustedPublishing.workflow
        )
      }
    }
  }

  const evidenceDirectory = renderReleaseVersionTemplate(
    typeof intent.evidence === "string" ? intent.evidence : intent.evidence?.directory ?? ".release/evidence",
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
    targets: [...targetInputs].sort(targetOrder),
    strict: intent.strict ?? true,
    evidenceDirectory
  })
})
