import {
  CommandAction,
  CommandSpec,
  NoteAction,
  Operation
} from "./operation.js"
import { artifactPathBaseName } from "./artifact.js"

export type DryRunSupport = "none" | "native" | "simulated"

export interface ReadOnlyCommandValidationOptions {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly command: CommandSpec
}

export interface DryRunValidationNoteOptions {
  readonly id: string
  readonly pipeId: string
  readonly dryRunSupport: Exclude<DryRunSupport, "native">
  readonly simulatedDescription: string
  readonly skippedDescription: string
  readonly simulatedMessage: string
  readonly skippedMessage: string
}

export interface DryRunValidationOperationOptions extends Omit<DryRunValidationNoteOptions, "dryRunSupport"> {
  readonly dryRunSupport: DryRunSupport
  readonly nativeDescription: string
  readonly command: CommandSpec
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

export const validationNoteOperation = (options: DryRunValidationNoteOptions): Operation =>
  Operation.make({
    id: options.id,
    pipeId: options.pipeId,
    phase: "publish",
    risk: "read-only",
    description: options.dryRunSupport === "simulated" ? options.simulatedDescription : options.skippedDescription,
    action: NoteAction.make({
      message: options.dryRunSupport === "simulated" ? options.simulatedMessage : options.skippedMessage,
      skipped: options.dryRunSupport === "none",
      severity: options.dryRunSupport === "simulated" ? "info" : "warning"
    })
  })

export const dryRunValidationOperation = (
  options: DryRunValidationOperationOptions
): Operation =>
  options.dryRunSupport === "native"
    ? readOnlyCommandValidationOperation({
      id: options.id,
      pipeId: options.pipeId,
      description: options.nativeDescription,
      command: options.command
    })
    : validationNoteOperation({
      id: options.id,
      pipeId: options.pipeId,
      dryRunSupport: options.dryRunSupport,
      simulatedDescription: options.simulatedDescription,
      skippedDescription: options.skippedDescription,
      simulatedMessage: options.simulatedMessage,
      skippedMessage: options.skippedMessage
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
