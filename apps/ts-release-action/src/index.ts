import { DefaultArtifactClient } from "@actions/artifact"
import * as core from "@actions/core"
import * as Effect from "effect/Effect"
import * as FileSystem from "node:fs/promises"
import * as Path from "node:path"
import { ActionArtifactUploadError, type ActionArtifactClient, type ActionIo } from "./action.js"
import { runActionFromInputs } from "./main.js"
import { makeNodeReleaseWorkflowRuntimeLayer } from "./runtime/node.js"

const root = process.env.GITHUB_WORKSPACE ?? process.cwd()

const CoreInputReader = {
  getInput: (name: string): string => core.getInput(name)
}

const CoreActionIo: ActionIo = {
  setOutput: (name, value) => Effect.sync(() => core.setOutput(name, value)),
  setFailed: (message) => Effect.sync(() => core.setFailed(message)),
  appendSummary: (markdown) =>
    Effect.tryPromise({
      try: () => core.summary.addRaw(markdown, true).write(),
      catch: (cause) => cause
    }).pipe(Effect.asVoid),
  writeFile: (pathName, contents) =>
    Effect.tryPromise({
      try: async () => {
        await FileSystem.mkdir(Path.dirname(pathName), { recursive: true })
        await FileSystem.writeFile(pathName, contents)
      },
      catch: (cause) => cause
    }),
  info: (message) => Effect.sync(() => core.info(message))
}

const actionsArtifactClient = (): ActionArtifactClient => {
  const client = new DefaultArtifactClient()
  return {
    uploadArtifact: (name, files, rootDirectory) =>
      Effect.tryPromise({
        try: async () => {
          await client.uploadArtifact(name, [...files], rootDirectory)
        },
        catch: (cause) =>
          ActionArtifactUploadError.make({
            reason: cause instanceof Error ? cause.message : String(cause)
          })
      })
  }
}

await runActionFromInputs(
  CoreInputReader,
  CoreActionIo,
  root,
  makeNodeReleaseWorkflowRuntimeLayer({ root }),
  actionsArtifactClient()
)
