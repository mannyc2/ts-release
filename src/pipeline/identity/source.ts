import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import type * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { parseJsonAs } from "../json.js"
import { CommandSpec } from "../operation.js"
import { ReleaseIdentity } from "../state.js"
import { normalizedName } from "../template.js"
import { IdentityError } from "../errors.js"


export class ResolvedIdentity extends Schema.Class<ResolvedIdentity>("ResolvedIdentity")({
  name: Schema.String,
  version: Schema.String,
  commit: Schema.String,
  tag: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  sourceId: Schema.String
}) {}

export interface WorkspaceCommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface WorkspaceCommandError {
  readonly reason: string
}

export interface WorkspaceCommandRunner {
  readonly runCommand: (
    command: CommandSpec
  ) => Effect.Effect<WorkspaceCommandResult, WorkspaceCommandError>
}

export interface WorkspaceServices {
  readonly fileSystem: FileSystem.FileSystem
  readonly path: Path.Path
  readonly commandRunner: WorkspaceCommandRunner
}

export interface VersionSource<Options> {
  readonly id: string
  readonly resolve: (
    options: Options,
    workspace: WorkspaceServices
  ) => Effect.Effect<ResolvedIdentity, IdentityError>
}

export type IdentityModifier = (identity: ResolvedIdentity) => ResolvedIdentity

export const identityError = (
  source: string,
  field: string,
  reason: string,
  cause?: unknown
): IdentityError =>
  IdentityError.make({
    source,
    field,
    reason,
    cause
  })

export const projectPackageName = (project: {
  readonly name?: string | undefined
  readonly package?: string | undefined
  readonly packageName?: string | undefined
}): string | undefined =>
  project.packageName ?? project.package ?? project.name

export const projectManifestPath = (packagePath: string | undefined): string =>
  packagePath === undefined || packagePath.endsWith("package.json")
    ? packagePath ?? "package.json"
    : `${packagePath.replace(/[/\\]+$/, "")}/package.json`

export const gitCommand = (root: string, args: ReadonlyArray<string>): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: [...args],
    cwd: root,
    requiredEnv: [],
    redactedEnv: []
  })

export const runWorkspaceGit = Effect.fn("pipeline.identity.runWorkspaceGit")(function*(
  workspace: WorkspaceServices,
  root: string,
  args: ReadonlyArray<string>,
  error: { readonly source: string; readonly field: string }
) {
  return yield* workspace.commandRunner.runCommand(gitCommand(root, args)).pipe(
    Effect.mapError((commandError) =>
      identityError(error.source, error.field, commandError.reason, commandError)
    )
  )
})

export const readPackageManifestJson = Effect.fn("pipeline.identity.readPackageManifestJson")(
  function*<A>(
    workspace: WorkspaceServices,
    root: string,
    packagePath: string,
    decode: (parsed: unknown) => Effect.Effect<A, { readonly message: string }>,
    error: { readonly source: string; readonly field: string; readonly requirement: string }
  ) {
    const readPath = workspace.path.resolve(root, packagePath)
    const contents = yield* workspace.fileSystem.readFileString(readPath).pipe(
      Effect.mapError((readError) =>
        identityError(error.source, error.field, readError.message, readError)
      )
    )
    const parsed = yield* parseJsonAs(
      Schema.Unknown,
      contents,
      (cause) =>
        identityError(error.source, error.field, "Package manifest is not valid JSON.", cause)
    )
    return yield* decode(parsed).pipe(
      Effect.mapError((decodeError) =>
        identityError(
          error.source,
          error.field,
          `Package manifest must include ${error.requirement}: ${decodeError.message}`
        )
      )
    )
  }
)

export const completeIdentity = (
  resolved: ResolvedIdentity,
  options: { readonly snapshot: boolean }
): ReleaseIdentity =>
  ReleaseIdentity.make({
    name: resolved.name,
    normalizedName: normalizedName(resolved.name),
    version: resolved.version,
    tag: resolved.tag ?? resolved.version,
    commit: resolved.commit,
    shortCommit: resolved.commit.slice(0, 7),
    notes: resolved.notes,
    versionSource: resolved.sourceId,
    snapshot: options.snapshot
  })
