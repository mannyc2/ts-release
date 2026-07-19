// Invariant: shared feature operation constructors preserve phase, risk, and action data exactly.
import { artifactPathBaseName } from "../grammar/artifact.js"
import { CommandAction, CommandSpec, NoteAction, Operation } from "../grammar/operation.js"
export const noAuthCommand = (executable: string, args: ReadonlyArray<string>): CommandSpec =>
  CommandSpec.make({ executable, args: [...args], requiredEnv: [], redactedEnv: [] })

export const readOnlyCommandValidationOperation = (options: {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly command: CommandSpec
}): Operation => Operation.make({
  ...options,
  phase: "publish",
  risk: "read-only",
  action: CommandAction.make({ command: options.command })
})

export const validationNoteOperation = (options: {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly message: string
}): Operation => Operation.make({
  id: options.id,
  pipeId: options.pipeId,
  phase: "publish",
  risk: "read-only",
  description: options.description,
  action: NoteAction.make({ message: options.message, skipped: false, severity: "info" })
})

export interface CatalogGitPublishOptions {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly directory?: string | undefined
  readonly filePath: string
  readonly commitMessage: string
}

const catalogFilePath = (filePath: string, directory: string | undefined): string => {
  if (directory === undefined) return filePath
  const normalizedDirectory = directory.replaceAll("\\", "/").replace(/\/+$/, "")
  const prefix = `${normalizedDirectory}/`
  const normalizedPath = filePath.replaceAll("\\", "/")
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : filePath
}

export const catalogGitPublishOperations = (options: CatalogGitPublishOptions): ReadonlyArray<Operation> => {
  const command = (args: ReadonlyArray<string>) => CommandAction.make({
    command: noAuthCommand("git", ["-C", options.directory ?? ".", ...args])
  })
  const catalog = options.pipeId.replace(/^publish:/, "")
  const name = artifactPathBaseName(options.filePath)
  return [
    Operation.make({
      id: `${options.id}:add`, pipeId: options.pipeId, phase: "publish", risk: "writes-local",
      description: `Stage ${name} for ${catalog}.`,
      action: command(["add", catalogFilePath(options.filePath, options.directory)])
    }),
    Operation.make({
      id: `${options.id}:commit`, pipeId: options.pipeId, phase: "publish", risk: "writes-local",
      description: `Commit ${name} for ${catalog}.`,
      action: command(["commit", "-m", options.commitMessage])
    }),
    Operation.make({
      id: options.id, pipeId: options.pipeId, phase: "publish", risk: "externally-visible",
      description: options.description,
      action: command(["push"])
    })
  ]
}
