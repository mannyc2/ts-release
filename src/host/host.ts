import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { ChecksumAlgorithm } from "../domain/artifact.js"
import { CommandSpec } from "../domain/operation.js"

export type * from "../types/effect-internal.js"

export class HostError extends Schema.TaggedErrorClass<HostError>()("HostError", {
  operation: Schema.String,
  path: Schema.optionalKey(Schema.String),
  reason: Schema.String
}) {}

export class FileInfo extends Schema.Class<FileInfo>("FileInfo")({
  path: Schema.String,
  sizeBytes: Schema.Number,
  kind: Schema.Literals(["file", "directory", "other"])
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

export interface ReleaseHostShape {
  readonly readFileString: (path: string) => Effect.Effect<string, HostError>
  readonly writeFileString: (path: string, contents: string) => Effect.Effect<void, HostError>
  readonly stat: (path: string) => Effect.Effect<FileInfo, HostError>
  readonly hashFile: (path: string, algorithm: ChecksumAlgorithm) => Effect.Effect<string, HostError>
  readonly readEnv: (name: string) => Effect.Effect<string | undefined, never>
  readonly runCommand: (command: CommandSpec) => Effect.Effect<CommandResult, HostError>
  readonly now: Effect.Effect<string, never>
}

export class ReleaseHost extends Context.Service<ReleaseHost, ReleaseHostShape>()("ReleaseHost") {}

export const ReleaseHostTest = (host: ReleaseHostShape): Layer.Layer<ReleaseHost> =>
  Layer.succeed(ReleaseHost)(host)

export const missingEnvNames = Effect.fn("missingEnvNames")(function*(command: CommandSpec) {
  const host = yield* ReleaseHost
  const missing: Array<string> = []
  for (const name of command.requiredEnv) {
    const value = yield* host.readEnv(name)
    if (value === undefined) {
      missing.push(name)
    }
  }
  return missing
})
