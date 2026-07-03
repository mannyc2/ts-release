import * as Effect from "effect/Effect"
import {
  Artifact,
  ExecutableExtra
} from "../pipeline/artifact.js"
import { CommandSpec, ValidateCommandOperation } from "../pipeline/operation.js"
import { renderTemplate } from "../pipeline/template.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import type { Builder, BuilderPlan } from "./builder.js"
import {
  allPlatformTargets,
  platformTargetSuffix,
  platformTargetVariant,
  type PlatformTarget
} from "./targets.js"

export interface CommandBuildOptions {
  readonly builder: "command"
  readonly id?: string | undefined
  readonly targets: ReadonlyArray<PlatformTarget>
  readonly run: string | ReadonlyArray<string>
  readonly output: string
  readonly binary?: string | undefined
}

const argv = (run: string | ReadonlyArray<string>): ReadonlyArray<string> =>
  typeof run === "string" ? run.trim().split(/\s+/).filter((part) => part.length > 0) : run

export const commandBuilder: Builder<CommandBuildOptions> = {
  id: "command",
  supportedTargets: allPlatformTargets,
  defaults: (options, identity) => ({
    ...options,
    id: options.id ?? "command",
    binary: options.binary ?? identity.normalizedName
  }),
  doctor: () => [],
  plan: (options, identity, target): Effect.Effect<BuilderPlan> =>
    Effect.sync(() => {
      const binary = options.binary ?? identity.normalizedName
      const platform = platformTargetVariant(target)
      const targetTriple = target
      const context = { identity, platform, targetTriple, binary }
      const renderedOutput = renderTemplate(options.output, context)
      const args = argv(options.run).map((part) => renderTemplate(part, context))
      const id = `${options.id ?? "command"}-${platformTargetSuffix(target)}`
      return {
        artifacts: [
          Artifact.make({
            id,
            kind: "executable",
            path: renderedOutput,
            producedBy: "build:command",
            platform: {
              ...platform,
              binaryName: binary,
              targetTriple
            },
            extra: ExecutableExtra.make({
              binary,
              extension: platform.executableExtension ?? "",
              builderId: "command"
            })
          })
        ],
        operations: [
          ValidateCommandOperation.make({
            id: `build:command:${id}`,
            description: `Run configured build command for ${target}.`,
            risk: "writes-local",
            command: CommandSpec.make({
              executable: args[0] ?? "",
              args: args.slice(1),
              requiredEnv: [],
              redactedEnv: []
            })
          })
        ]
      }
    })
}
