import * as Effect from "effect/Effect"
import {
  Artifact,
  ExecutableExtra
} from "../pipeline/artifact.js"
import { CommandSpec, ValidateCommandOperation } from "../pipeline/operation.js"
import { renderTemplate } from "../pipeline/template.js"
import type { Builder, BuilderPlan } from "./builder.js"
import {
  allPlatformTargets,
  platformTargetSuffix,
  platformTargetVariant,
  type PlatformTarget
} from "./targets.js"

export interface PrebuiltBuildOptions {
  readonly builder: "prebuilt"
  readonly id?: string | undefined
  readonly targets: ReadonlyArray<PlatformTarget>
  readonly output: string
  readonly binary?: string | undefined
}

export const prebuiltBuilder: Builder<PrebuiltBuildOptions> = {
  id: "prebuilt",
  supportedTargets: allPlatformTargets,
  defaults: (options, identity) => ({
    ...options,
    id: options.id ?? "prebuilt",
    binary: options.binary ?? identity.normalizedName
  }),
  doctor: () => [],
  plan: (options, identity, target): Effect.Effect<BuilderPlan> =>
    Effect.sync(() => {
      const binary = options.binary ?? identity.normalizedName
      const platform = platformTargetVariant(target)
      const targetTriple = target
      const renderedOutput = renderTemplate(options.output, { identity, platform, targetTriple, binary })
      const id = `${options.id ?? "prebuilt"}-${platformTargetSuffix(target)}`
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
          ValidateCommandOperation.make({
            id: `build:prebuilt:${id}:exists`,
            description: `Verify prebuilt artifact exists for ${target}.`,
            risk: "read-only",
            command: CommandSpec.make({
              executable: "test",
              args: ["-f", renderedOutput],
              requiredEnv: [],
              redactedEnv: []
            })
          })
        ]
      }
    })
}
