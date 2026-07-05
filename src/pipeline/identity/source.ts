import type * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import type * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { CommandSpec } from "../operation.js"
import { ReleaseIdentity } from "../state.js"
import { normalizedName } from "../template.js"
import { IdentityError } from "../errors.js"


export class ResolvedIdentity extends Schema.Class<ResolvedIdentity>("ResolvedIdentity")({
  name: Schema.String,
  version: Schema.String,
  commit: Schema.String,
  tag: Schema.optionalKey(Schema.String),
  notes: Schema.optionalKey(Schema.String),
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
    ...(resolved.notes === undefined ? {} : { notes: resolved.notes }),
    versionSource: resolved.sourceId,
    snapshot: options.snapshot
  })
