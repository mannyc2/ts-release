import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  ExecutableExtra,
  SafeRelativePath
} from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  BunCompileIntent,
  Operation,
  StageAction,
  type BunCompileTarget
} from "../pipeline/operation.js"
import {
  allPlatformTargets,
  PlatformTarget,
  platformTargetVariant,
  type PlatformTarget as PlatformTargetName
} from "../pipeline/platform.js"
import { defaultArtifactBaseName, renderArtifactNameEffect } from "../pipeline/template.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import type { Builder, BuilderPlan } from "./builder.js"


export class ReleaseConfigBunExecutableBuild extends Schema.Class<ReleaseConfigBunExecutableBuild>(
  "ReleaseConfigBunExecutableBuild"
)({
  id: Schema.optionalKey(Schema.String),
  builder: Schema.Literal("bun"),
  entry: SafeRelativePath,
  targets: Schema.optionalKey(Schema.Array(PlatformTarget)),
  output: Schema.optionalKey(SafeRelativePath),
  binary: Schema.optionalKey(Schema.String),
  binaryName: Schema.optionalKey(Schema.String),
  installPath: Schema.optionalKey(Schema.String),
  cpu: Schema.optionalKey(Schema.Literals(["baseline", "modern"])),
  minify: Schema.optionalKey(Schema.Boolean)
}) {}
export type BunBuildOptions = typeof ReleaseConfigBunExecutableBuild.Type

const defaultTargets: ReadonlyArray<PlatformTargetName> = [
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
  "windows-x64"
]

const bunCompileTargets = {
  "linux-x64": {
    default: "bun-linux-x64",
    baseline: "bun-linux-x64-baseline",
    modern: "bun-linux-x64-modern"
  },
  "linux-x64-musl": {
    default: "bun-linux-x64-musl",
    baseline: "bun-linux-x64-baseline-musl",
    modern: "bun-linux-x64-modern-musl"
  },
  "linux-arm64": {
    default: "bun-linux-arm64",
    baseline: "bun-linux-arm64-baseline",
    modern: "bun-linux-arm64-modern"
  },
  "linux-arm64-musl": {
    default: "bun-linux-arm64-musl",
    baseline: "bun-linux-arm64-baseline-musl",
    modern: "bun-linux-arm64-modern-musl"
  },
  "darwin-x64": {
    default: "bun-darwin-x64",
    baseline: "bun-darwin-x64-baseline",
    modern: "bun-darwin-x64-modern"
  },
  "darwin-arm64": {
    default: "bun-darwin-arm64",
    baseline: "bun-darwin-arm64-baseline",
    modern: "bun-darwin-arm64-modern"
  },
  "windows-x64": {
    default: "bun-windows-x64",
    baseline: "bun-windows-x64-baseline",
    modern: "bun-windows-x64-modern"
  },
  "windows-arm64": {
    default: "bun-windows-arm64"
  }
} as const satisfies Record<PlatformTargetName, {
  readonly default: BunCompileTarget
  readonly baseline?: BunCompileTarget
  readonly modern?: BunCompileTarget
}>

interface BunCompileTargetLookupEntry {
  readonly default: BunCompileTarget
  readonly baseline?: BunCompileTarget
  readonly modern?: BunCompileTarget
}

type BunCompileTargetTableValue = Exclude<
  typeof bunCompileTargets[keyof typeof bunCompileTargets][keyof typeof bunCompileTargets[keyof typeof bunCompileTargets]],
  undefined
>
const bunCompileTargetTableValuesAssignable: [BunCompileTargetTableValue] extends [BunCompileTarget] ? true : never = true
void bunCompileTargetTableValuesAssignable

