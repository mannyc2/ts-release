import * as Effect from "effect/Effect"
import {
  Artifact,
  ExecutableExtra
} from "../pipeline/artifact.js"
import type { InstallableArtifactVariantOverride } from "../domain/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  BunCompileIntent,
  StageArtifactOperation,
  type BunCompileTarget
} from "../pipeline/operation.js"
import { renderTemplate } from "../pipeline/template.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import type { Builder, BuilderPlan } from "./builder.js"
import {
  allPlatformTargets,
  platformTargetSuffix,
  platformTargetVariant,
  type PlatformTarget
} from "./targets.js"

export type * from "../types/effect-internal.js"

export interface BunBuildOutput {
  readonly id?: string | undefined
  readonly target: PlatformTarget
  readonly path?: string | undefined
  readonly binaryName?: string | undefined
  readonly installPath?: string | undefined
  readonly variant?: InstallableArtifactVariantOverride | undefined
}

export interface BunBuildOptions {
  readonly builder: "bun"
  readonly id?: string | undefined
  readonly entry: string
  readonly targets?: ReadonlyArray<PlatformTarget> | undefined
  readonly output?: string | undefined
  readonly outputs?: ReadonlyArray<BunBuildOutput> | undefined
  readonly binary?: string | undefined
  readonly name?: string | undefined
  readonly outDir?: string | undefined
  readonly binaryName?: string | undefined
  readonly installPath?: string | undefined
  readonly cpu?: "baseline" | "modern" | undefined
  readonly minify?: boolean | undefined
}

const defaultTargets: ReadonlyArray<PlatformTarget> = [
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
  "windows-x64"
]

const compileTarget = (
  target: PlatformTarget,
  cpu: "baseline" | "modern" | undefined
): Effect.Effect<BunCompileTarget, PlanError> => {
  if (target === "windows-arm64" && cpu !== undefined) {
    return Effect.fail(PlanError.make({
      pipeId: "build",
      field: "builds[].cpu",
      reason: "Bun windows-arm64 does not support baseline or modern CPU suffixes."
    }))
  }
  switch (target) {
    case "linux-x64":
      return Effect.succeed(cpu === "baseline" ? "bun-linux-x64-baseline" : cpu === "modern" ? "bun-linux-x64-modern" : "bun-linux-x64")
    case "linux-x64-musl":
      return Effect.succeed(cpu === "baseline" ? "bun-linux-x64-baseline-musl" : cpu === "modern" ? "bun-linux-x64-modern-musl" : "bun-linux-x64-musl")
    case "linux-arm64":
      return Effect.succeed(cpu === "baseline" ? "bun-linux-arm64-baseline" : cpu === "modern" ? "bun-linux-arm64-modern" : "bun-linux-arm64")
    case "linux-arm64-musl":
      return Effect.succeed(cpu === "baseline" ? "bun-linux-arm64-baseline-musl" : cpu === "modern" ? "bun-linux-arm64-modern-musl" : "bun-linux-arm64-musl")
    case "darwin-x64":
      return Effect.succeed(cpu === "baseline" ? "bun-darwin-x64-baseline" : cpu === "modern" ? "bun-darwin-x64-modern" : "bun-darwin-x64")
    case "darwin-arm64":
      return Effect.succeed(cpu === "baseline" ? "bun-darwin-arm64-baseline" : cpu === "modern" ? "bun-darwin-arm64-modern" : "bun-darwin-arm64")
    case "windows-x64":
      return Effect.succeed(cpu === "baseline" ? "bun-windows-x64-baseline" : cpu === "modern" ? "bun-windows-x64-modern" : "bun-windows-x64")
    case "windows-arm64":
      return Effect.succeed("bun-windows-arm64")
  }
}

const defaultOutputPath = (
  options: BunBuildOptions,
  identity: ReleaseIdentity,
  target: PlatformTarget,
  binary: string
): string => {
  const variant = platformTargetVariant(target)
  const extension = variant.executableExtension ?? ""
  const suffix = platformTargetSuffix(target).replace("x64", "amd64")
  const outDir = options.outDir ?? ".release/artifacts"
  return `${outDir.replace(/[/\\]+$/, "")}/${binary}_{version}_${suffix}${extension}`
}

