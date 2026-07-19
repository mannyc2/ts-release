// Invariant: a command build emits one executable artifact, its command, then its existence check.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SafeRelativePath } from "../grammar/artifact.js"
import { PlanError } from "../grammar/errors.js"
import { CheckFileAction, CommandAction, CommandSpec, Operation } from "../grammar/operation.js"
import { PlatformTarget, platformTargetVariant } from "../grammar/platform.js"
import { renderArtifactNameEffect, renderTemplate } from "../grammar/template.js"
import { executableArtifact, type Builder } from "./builder.js"

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

export const commandBuilder: Builder<CommandBuildOptions> = (options, identity, target) =>
  Effect.gen(function*() {
    const binary = options.binary ?? identity.normalizedName
    const platform = platformTargetVariant(target)
    const context = { identity, platform, targetTriple: target, binary }
    const path = yield* renderArtifactNameEffect(options.output, context, {
      pipeId: "build", field: "builds[].output"
    })
    const command = (typeof options.run === "string"
      ? options.run.trim().split(/\s+/).filter(Boolean)
      : options.run).map((part) => renderTemplate(part, context))
    if (command.length === 0) return yield* Effect.fail(PlanError.make({
      pipeId: "build", field: "builds[].run",
      reason: "Command build run must render to at least one argv entry."
    }))
    const id = `${options.id ?? "command"}-${target}`
    return {
      artifacts: [executableArtifact({ id, builder: "command", binary, path, platform, targetTriple: target })],
      operations: [
        Operation.make({
          id: `build:command:${id}`,
          pipeId: "build",
          phase: "build",
          description: `Run configured build command for ${target}.`,
          risk: "writes-local",
          action: CommandAction.make({ command: CommandSpec.make({
            executable: command[0] ?? "", args: command.slice(1), requiredEnv: [], redactedEnv: []
          }) })
        }),
        Operation.make({
          id: `build:command:${id}:exists`,
          pipeId: "build",
          phase: "build",
          description: `Verify command build output exists for ${target}.`,
          risk: "read-only",
          action: CheckFileAction.make({ path })
        })
      ]
    }
  })
