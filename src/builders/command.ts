import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  ExecutableExtra,
  SafeRelativePath
} from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import { CheckFileAction, CommandAction, CommandSpec, Operation } from "../pipeline/operation.js"
import {
  allPlatformTargets,
  PlatformTarget,
  platformTargetVariant,
  type PlatformTarget as PlatformTargetName
} from "../pipeline/platform.js"
import { renderTemplate } from "../pipeline/template.js"
import type { Builder, BuilderPlan } from "./builder.js"

export class ReleaseConfigCommandBuild extends Schema.Class<ReleaseConfigCommandBuild>(
  "ReleaseConfigCommandBuild"
)({
  builder: Schema.Literal("command"),
  id: Schema.optionalKey(Schema.String),
  targets: Schema.Array(PlatformTarget),
  run: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  output: SafeRelativePath,
  binary: Schema.optionalKey(Schema.String)
}) {}
export type CommandBuildOptions = typeof ReleaseConfigCommandBuild.Type

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
  plan: (options, identity, target): Effect.Effect<BuilderPlan, PlanError> =>
    Effect.gen(function*() {
      const binary = options.binary ?? identity.normalizedName
      const platform = platformTargetVariant(target)
      const targetTriple = target
      const context = { identity, platform, targetTriple, binary }
      const renderedOutput = renderTemplate(options.output, context)
      const args = argv(options.run).map((part) => renderTemplate(part, context))
      if (args.length === 0) {
        return yield* Effect.fail(PlanError.make({
          pipeId: "build",
          field: "builds[].run",
          reason: "Command build run must render to at least one argv entry."
        }))
      }
      const id = `${options.id ?? "command"}-${target}`
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
          Operation.make({
            id: `build:command:${id}`,
            pipeId: "build",
            phase: "build",
            description: `Run configured build command for ${target}.`,
            risk: "writes-local",
            action: CommandAction.make({
              command: CommandSpec.make({
                executable: args[0] ?? "",
                args: args.slice(1),
                requiredEnv: [],
                redactedEnv: []
              })
            })
          }),
          Operation.make({
            id: `build:command:${id}:exists`,
            pipeId: "build",
            phase: "build",
            description: `Verify command build output exists for ${target}.`,
            risk: "read-only",
            action: CheckFileAction.make({ path: renderedOutput })
          })
        ]
      }
    })
}
