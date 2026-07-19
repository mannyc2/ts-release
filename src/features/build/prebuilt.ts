// Invariant: a prebuilt target is one executable artifact guarded by one read-only existence check.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SafeRelativePath } from "../../grammar/artifact.js"
import { CheckFileAction, Operation } from "../../grammar/operation.js"
import { PlatformTarget, platformTargetVariant } from "../../grammar/platform.js"
import { renderArtifactNameEffect } from "../../grammar/template.js"
import { executableArtifact, type Builder } from "./builder.js"

export class ReleaseConfigPrebuiltBuild extends Schema.Class<ReleaseConfigPrebuiltBuild>(
  "ReleaseConfigPrebuiltBuild"
)({
  builder: Schema.Literal("prebuilt"),
  id: Schema.optionalKey(Schema.String),
  targets: Schema.Array(PlatformTarget),
  output: SafeRelativePath,
  binary: Schema.optionalKey(Schema.String)
}) {}
export type PrebuiltBuildOptions = typeof ReleaseConfigPrebuiltBuild.Type

export const prebuiltBuilder: Builder<PrebuiltBuildOptions> = (options, identity, target) =>
  Effect.gen(function*() {
    const binary = options.binary ?? identity.normalizedName
    const platform = platformTargetVariant(target)
    const path = yield* renderArtifactNameEffect(options.output, {
      identity, platform, targetTriple: target, binary
    }, { pipeId: "build", field: "builds[].output" })
    const id = `${options.id ?? "prebuilt"}-${target}`
    return {
      artifacts: [executableArtifact({ id, builder: "prebuilt", binary, path, platform, targetTriple: target })],
      operations: [Operation.make({
        id: `build:prebuilt:${id}:exists`,
        pipeId: "build",
        phase: "build",
        description: `Verify prebuilt artifact exists for ${target}.`,
        risk: "read-only",
        action: CheckFileAction.make({ path })
      })]
    }
  })
