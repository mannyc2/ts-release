import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import {
  formatActionError,
  runAction,
  type ActionArtifactClient,
  type ActionIo,
  type ActionRuntimeServices
} from "./action.js"
import { readActionOptions, type ActionInputReader } from "./input.js"

export const runActionFromInputs = async (
  reader: ActionInputReader,
  io: ActionIo,
  root: string,
  layer: Layer.Layer<ActionRuntimeServices>,
  artifactClient: ActionArtifactClient
): Promise<void> => {
  try {
    const options = readActionOptions(reader, root)
    await runAction(options, io, layer, artifactClient)
  } catch (cause) {
    await Effect.runPromise(io.setOutput("status", "failed"))
    await Effect.runPromise(io.setFailed(formatActionError(cause)))
  }
}
