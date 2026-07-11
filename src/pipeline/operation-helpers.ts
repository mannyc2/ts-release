import {
  CommandAction,
  CommandSpec,
  NoteAction,
  Operation
} from "./operation.js"
import { artifactPathBaseName } from "./artifact.js"

export interface ReadOnlyCommandValidationOptions {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly command: CommandSpec
}

export interface ValidationNoteOptions {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly message: string
}

export interface CatalogGitPublishOperationOptions {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly directory?: string | undefined
  readonly filePath: string
  readonly commitMessage: string
}

export const noAuthCommand = (
  executable: string,
  args: ReadonlyArray<string>
): CommandSpec =>
  CommandSpec.make({
    executable,
    args: [...args],
    requiredEnv: [],
    redactedEnv: []
  })

export const catalogPathBaseName = artifactPathBaseName

const catalogFilePath = (filePath: string, directory: string | undefined): string => {
  if (directory === undefined) {
    return filePath
  }
  const normalizedFilePath = filePath.replaceAll("\\", "/")
  const normalizedDirectory = directory.replaceAll("\\", "/").replace(/\/+$/, "")
  const prefix = `${normalizedDirectory}/`
  return normalizedFilePath.startsWith(prefix)
    ? normalizedFilePath.slice(prefix.length)
    : filePath
}

export const readOnlyCommandValidationOperation = (
  options: ReadOnlyCommandValidationOptions
): Operation =>
  Operation.make({
    id: options.id,
    pipeId: options.pipeId,
    phase: "publish",
    risk: "read-only",
    description: options.description,
    action: CommandAction.make({ command: options.command })
  })

// Simulated dry-run validations are reviewable notes: the plan states what a
// deterministic run cannot prove instead of pretending to validate it.
export const validationNoteOperation = (options: ValidationNoteOptions): Operation =>
  Operation.make({
    id: options.id,
    pipeId: options.pipeId,
    phase: "publish",
    risk: "read-only",
    description: options.description,
    action: NoteAction.make({
      message: options.message,
      skipped: false,
      severity: "info"
    })
  })

export const catalogGitPublishOperations = (
  options: CatalogGitPublishOperationOptions
): ReadonlyArray<Operation> => [
  Operation.make({
    id: `${options.id}:add`,
    pipeId: options.pipeId,
    phase: "publish",
    risk: "writes-local",
    description: `Stage ${catalogPathBaseName(options.filePath)} for ${options.pipeId.replace(/^publish:/, "")}.`,
    action: CommandAction.make({
      command: noAuthCommand("git", [
        "-C",
        options.directory ?? ".",
        "add",
        catalogFilePath(options.filePath, options.directory)
      ])
    })
  }),
  Operation.make({
    id: `${options.id}:commit`,
    pipeId: options.pipeId,
    phase: "publish",
    risk: "writes-local",
    description: `Commit ${catalogPathBaseName(options.filePath)} for ${options.pipeId.replace(/^publish:/, "")}.`,
    action: CommandAction.make({
      command: noAuthCommand("git", [
        "-C",
        options.directory ?? ".",
        "commit",
        "-m",
        options.commitMessage
      ])
    })
  }),
  Operation.make({
    id: options.id,
    pipeId: options.pipeId,
    phase: "publish",
    risk: "externally-visible",
    description: options.description,
    action: CommandAction.make({
      command: noAuthCommand("git", ["-C", options.directory ?? ".", "push"])
    })
  })
]
