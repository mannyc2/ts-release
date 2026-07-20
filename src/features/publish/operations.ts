// Invariant: shared feature operation constructors preserve phase, risk, and action data exactly; pipeId is stamped by the planner.
import { artifactPathBaseName } from "../../grammar/artifact.js"
import { CommandAction, CommandSpec, NoteAction } from "../../grammar/operation.js"
import { featureOperation, type UnboundOperation } from "../../grammar/planner.js"

export const noAuthCommand = (executable: string, args: ReadonlyArray<string>): CommandSpec =>
  CommandSpec.make({ executable, args: [...args], requiredEnv: [], redactedEnv: [] })

export const readOnlyCommandValidationOperation = (options: {
  readonly id: string
  readonly description: string
  readonly command: CommandSpec
}): UnboundOperation => featureOperation({
  id: options.id,
  phase: "publish",
  risk: "read-only",
  description: options.description,
  action: CommandAction.make({ command: options.command })
})

export const validationNoteOperation = (options: {
  readonly id: string
  readonly description: string
  readonly message: string
}): UnboundOperation => featureOperation({
  id: options.id,
  phase: "publish",
  risk: "read-only",
  description: options.description,
  action: NoteAction.make({ message: options.message, skipped: false, severity: "info" })
})

export const trustedPublishingMessage = (options: {
  readonly target: string
  readonly publishCommand: string
  readonly validationCommand: string
  readonly provider: string
  readonly workflow: string
  readonly expectation: string
}): string =>
  `${options.target} trusted publishing authenticates during ${options.publishCommand} with CI OIDC; ${options.validationCommand} does not validate this mode. This target expects provider ${options.provider}, workflow ${options.workflow}, GitHub Actions permission id-token: write, and ${options.expectation}.`

export interface CatalogGitPublishOptions {
  readonly id: string
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

export const catalogGitPublishOperations = (options: CatalogGitPublishOptions): ReadonlyArray<UnboundOperation> => {
  const command = (args: ReadonlyArray<string>) => CommandAction.make({
    command: noAuthCommand("git", ["-C", options.directory ?? ".", ...args])
  })
  const catalog = "catalog"
  const name = artifactPathBaseName(options.filePath)
  return [
    featureOperation({
      id: `${options.id}:add`, phase: "publish", risk: "writes-local",
      description: `Stage ${name} for ${catalog}.`,
      action: command(["add", catalogFilePath(options.filePath, options.directory)])
    }),
    featureOperation({
      id: `${options.id}:commit`, phase: "publish", risk: "writes-local",
      description: `Commit ${name} for ${catalog}.`,
      action: command(["commit", "-m", options.commitMessage])
    }),
    featureOperation({
      id: options.id, phase: "publish", risk: "externally-visible",
      description: options.description,
      action: command(["push"])
    })
  ]
}