const compileTarget = (
  target: PlatformTargetName,
  cpu: "baseline" | "modern" | undefined
): Effect.Effect<BunCompileTarget, PlanError> => {
  const targetEntry: BunCompileTargetLookupEntry = bunCompileTargets[target]
  const selected = cpu === undefined ? targetEntry.default : targetEntry[cpu]
  if (selected !== undefined) {
    return Effect.succeed(selected)
  }
  if (target === "windows-arm64") {
    return Effect.fail(PlanError.make({
      pipeId: "build",
      field: "builds[].cpu",
      reason: "Bun windows-arm64 does not support baseline or modern CPU suffixes."
    }))
  }
  return Effect.fail(PlanError.make({
    pipeId: "build",
    field: "builds[].cpu",
    reason: `Bun target ${target} does not support the ${cpu} CPU suffix.`
  }))
}

const defaultOutputPath = (
  options: BunBuildOptions,
  target: PlatformTargetName,
  binary: string
): string => {
  const variant = platformTargetVariant(target)
  return `.release/artifacts/${defaultArtifactBaseName(binary, variant)}`
}

const outputPath = (
  options: BunBuildOptions,
  target: PlatformTargetName,
  binary: string
): string =>
  options.output ?? defaultOutputPath(options, target, binary)

const artifactId = (
  options: BunBuildOptions,
  target: PlatformTargetName
): string =>
  `${options.id ?? "cli"}-${target}`

const hasParentTraversal = (pathName: string): boolean =>
  pathName.split(/[\\/]+/).includes("..")

const validateSafeRelativePath = (
  field: string,
  pathName: string
): Effect.Effect<void, PlanError> => {
  const isEmpty = pathName.trim().length === 0
  const isAbsolute = pathName.startsWith("/") || /^[A-Za-z]:[\\/]/.test(pathName)
  if (!isEmpty && !isAbsolute && !hasParentTraversal(pathName)) {
    return Effect.void
  }
  return Effect.fail(PlanError.make({
    pipeId: "build",
    field,
    reason: "Path must be non-empty, relative, and must not contain parent traversal."
  }))
}

export const bunBuilder: Builder<BunBuildOptions> = {
  id: "bun",
  supportedTargets: allPlatformTargets,
  plan: (options, identity, target): Effect.Effect<BuilderPlan, PlanError> =>
    Effect.gen(function*() {
      if (!(options.targets ?? defaultTargets).includes(target)) {
        return { artifacts: [], operations: [] }
      }
      const binary = options.binary ?? identity.normalizedName
      const platform = platformTargetVariant(target)
      const id = artifactId(options, target)
      const context = {
        identity,
        platform,
        targetTriple: target,
        binary
      }
      const renderedEntry = yield* renderArtifactNameEffect(options.entry, context, { pipeId: "build", field: "builds[].entry" })
      yield* validateSafeRelativePath("builds[].entry", renderedEntry)
      const renderedPath = yield* renderArtifactNameEffect(outputPath(options, target, binary), {
        identity,
        platform,
        targetTriple: target,
        binary
      }, { pipeId: "build", field: "builds[].output" })
      const compile = yield* compileTarget(target, options.cpu)
      const extension = platform.executableExtension ?? ""
      const binaryName = options.binaryName ?? binary
      const installPath = options.installPath
      return {
        artifacts: [
          Artifact.make({
            id,
            kind: "executable",
            path: renderedPath,
            producedBy: "build:bun",
            platform: {
              ...platform,
              binaryName,
              ...(installPath === undefined ? {} : { installPath }),
              targetTriple: compile
            },
            extra: ExecutableExtra.make({
              binary,
              extension,
              builderId: "bun"
            })
          })
        ],
        operations: [
          Operation.make({
            id: `build:bun:${id}`,
            pipeId: "build",
            phase: "build",
            description: `Compile ${binary} for ${target} with Bun.`,
            risk: "writes-local",
            action: StageAction.make({
              intent: BunCompileIntent.make({
                entry: renderedEntry,
                target,
                compileTarget: compile,
                outfile: renderedPath,
                ...(options.minify === undefined ? {} : { minify: options.minify })
              }),
              producesArtifactIds: [id]
            })
          })
        ]
      }
    })
}
