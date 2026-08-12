import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import type { SourceObserverShape } from "../release/context.js"
import type { RunCommand } from "../drivers/process.js"

export class ReleaseRuntimeError
  extends Schema.TaggedErrorClass<ReleaseRuntimeError>()("ReleaseRuntimeError", { reason: Schema.String }) {}

export interface ReleaseRuntimeShape {
  readonly source: SourceObserverShape
  readonly run: RunCommand
}

export class ReleaseRuntime extends Context.Service<ReleaseRuntime, ReleaseRuntimeShape>()("ReleaseRuntime") {}
