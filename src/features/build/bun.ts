// Invariant: Bun compile targets are derived from platform/cpu tokens and each target emits one artifact plus one stage.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SafeRelativePath } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { Operation, StageAction } from "../../grammar/operation.js"
import { BunCompileIntent, type BunCompileTarget } from "../../grammar/intent.js"
import {
  PlatformTarget,
  platformTargetVariant,
  type PlatformTarget as PlatformTargetName
} from "../../grammar/platform.js"
import type { ReleaseIdentity } from "../../grammar/state.js"
import { defaultArtifactBaseName, renderArtifactNameEffect } from "../../grammar/template.js"
import { defaulted } from "../../grammar/defaulted.js"
import { executableArtifact, type Builder } from "./builder.js"

export class ReleaseConfigBunExecutableBuild extends Schema.Class<ReleaseConfigBunExecutableBuild>(
  "ReleaseConfigBunExecutableBuild"
)({
  id: Schema.optionalKey(Schema.String),
  builder: Schema.Literal("bun"),
  entry: SafeRelativePath,
  targets: defaulted(Schema.Array(PlatformTarget), [
    "linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"
  ]),
  output: Schema.optionalKey(SafeRelativePath),
  binary: Schema.optionalKey(Schema.String),
  binaryName: Schema.optionalKey(Schema.String),
  installPath: Schema.optionalKey(Schema.String),
  cpu: Schema.optionalKey(Schema.Literals(["baseline", "modern"])),
  minify: Schema.optionalKey(Schema.Boolean)
}) {}
export type BunBuildOptions = typeof ReleaseConfigBunExecutableBuild.Type

const compileTarget = (
  target: PlatformTargetName,
  cpu: "baseline" | "modern" | undefined
): Effect.Effect<BunCompileTarget, PlanError> => {
  if (target === "windows-arm64" && cpu !== undefined) return Effect.fail(PlanError.make({
    pipeId: "build",
    field: "builds[].cpu",
    reason: "Bun windows-arm64 does not support baseline or modern CPU suffixes."
  }))
  const [os, arch, libc] = target.split("-")
  return Effect.succeed(
    `bun-${os}-${arch}${cpu === undefined ? "" : `-${cpu}`}${libc === undefined ? "" : `-${libc}`}` as BunCompileTarget
  )
}

export const bunBuilder: Builder<BunBuildOptions> = (options, identity: ReleaseIdentity, target) =>
  Effect.gen(function*() {
    const binary = options.binary ?? identity.normalizedName
    const platform = platformTargetVariant(target)
    const context = { identity, platform, targetTriple: target, binary }
    const entry = yield* renderArtifactNameEffect(options.entry, context, {
      pipeId: "build", field: "builds[].entry"
    })
    const path = yield* renderArtifactNameEffect(
      options.output ?? `.release/artifacts/${defaultArtifactBaseName(binary, platform)}`,
      context,
      { pipeId: "build", field: "builds[].output" }
    )
    const compile = yield* compileTarget(target, options.cpu)
    const id = `${options.id ?? "cli"}-${target}`
    return {
      artifacts: [executableArtifact({
        id, builder: "bun", binary, path, platform, targetTriple: compile,
        binaryName: options.binaryName, installPath: options.installPath
      })],
      operations: [Operation.make({
        id: `build:bun:${id}`,
        pipeId: "build",
        phase: "build",
        description: `Compile ${binary} for ${target} with Bun.`,
        risk: "writes-local",
        action: StageAction.make({
          intent: BunCompileIntent.make({
            entry,
            target,
            compileTarget: compile,
            outfile: path,
            ...(options.minify === undefined ? {} : { minify: options.minify })
          }),
          producesArtifactIds: [id]
        })
      })]
    }
  })
