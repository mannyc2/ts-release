import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  ExecutableExtra,
  SafeRelativePath
} from "../pipeline/artifact.js"
import { CheckFileAction, Operation } from "../pipeline/operation.js"
import {
  allPlatformTargets,
  PlatformTarget,
  platformTargetVariant,
  type PlatformTarget as PlatformTargetName
} from "../pipeline/platform.js"
import { PlanError } from "../pipeline/errors.js"
import { renderArtifactNameEffect } from "../pipeline/template.js"
import type { Builder, BuilderPlan } from "./builder.js"

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

export const prebuiltBuilder: Builder<PrebuiltBuildOptions> = {
  id: "prebuilt",
  supportedTargets: allPlatformTargets,
  defaults: (options, identity) => ({
    ...options,
    id: options.id ?? "prebuilt",
    binary: options.binary ?? identity.normalizedName
  }),
  plan: (options, identity, target): Effect.Effect<BuilderPlan, PlanError> =>
    Effect.gen(function*() {
      const binary = options.binary ?? identity.normalizedName
      const platform = platformTargetVariant(target)
      const targetTriple = target
      const renderedOutput = yield* renderArtifactNameEffect(options.output, { identity, platform, targetTriple, binary }, { pipeId: "build", field: "builds[].output" })
      const id = `${options.id ?? "prebuilt"}-${target}`
      return {
        artifacts: [
          Artifact.make({
            id,
            kind: "executable",
            path: renderedOutput,
            producedBy: "build:prebuilt",
            platform: {
              ...platform,
              binaryName: binary,
              targetTriple
            },
            extra: ExecutableExtra.make({
              binary,
              extension: platform.executableExtension ?? "",
              builderId: "prebuilt"
            })
          })
        ],
        operations: [
          Operation.make({
            id: `build:prebuilt:${id}:exists`,
            pipeId: "build",
            phase: "build",
            description: `Verify prebuilt artifact exists for ${target}.`,
            risk: "read-only",
            action: CheckFileAction.make({ path: renderedOutput })
          })
        ]
      }
    })
}