const buildOutputs = (
  options: BunBuildOptions
): ReadonlyArray<BunBuildOutput> =>
  options.outputs ?? (options.targets ?? defaultTargets).map((target) => ({ target }))

const outputPath = (
  options: BunBuildOptions,
  identity: ReleaseIdentity,
  output: BunBuildOutput,
  binary: string
): string =>
  output.path ?? options.output ?? defaultOutputPath(options, identity, output.target, binary)

const artifactId = (
  options: BunBuildOptions,
  output: BunBuildOutput
): string =>
  output.id ?? `${options.id ?? "cli"}-${platformTargetSuffix(output.target)}`

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

const validateVariantOverride = (
  id: string,
  output: BunBuildOutput
): Effect.Effect<void, PlanError> => {
  if (output.variant === undefined) {
    return Effect.void
  }
  const platform = platformTargetVariant(output.target)
  if (output.variant.os !== undefined && output.variant.os !== platform.os) {
    return Effect.fail(PlanError.make({
      pipeId: "build",
      field: `builds[].outputs.${id}.variant.os`,
      reason: `Variant os ${output.variant.os} contradicts target ${output.target}.`
    }))
  }
  if (output.variant.arch !== undefined && output.variant.arch !== platform.arch) {
    return Effect.fail(PlanError.make({
      pipeId: "build",
      field: `builds[].outputs.${id}.variant.arch`,
      reason: `Variant arch ${output.variant.arch} contradicts target ${output.target}.`
    }))
  }
  if (output.variant.libc !== undefined && output.variant.libc !== platform.libc) {
    return Effect.fail(PlanError.make({
      pipeId: "build",
      field: `builds[].outputs.${id}.variant.libc`,
      reason: `Variant libc ${output.variant.libc} contradicts target ${output.target}.`
    }))
  }
  return Effect.void
}

export const bunBuilder: Builder<BunBuildOptions> = {
  id: "bun",
  supportedTargets: allPlatformTargets,
  defaults: (options, identity) => ({
    ...options,
    id: options.id ?? "cli",
    binary: options.binary ?? options.name ?? identity.normalizedName
  }),
  doctor: () => [],
  plan: (options, identity, target): Effect.Effect<BuilderPlan, PlanError> =>
    Effect.gen(function*() {
      const output = buildOutputs(options).find((candidate) => candidate.target === target)
      if (output === undefined) {
        return { artifacts: [], operations: [] }
      }
      const binary = options.binary ?? options.name ?? identity.normalizedName
      const platform = platformTargetVariant(target)
      const id = artifactId(options, output)
      const context = {
        identity,
        platform,
        targetTriple: target,
        binary
      }
      const renderedEntry = renderTemplate(options.entry, context)
      yield* validateSafeRelativePath("builds[].entry", renderedEntry)
      const renderedPath = renderTemplate(outputPath(options, identity, output, binary), {
        identity,
        platform,
        targetTriple: target,
        binary
      })
      const compile = yield* compileTarget(target, options.cpu)
      yield* validateVariantOverride(id, output)
      const extension = platform.executableExtension ?? ""
      const installPath = output.installPath ?? options.installPath
      return {
        artifacts: [
          Artifact.make({
            id,
            kind: "executable",
            path: renderedPath,
            producedBy: "build:bun",
            platform: {
              ...platform,
              binaryName: output.binaryName ?? options.binaryName ?? binary,
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
          StageArtifactOperation.make({
            id: `build:bun:${id}`,
            description: `Compile ${binary} for ${target} with Bun.`,
            risk: "writes-local",
            intent: BunCompileIntent.make({
              entry: renderedEntry,
              target,
              compileTarget: compile,
              outfile: renderedPath,
              ...(options.minify === undefined ? {} : { minify: options.minify })
            }),
            producesArtifactIds: [id]
          })
        ]
      }
    })
}
