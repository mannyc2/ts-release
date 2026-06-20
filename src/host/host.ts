import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { CommandSpec } from "../domain/operation.js"

export type * from "../types/effect-internal.js"

export class CommandRunnerError extends Schema.TaggedErrorClass<CommandRunnerError>()("CommandRunnerError", {
  operation: Schema.String,
  reason: Schema.String,
  cause: Schema.optionalKey(Schema.Defect())
}) {}

export class CommandResult extends Schema.Class<CommandResult>("CommandResult")({
  command: CommandSpec,
  exitCode: Schema.Number,
  stdout: Schema.String,
  stderr: Schema.String,
  startedAt: Schema.String,
  endedAt: Schema.String,
  durationMillis: Schema.Number
}) {}

export interface ReleaseCommandRunnerShape {
  readonly runCommand: (command: CommandSpec) => Effect.Effect<CommandResult, CommandRunnerError>
}

export class ReleaseCommandRunner extends Context.Service<
  ReleaseCommandRunner,
  ReleaseCommandRunnerShape
>()("ReleaseCommandRunner") {}

export const ReleaseCommandRunnerTestLayer = (
  commandRunner: ReleaseCommandRunnerShape
): Layer.Layer<ReleaseCommandRunner> =>
  Layer.succeed(ReleaseCommandRunner)(commandRunner)
