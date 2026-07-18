import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { CommandSpec } from "../pipeline/operation.js"


export class CommandRunnerError extends Schema.TaggedErrorClass<CommandRunnerError>()("CommandRunnerError", {
  operation: Schema.String,
  reason: Schema.String,
  cause: Schema.optional(Schema.Defect())
}) {}

export interface CommandResult {
  readonly command: CommandSpec
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly startedAt: string
  readonly endedAt: string
  readonly durationMillis: number
}

export interface ReleaseCommandRunnerShape {
  readonly runCommand: (command: CommandSpec) => Effect.Effect<CommandResult, CommandRunnerError>
}

export class ReleaseCommandRunner extends Context.Service<
  ReleaseCommandRunner,
  ReleaseCommandRunnerShape
>()("ReleaseCommandRunner") {}
