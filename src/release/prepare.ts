import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync
} from "node:fs"
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path"
import { tmpdir } from "node:os"
import { tarGz, zip, type ArchiveEntry } from "../drivers/archive.js"
import { secureRead, secureWrite } from "../drivers/workspace.js"
import type { ExecutableIdentity, NetworkIsolationIdentity, RunCommand } from "../drivers/process.js"
import { encodeCanonicalJson } from "../model/canonical.js"
import {
  ArtifactCollectionMember,
  cardinalityAccepts,
  collectionMemberBytesIssue,
  collectionMemberId,
  collectionMemberPath,
  normalizeCollectionMemberKey,
  type ArtifactCollectionContract
} from "../model/artifact-collection.js"
import { sha256Digest } from "../model/digest.js"
import { NonEmptyName, SafeRelativePath, Version, WorkspaceRoot } from "../model/primitives.js"
import {
  ExplicitInputSnapshot,
  type StagingSnapshot,
  VerifiedReleaseContext
} from "./context.js"
import {
  GraphArchive,
  GraphChecksum,
  GraphCommandArtifact,
  GraphCommandCheck,
  GraphCommandCollection,
  GraphGitHubPublication,
  GraphNpmPackageBuild,
  GraphNpmPublication,
  OutputDeclaration,
  type GraphPreparation,
  ReleaseGraph
} from "./graph.js"
import {
  PreparedArtifact,
  PreparedArtifactCollection,
  PreparedExecutionInputs,
  PreparedGitHubPublication,
  PreparedNpmPublication,
  PreparedProject,
  PreparedProvenance,
  PreparedReleaseV2,
  PreparedSource
} from "./prepared.js"
import { CompletePreparedReleaseRef } from "./prepared-ref.js"
import {
  PreparedCommitHandoffError,
  PreparedStoreError,
  type PreparedReleaseStoreShape
} from "./prepared-store.js"
import {
  assertSnapshotPresent,
  materializeExplicitInput,
  preparationBasisDigest,
  selectStagingSnapshot,
  snapshotDifference,
  snapshotStaging,
  snapshotsEqual
} from "./staging.js"

export class PreparationError
  extends Schema.TaggedErrorClass<PreparationError>()("PreparationError", {
    reason: Schema.String,
    prepared: Schema.optionalKey(CompletePreparedReleaseRef)
  }) {}

export interface PreparationRequest {
  readonly context: VerifiedReleaseContext
  readonly graph: ReleaseGraph
  readonly store: PreparedReleaseStoreShape
  readonly run: RunCommand
  /** Exact Git-object materializer from the source-repository boundary. */
  readonly materializeSource: (
    context: VerifiedReleaseContext,
    destination: WorkspaceRoot
  ) => Effect.Effect<StagingSnapshot, unknown>
}

type Bytes = Map<string, Uint8Array>
type Producers = Map<string, string>
type Declarations = Map<string, ReleaseGraph["artifacts"][number]>

interface DependencyMaterialization {
  readonly input: ExplicitInputSnapshot
  readonly bunVersion: string
}

const failure = (cause: unknown): PreparationError => PreparationError.make({
  reason: cause instanceof PreparedCommitHandoffError
    ? cause.reason
    : cause instanceof Error
    ? cause.message
    : String(cause),
  ...(cause instanceof PreparedCommitHandoffError ? { prepared: cause.prepared } : {})
})

const attempt = <A>(body: () => A): Effect.Effect<A, PreparationError> => Effect.try({
  try: body,
  catch: failure
})

const materializeBunDependencies = Effect.fn("materializeBunDependencies")(function*(input: {
  readonly request: PreparationRequest
  readonly sourceWorkspace: string
  readonly sourceSnapshot: StagingSnapshot
}) {
  const requiresBun = input.request.graph.preparations.some((preparation) =>
    (preparation._tag === "GraphCommandCheck" || preparation._tag === "GraphCommandArtifact" ||
      preparation._tag === "GraphCommandCollection" || preparation._tag === "GraphNpmPackageBuild") &&
    preparation.argv[0] === "bun")
  if (!requiresBun) return undefined

  const lockfiles = input.sourceSnapshot.entries.filter((entry) =>
    (entry.path.toString() === "bun.lock" || entry.path.toString() === "bun.lockb") &&
    (entry.kind === "file" || entry.kind === "executable"))
  if (lockfiles.length !== 1) {
    return yield* new PreparationError({
      reason: "Bun preparation requires exactly one tracked root bun.lock or bun.lockb for isolated dependency materialization."
    })
  }
  if (input.sourceSnapshot.entries.some((entry) => entry.path.toString().split("/").includes("node_modules"))) {
    return yield* new PreparationError({ reason: "Verified Git source must not contain a tracked node_modules tree." })
  }

  const stageRoot = input.request.context.workspace.toString()
  const dependencyPath = SafeRelativePath.make("node_modules")
  const stageDependencies = join(stageRoot, dependencyPath)
  if (existsSync(stageDependencies)) {
    return yield* new PreparationError({ reason: "Private dependency destination already exists before isolated install." })
  }
  const before = yield* attempt(() => snapshotStaging(stageRoot, { exclude: [dependencyPath] }))
  const versionOutcome = yield* input.request.run({
    argv: ["bun", "--version"],
    cwd: stageRoot,
    environmentNames: [],
    network: "offline-cli"
  }).pipe(Effect.mapError(failure))
  const bunVersion = versionOutcome.stdout.trim()
  if (versionOutcome.exitCode !== 0 || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(bunVersion)) {
    return yield* new PreparationError({
      reason: `Unable to establish the exact Bun dependency materializer version: ${versionOutcome.stderr.trim()}`
    })
  }

  const outcome = yield* input.request.run({
    argv: ["bun", "install", "--offline", "--frozen-lockfile", "--ignore-scripts", "--no-save"],
    cwd: stageRoot,
    environmentNames: [],
    network: "offline-cli"
  }).pipe(Effect.mapError(failure))
  if (outcome.exitCode !== 0) {
    return yield* new PreparationError({
      reason: `Isolated Bun dependency install exited ${outcome.exitCode}: ${outcome.stderr.trim()}`
    })
  }
  if (!existsSync(stageDependencies)) yield* attempt(() => mkdirSync(stageDependencies, { mode: 0o700 }))
  yield* attempt(() => {
    if (lstatSync(stageDependencies).isSymbolicLink() || !lstatSync(stageDependencies).isDirectory() ||
        !contained(stageRoot, realpathSync(stageDependencies))) {
      throw new Error("Isolated Bun install did not produce a real dependency directory inside private staging.")
    }
    assertNoWorkspaceInodeAliases(stageDependencies, join(input.sourceWorkspace, "node_modules"))
  })
  const wholeStage = yield* attempt(() => snapshotStaging(stageRoot))
  const dependencySnapshot = selectStagingSnapshot(wholeStage, [dependencyPath])
  const after = yield* attempt(() => snapshotStaging(stageRoot, { exclude: [dependencyPath] }))
  if (!snapshotsEqual(before, after)) {
    return yield* new PreparationError({
      reason: `Isolated Bun install changed source or wrote an undeclared cache: ${snapshotDifference(before, after)}.`
    })
  }
  yield* attempt(() => assertSnapshotPresent(stageRoot, input.sourceSnapshot, "Verified source"))
  const lockfile = lockfiles[0]!
  const toolDigest = sha256Digest(new TextEncoder().encode(`bun@${bunVersion}`))
  return {
    bunVersion,
    input: ExplicitInputSnapshot.make({
      id: `isolated-bun-dependencies@${bunVersion}`,
      path: dependencyPath,
      kind: "directory",
      size: dependencySnapshot.entries
        .filter((entry) => entry.kind !== "directory")
        .reduce((sum, entry) => sum + entry.size, 0),
      digest: dependencySnapshot.digest,
      materializer: `bun@${bunVersion}:install--offline--frozen-lockfile--ignore-scripts`,
      materializationBasis: [lockfile.digest, toolDigest]
    })
  } satisfies DependencyMaterialization
})

const byCodepoint = (left: { readonly id: { toString(): string } }, right: { readonly id: { toString(): string } }): number => {
  const a = left.id.toString(); const b = right.id.toString()
  return a < b ? -1 : a > b ? 1 : 0
}

const pathOf = (context: VerifiedReleaseContext, path: SafeRelativePath): string =>
  join(context.workspace, path)

const contained = (root: string, path: string): boolean => {
  const value = relative(root, path)
  return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value))
}

const portablePathsOverlap = (left: string, right: string): boolean => {
  const a = left.toLocaleLowerCase("en-US")
  const b = right.toLocaleLowerCase("en-US")
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
}

const inodeKey = (path: string): string | undefined => {
  const stat = lstatSync(path, { bigint: true })
  return stat.isFile() ? `${stat.dev}:${stat.ino}` : undefined
}

const fileInodes = (root: string): ReadonlySet<string> => {
  const result = new Set<string>()
  if (!existsSync(root)) return result
  const walk = (path: string): void => {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) return
    const identity = inodeKey(path)
    if (identity !== undefined) result.add(identity)
    if (stat.isDirectory()) for (const entry of readdirSync(path)) walk(join(path, entry))
  }
  walk(root)
  return result
}

const assertNoWorkspaceInodeAliases = (stageDependencies: string, workspaceDependencies: string): void => {
  const workspaceInodes = fileInodes(workspaceDependencies)
  if (workspaceInodes.size === 0) return
  const walk = (path: string): void => {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) return
    const identity = inodeKey(path)
    if (identity !== undefined && workspaceInodes.has(identity)) {
      throw new Error(`Isolated dependency path ${relative(stageDependencies, path) || "."} aliases a workspace inode.`)
    }
    if (stat.isDirectory()) for (const entry of readdirSync(path)) walk(join(path, entry))
  }
  walk(stageDependencies)
}

const hashBytes = (algorithm: "sha256" | "sha512", bytes: Uint8Array): string =>
  createHash(algorithm).update(bytes).digest("hex")

const stagedContext = (context: VerifiedReleaseContext, root: string): VerifiedReleaseContext =>
  VerifiedReleaseContext.make({
    workspace: WorkspaceRoot.make(root),
    source: context.source,
    package: context.package
  })

const capture = (
  context: VerifiedReleaseContext,
  declaration: Pick<ReleaseGraph["artifacts"][number], "id" | "path" | "kind">
): Effect.Effect<Uint8Array, PreparationError> => attempt(() => {
  if (declaration.kind === "package") {
    throw new Error(`Directory output ${declaration.id} cannot enter a blob store.`)
  }
  return new Uint8Array(secureRead(context.workspace, declaration.path).bytes)
})

const replaceReferences = (
  value: string,
  inputs: ReadonlyArray<ReleaseGraph["artifacts"][number]>,
  outputs: ReadonlyArray<ReleaseGraph["artifacts"][number]>,
  collection?: ArtifactCollectionContract
): string => value.replace(/\{(input|output|collection):([^}]+)\}/gu, (_match, direction: string, id: string) => {
  if (direction === "collection") {
    if (collection === undefined || collection.id.toString() !== id) {
      throw new Error(`Unresolved command collection reference collection:${id}.`)
    }
    return collection.root.toString()
  }
  const declarations = direction === "input" ? inputs : outputs
  const declaration = declarations.find((candidate) => candidate.id.toString() === id)
  if (declaration === undefined) throw new Error(`Unresolved command path reference ${direction}:${id}.`)
  return declaration.path.toString()
})

const assertCommandContract = (
  stageRoot: string,
  preparation: GraphCommandCheck | GraphCommandArtifact | GraphCommandCollection,
  inputs: ReadonlyArray<ReleaseGraph["artifacts"][number]>,
  outputs: ReadonlyArray<ReleaseGraph["artifacts"][number]>,
  sourceSnapshot: StagingSnapshot,
  explicitInputs: ReadonlyArray<ExplicitInputSnapshot>
): void => {
  const cwd = resolve(stageRoot, preparation.cwd.toString())
  if (!contained(stageRoot, cwd) || !existsSync(cwd) || lstatSync(cwd).isSymbolicLink() || !lstatSync(cwd).isDirectory()) {
    throw new Error(`Command ${preparation.id} cwd escapes private staging or is not a real directory.`)
  }
  const collectionRoot = preparation._tag === "GraphCommandCollection"
    ? preparation.collection.root.toString()
    : undefined
  const roots = [...inputs.map((item) => ["input", item.path.toString()] as const),
    ...outputs.map((item) => ["output", item.path.toString()] as const),
    ...(collectionRoot === undefined ? [] : [["collection", collectionRoot] as const])]
  for (const [kind, path] of roots) {
    const resolved = resolve(stageRoot, path)
    if (!contained(stageRoot, resolved)) throw new Error(`Command ${preparation.id} ${kind} root ${path} escapes private staging.`)
  }
  const writablePaths = [...outputs.map((output) => output.path.toString()),
    ...(collectionRoot === undefined ? [] : [collectionRoot])]
  for (const outputPath of writablePaths) {
    const sourceOverlap = sourceSnapshot.entries.find((entry) =>
      portablePathsOverlap(entry.path.toString(), outputPath))
    if (sourceOverlap !== undefined) {
      throw new Error(`Command ${preparation.id} writable root ${outputPath} overlaps verified source ${sourceOverlap.path}.`)
    }
    const explicitOverlap = explicitInputs.find((input) =>
      portablePathsOverlap(input.path.toString(), outputPath))
    if (explicitOverlap !== undefined) {
      throw new Error(`Command ${preparation.id} writable root ${outputPath} overlaps explicit input ${explicitOverlap.id}.`)
    }
    for (const input of inputs) {
      const a = outputPath; const b = input.path.toString()
      if (portablePathsOverlap(a, b)) {
        throw new Error(`Command ${preparation.id} writable root ${a} overlaps read-only input ${b}.`)
      }
    }
  }
  for (let index = 0; index < writablePaths.length; index += 1) {
    for (const other of writablePaths.slice(index + 1)) {
      const a = writablePaths[index]!; const b = other
      if (portablePathsOverlap(a, b)) {
        throw new Error(`Command ${preparation.id} has ambiguous overlapping outputs ${a} and ${b}.`)
      }
    }
  }
  if (collectionRoot !== undefined && existsSync(resolve(stageRoot, collectionRoot))) {
    throw new Error(`Command ${preparation.id} collection root ${collectionRoot} must not exist before its producer runs.`)
  }
}

interface CommandExecutionResult {
  readonly outputs: ReadonlyArray<readonly [string, Uint8Array]>
  readonly declarations: ReadonlyArray<OutputDeclaration>
  readonly collection?: PreparedArtifactCollection
  readonly networkIsolation?: NetworkIsolationIdentity
}

const assertRealDirectoryTree = (stageRoot: string, root: SafeRelativePath): void => {
  const location = resolve(stageRoot, root.toString())
  if (!contained(stageRoot, location) || !existsSync(location) || lstatSync(location).isSymbolicLink() ||
      !lstatSync(location).isDirectory() || !contained(stageRoot, realpathSync(location))) {
    throw new Error(`npm package build output root ${root} is missing, linked, or outside private staging.`)
  }
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) throw new Error(`npm package build output ${relative(stageRoot, path)} is a forbidden symlink.`)
      if (!contained(stageRoot, realpathSync(path))) throw new Error(`npm package build output ${relative(stageRoot, path)} escapes private staging.`)
      if (stat.isDirectory()) walk(path)
      else if (!stat.isFile()) throw new Error(`npm package build output ${relative(stageRoot, path)} has an unsupported filesystem kind.`)
    }
  }
  walk(location)
}

const runNpmPackageBuild = (
  request: PreparationRequest,
  preparation: GraphNpmPackageBuild,
  sourceSnapshot: StagingSnapshot,
  explicitInputs: ReadonlyArray<ExplicitInputSnapshot>
): Effect.Effect<CommandExecutionResult, PreparationError> => {
  const stageRoot = request.context.workspace.toString()
  const writable = preparation.outputRoots
  const cleanup = (): void => {
    for (const root of writable) rmSync(resolve(stageRoot, root.toString()), { recursive: true, force: true })
  }
  return Effect.gen(function*() {
    const cwd = resolve(stageRoot, preparation.cwd.toString())
    if (!contained(stageRoot, cwd) || !existsSync(cwd) || lstatSync(cwd).isSymbolicLink() || !lstatSync(cwd).isDirectory()) {
      return yield* new PreparationError({ reason: "npm package build cwd is not a real directory inside private staging." })
    }
    yield* attempt(() => {
      for (const root of writable) {
        if (sourceSnapshot.entries.some((entry) => portablePathsOverlap(entry.path.toString(), root.toString()))) {
          throw new Error(`npm package build output root ${root} overlaps verified source.`)
        }
        if (explicitInputs.some((input) => portablePathsOverlap(input.path.toString(), root.toString()))) {
          throw new Error(`npm package build output root ${root} overlaps explicit input.`)
        }
        if (existsSync(resolve(stageRoot, root.toString()))) {
          throw new Error(`npm package build output root ${root} must be initially absent.`)
        }
      }
      assertSnapshotPresent(stageRoot, sourceSnapshot, "Verified source", { exclude: writable })
    })
    const before = yield* attempt(() => snapshotStaging(stageRoot, { exclude: writable }))
    const outcome = yield* request.run({
      argv: preparation.argv,
      cwd,
      environmentNames: [],
      network: "deny"
    }).pipe(Effect.mapError(failure))
    if (outcome.exitCode !== 0) {
      return yield* new PreparationError({
        reason: `npm package build exited ${outcome.exitCode}: ${outcome.stderr.trim()}`
      })
    }
    const after = yield* attempt(() => snapshotStaging(stageRoot, { exclude: writable }))
    if (!snapshotsEqual(before, after)) {
      return yield* new PreparationError({
        reason: `npm package build changed undeclared staged paths: ${snapshotDifference(before, after)}.`
      })
    }
    yield* attempt(() => {
      for (const root of writable) assertRealDirectoryTree(stageRoot, root)
      assertSnapshotPresent(stageRoot, sourceSnapshot, "Verified source", { exclude: writable })
    })
    return {
      outputs: [], declarations: [],
      ...(outcome.networkIsolation === undefined ? {} : { networkIsolation: outcome.networkIsolation })
    }
  }).pipe(
    Effect.onError(() => Effect.sync(cleanup))
  )
}

const discoverCollection = (
  context: VerifiedReleaseContext,
  contract: ArtifactCollectionContract
): CommandExecutionResult => {
  const stageRoot = context.workspace.toString()
  const root = resolve(stageRoot, contract.root.toString())
  if (!contained(stageRoot, root) || !existsSync(root) || lstatSync(root).isSymbolicLink() ||
      !lstatSync(root).isDirectory() || !contained(stageRoot, realpathSync(root))) {
    throw new Error(`Artifact collection ${contract.id} root ${contract.root} is missing, linked, or outside private staging.`)
  }
  const rows: Array<{
    readonly key: SafeRelativePath
    readonly declaration: OutputDeclaration
    readonly bytes: Uint8Array
  }> = []
  const foldedKeys = new Map<string, string>()
  const ids = new Set<string>()
  const walk = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
      const rawKey = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`
      const key = normalizeCollectionMemberKey(rawKey)
      const folded = key.toString().toLocaleLowerCase("en-US")
      const previous = foldedKeys.get(folded)
      if (previous !== undefined) {
        throw new Error(`Artifact collection ${contract.id} paths ${previous} and ${key} collide under portable case folding.`)
      }
      foldedKeys.set(folded, key.toString())
      const location = join(directory, entry.name)
      const stat = lstatSync(location)
      if (stat.isSymbolicLink()) {
        throw new Error(`Artifact collection ${contract.id} member ${key} is a forbidden symlink.`)
      }
      if (!contained(stageRoot, realpathSync(location))) {
        throw new Error(`Artifact collection ${contract.id} member ${key} escapes private staging.`)
      }
      if (stat.isDirectory()) {
        walk(location, key.toString())
        continue
      }
      if (!stat.isFile()) {
        throw new Error(`Artifact collection ${contract.id} member ${key} has an unsupported filesystem kind.`)
      }
      if (!key.toString().endsWith(contract.pathSuffix.toString())) {
        throw new Error(
          `Artifact collection ${contract.id} member ${key} does not match declared pathSuffix ${contract.pathSuffix}.`
        )
      }
      const executable = (stat.mode & 0o111) !== 0
      if ((contract.artifactKind === "executable") !== executable) {
        throw new Error(
          `Artifact collection ${contract.id} member ${key} does not match declared kind ${contract.artifactKind}.`
        )
      }
      const artifactId = collectionMemberId(contract, key)
      if (ids.has(artifactId.toString())) {
        throw new Error(`Artifact collection ${contract.id} repeats stable artifact id ${artifactId}.`)
      }
      ids.add(artifactId.toString())
      const declaration = OutputDeclaration.make({
        id: artifactId,
        path: collectionMemberPath(contract, key),
        kind: contract.artifactKind,
        mediaType: contract.mediaType
      })
      const bytes = new Uint8Array(secureRead(stageRoot, declaration.path).bytes)
      const bytesIssue = collectionMemberBytesIssue(contract, bytes)
      if (bytesIssue !== undefined) {
        throw new Error(`Artifact collection ${contract.id} member ${key}: ${bytesIssue}.`)
      }
      rows.push({ key, declaration, bytes })
    }
  }
  walk(root, "")
  rows.sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
  if (!cardinalityAccepts(contract.cardinality, rows.length)) {
    throw new Error(
      `Artifact collection ${contract.id} discovered ${rows.length} members outside its declared cardinality.`
    )
  }
  return {
    outputs: rows.map((row) => [row.declaration.id.toString(), row.bytes] as const),
    declarations: rows.map((row) => row.declaration),
    collection: PreparedArtifactCollection.make({
      contract,
      members: rows.map((row) => ArtifactCollectionMember.make({
        key: row.key,
        artifactId: row.declaration.id
      }))
    })
  }
}

const runCommand = (
  request: PreparationRequest,
  preparation: GraphCommandCheck | GraphCommandArtifact | GraphCommandCollection,
  declarations: Declarations,
  sourceSnapshot: StagingSnapshot,
  explicitInputs: ReadonlyArray<ExplicitInputSnapshot>
): Effect.Effect<CommandExecutionResult, PreparationError> => Effect.gen(function*() {
  const inputs = preparation.inputs.map((id) => declarations.get(id.toString()) ?? (() => {
    throw new Error(`Missing input ${id}.`)
  })())
  const outputs = preparation._tag === "GraphCommandArtifact" ? preparation.outputs : []
  const collection = preparation._tag === "GraphCommandCollection" ? preparation.collection : undefined
  yield* attempt(() => assertCommandContract(
    request.context.workspace,
    preparation,
    inputs,
    outputs,
    sourceSnapshot,
    explicitInputs
  ))
  const writable = [...outputs.map((output) => output.path),
    ...(collection === undefined ? [] : [collection.root])]
  // Every verified source and explicit-input byte remains immutable unless it
  // is beneath a declared output root. Checks have no persistent writable root.
  yield* attempt(() => {
    assertSnapshotPresent(request.context.workspace, sourceSnapshot, "Verified source", { exclude: writable })
    for (const input of explicitInputs) {
      const location = join(request.context.workspace, input.path.toString())
      if (!existsSync(location) || lstatSync(location).isSymbolicLink()) {
        throw new Error(`Explicit input ${input.id} is missing or no longer private.`)
      }
    }
  })
  const before = yield* attempt(() => snapshotStaging(request.context.workspace, { exclude: writable }))
  const argv = preparation.argv.map((part) => replaceReferences(part, inputs, outputs, collection))
  const outcome = yield* request.run({
    argv,
    cwd: pathOf(request.context, preparation.cwd),
    environmentNames: [],
    network: "deny"
  }).pipe(Effect.mapError(failure))
  if (outcome.exitCode !== 0) {
    return yield* new PreparationError({
      reason: `Command ${preparation.id} exited ${outcome.exitCode}: ${outcome.stderr.trim()}`
    })
  }
  const after = yield* attempt(() => snapshotStaging(request.context.workspace, { exclude: writable }))
  if (!snapshotsEqual(before, after)) {
    return yield* new PreparationError({
      reason: `Command ${preparation.id} changed undeclared staged paths: ${snapshotDifference(before, after)}. ` +
        "Declare persistent bytes as command outputs; caches and scratch must not live in the staged source tree."
    })
  }
  yield* attempt(() => assertSnapshotPresent(request.context.workspace, sourceSnapshot, "Verified source", { exclude: writable }))
  if (preparation._tag === "GraphCommandCheck") return {
    outputs: [], declarations: [],
    ...(outcome.networkIsolation === undefined ? {} : { networkIsolation: outcome.networkIsolation })
  }
  if (preparation._tag === "GraphCommandCollection") {
    const discovered = yield* attempt(() => discoverCollection(request.context, preparation.collection))
    return {
      ...discovered,
      ...(outcome.networkIsolation === undefined ? {} : { networkIsolation: outcome.networkIsolation })
    }
  }
  const produced: Array<[string, Uint8Array]> = []
  for (const output of outputs) {
    produced.push([output.id.toString(), yield* capture(request.context, output)])
  }
  return {
    outputs: produced, declarations: [],
    ...(outcome.networkIsolation === undefined ? {} : { networkIsolation: outcome.networkIsolation })
  }
})

const structured = (
  request: PreparationRequest,
  preparation: GraphPreparation,
  declarations: Declarations,
  bytes: Bytes,
  sourceSnapshot: StagingSnapshot,
  explicitInputs: ReadonlyArray<ExplicitInputSnapshot>
): Effect.Effect<CommandExecutionResult, PreparationError> => {
  switch (preparation._tag) {
    case "GraphCommandCheck":
    case "GraphCommandArtifact":
    case "GraphCommandCollection":
      return runCommand(request, preparation, declarations, sourceSnapshot, explicitInputs)
    case "GraphNpmPackageBuild":
      return runNpmPackageBuild(request, preparation, sourceSnapshot, explicitInputs)
    case "GraphArchive":
      return attempt(() => {
        assertSnapshotPresent(request.context.workspace, sourceSnapshot, "Verified source")
        const entries: ArchiveEntry[] = preparation.inputs.map((id) => {
          const declaration = declarations.get(id.toString())
          const value = bytes.get(id.toString())
          if (declaration === undefined || value === undefined) {
            throw new Error(`Archive ${preparation.id} references unavailable artifact ${id}.`)
          }
          return {
            path: basename(declaration.path),
            data: value,
            mode: declaration.kind === "executable" ? 0o100755 : 0o100644
          }
        }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
        if (entries.length === 0) throw new Error(`Archive ${preparation.id} has no inputs.`)
        if (new Set(entries.map((entry) => entry.path)).size !== entries.length) {
          throw new Error(`Archive ${preparation.id} contains duplicate normalized member names.`)
        }
        const value = preparation.format === "zip" ? zip(entries) : tarGz(entries)
        secureWrite(request.context.workspace, preparation.output.path, value)
        assertSnapshotPresent(request.context.workspace, sourceSnapshot, "Verified source")
        return { outputs: [[preparation.output.id.toString(), value]], declarations: [] }
      })
    case "GraphChecksum":
      return attempt(() => {
        assertSnapshotPresent(request.context.workspace, sourceSnapshot, "Verified source")
        const lines = preparation.inputs.map((id) => {
          const value = bytes.get(id.toString())
          const declaration = declarations.get(id.toString())
          if (value === undefined || declaration === undefined) {
            throw new Error(`Checksum ${preparation.id} references unavailable artifact ${id}.`)
          }
          return `${hashBytes(preparation.algorithm, value)}  ${basename(declaration.path)}`
        })
        const value = new TextEncoder().encode(`${lines.join("\n")}\n`)
        secureWrite(request.context.workspace, preparation.output.path, value)
        assertSnapshotPresent(request.context.workspace, sourceSnapshot, "Verified source")
        return { outputs: [[preparation.output.id.toString(), value]], declarations: [] }
      })
  }
}

interface NpmPackFile {
  readonly path: string
  readonly size: number
  readonly mode: number
}

const assertNpmLiteralSelectionsPresent = (packageRoot: string): void => {
  const manifestPath = join(packageRoot, "package.json")
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("npm package manifest root must be an object.")
  }
  const files = (parsed as { readonly files?: unknown }).files
  if (files === undefined) return
  if (!Array.isArray(files) || files.some((entry) => typeof entry !== "string")) {
    throw new Error("npm package files must be an array of strings.")
  }
  for (const entry of files as ReadonlyArray<string>) {
    const normalized = entry.replace(/^\.\//u, "").replace(/\/$/u, "")
    // Glob and exclusion semantics are certified by npm's reported file list;
    // exact selections must already exist in private staging.
    if (normalized.startsWith("!") || /[*?\[\]{}]/u.test(normalized)) continue
    const safe = SafeRelativePath.make(normalized)
    const selected = resolve(packageRoot, safe.toString())
    if (!contained(packageRoot, selected) || !existsSync(selected) || lstatSync(selected).isSymbolicLink()) {
      throw new Error(
        `npm literal package selection ${entry} is absent from verified staging; declare non-Git bytes as an explicit input.`
      )
    }
  }
}

const decodeNpmPackFiles = (stdout: string): ReadonlyArray<NpmPackFile> => {
  let value: unknown
  try { value = JSON.parse(stdout) } catch { throw new Error("npm pack --json did not return valid JSON.") }
  if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== "object" || value[0] === null) {
    throw new Error("npm pack --json must report exactly one package.")
  }
  const files = (value[0] as { readonly files?: unknown }).files
  if (!Array.isArray(files) || files.length === 0) throw new Error("npm pack reported no selected package files.")
  const decoded = files.map((file): NpmPackFile => {
    if (typeof file !== "object" || file === null) throw new Error("npm pack reported a malformed file entry.")
    const item = file as Record<string, unknown>
    if (typeof item.path !== "string" || !SafeRelativePath.make(item.path) ||
        !Number.isSafeInteger(item.size) || (item.size as number) < 0 || !Number.isSafeInteger(item.mode)) {
      throw new Error("npm pack reported a malformed file path, size, or mode.")
    }
    return { path: item.path, size: item.size as number, mode: item.mode as number }
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  if (new Set(decoded.map((file) => file.path.toLocaleLowerCase("en-US"))).size !== decoded.length) {
    throw new Error("npm package file list contains a duplicate or case-colliding normalized path.")
  }
  return decoded
}

interface NpmPackIdentity {
  readonly protocol: "ts-release-npm-pack/v1"
  readonly version: string
  readonly executable: ExecutableIdentity
  readonly flags: ReadonlyArray<string>
}

const npmPackFlags = ["--json", "--offline", "--ignore-scripts", "--pack-destination", "{destination}", "--cache", "{cache}"] as const

const sameExecutable = (left: ExecutableIdentity | undefined, right: ExecutableIdentity): boolean =>
  left?.protocol === right.protocol && left.command === right.command && left.sha256 === right.sha256

const establishNpmPackIdentity = (
  request: PreparationRequest
): Effect.Effect<NpmPackIdentity, PreparationError> => Effect.gen(function*() {
  const outcome = yield* request.run({
    argv: ["npm", "--version"],
    cwd: request.context.workspace.toString(),
    environmentNames: [],
    network: "offline-cli"
  }).pipe(Effect.mapError(failure))
  const version = outcome.stdout.trim()
  if (outcome.exitCode !== 0 || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)) {
    return yield* new PreparationError({
      reason: `Unable to establish the exact npm pack version: ${outcome.stderr.trim()}`
    })
  }
  if (outcome.tool?.protocol !== "ts-release-executable/v1" || outcome.tool.command !== "npm" ||
      !/^[a-f0-9]{64}$/u.test(outcome.tool.sha256)) {
    return yield* new PreparationError({ reason: "npm --version did not report an exact executable identity." })
  }
  return {
    protocol: "ts-release-npm-pack/v1",
    version,
    executable: outcome.tool,
    flags: npmPackFlags
  }
})

const npmTarball = (
  request: PreparationRequest,
  publication: GraphNpmPublication,
  declarations: Declarations,
  sourceSnapshot: StagingSnapshot,
  basis: ReturnType<typeof preparationBasisDigest>,
  npmPackIdentity: NpmPackIdentity
): Effect.Effect<PreparedArtifact, PreparationError> => Effect.gen(function*() {
  const packageId = publication.packageArtifact
  const packageDeclaration = declarations.get(packageId.toString())
  if (packageDeclaration?.kind !== "package") {
    return yield* new PreparationError({
      reason: `npm publication ${publication.id} does not reference its declared package artifact.`
    })
  }
  yield* attempt(() => assertNpmLiteralSelectionsPresent(resolve(
    request.context.workspace,
    packageDeclaration.path.toString()
  )))
  assertSnapshotPresent(request.context.workspace, sourceSnapshot, "Verified source")
  const destination = SafeRelativePath.make(`.release/ts-release/npm/${publication.id}`)
  const cache = SafeRelativePath.make(`.release/ts-release/npm-cache/${publication.id}`)
  mkdirSync(join(request.context.workspace, destination), { recursive: true })
  mkdirSync(join(request.context.workspace, cache), { recursive: true })
  if (readdirSync(join(request.context.workspace, destination)).length > 0) {
    return yield* new PreparationError({ reason: `npm publication ${publication.id} has a non-empty output directory.` })
  }
  const allowed = [destination, cache]
  const before = yield* attempt(() => snapshotStaging(request.context.workspace, { exclude: allowed }))
  const outcome = yield* request.run({
    argv: ["npm", "pack", packageDeclaration.path.toString(), "--json", "--offline", "--ignore-scripts", "--pack-destination", destination, "--cache", cache],
    cwd: request.context.workspace,
    environmentNames: [],
    network: "offline-cli"
  }).pipe(Effect.mapError(failure))
  if (!sameExecutable(outcome.tool, npmPackIdentity.executable)) {
    return yield* new PreparationError({
      reason: "npm pack executable identity disagrees with the preflighted npm executable."
    })
  }
  if (outcome.exitCode !== 0) {
    return yield* new PreparationError({ reason: `npm pack exited ${outcome.exitCode}: ${outcome.stderr.trim()}` })
  }
  const after = yield* attempt(() => snapshotStaging(request.context.workspace, { exclude: allowed }))
  if (!snapshotsEqual(before, after)) {
    return yield* new PreparationError({
      reason: `npm pack changed package source outside its private output/cache roots: ${snapshotDifference(before, after)}.`
    })
  }
  assertSnapshotPresent(request.context.workspace, sourceSnapshot, "Verified source", { exclude: allowed })
  const packageFiles = yield* attempt(() => decodeNpmPackFiles(outcome.stdout))
  for (const file of packageFiles) {
    const selected = resolve(request.context.workspace, packageDeclaration.path.toString(), file.path)
    if (!contained(request.context.workspace, selected) || !existsSync(selected) || lstatSync(selected).isSymbolicLink() ||
        !lstatSync(selected).isFile() || lstatSync(selected).size !== file.size) {
      return yield* new PreparationError({
        reason: `npm selected undeclared, escaped, linked, or size-mismatched package file ${file.path}.`
      })
    }
  }
  const outputEntries = readdirSync(join(request.context.workspace, destination), { withFileTypes: true })
  if (outputEntries.length !== 1 || !outputEntries[0]!.isFile() || !outputEntries[0]!.name.endsWith(".tgz")) {
    return yield* new PreparationError({ reason: "npm pack produced an invalid output directory." })
  }
  const path = SafeRelativePath.make(`${destination}/${outputEntries[0]!.name}`)
  const artifactBytes = yield* capture(request.context, { id: packageId, path, kind: "archive" })
  const digest = sha256Digest(artifactBytes)
  return PreparedArtifact.make({
    id: packageId,
    path,
    kind: "archive",
    size: artifactBytes.length,
    digest,
    blob: digest,
    mediaType: "application/gzip",
    producer: NonEmptyName.make(`npm-pack:${publication.id}`),
    inputBasis: basis
  })
})

const runtimeIdentity = (
  bunVersion: string | undefined,
  isolation: NetworkIsolationIdentity | undefined,
  npmPack: NpmPackIdentity | undefined,
  releaseGraph: ReturnType<typeof sha256Digest>
): PreparedExecutionInputs => PreparedExecutionInputs.make({
  environment: "closed",
  network: "prohibited",
  timezone: "UTC",
  locale: "C",
  clock: "source-date-epoch=0;host-clock-not-isolated",
  randomness: "host-randomness-not-isolated",
  platform: `${process.platform}-${process.arch}`,
  runtime: bunVersion === undefined ? `bun@${process.versions.bun}` : `bun@${bunVersion}`,
  networkIsolation: isolation === undefined
    ? "host-provided-network-deny/no-helper-identity"
    : encodeCanonicalJson(isolation),
  npmPack: npmPack === undefined ? "not-used" : encodeCanonicalJson(npmPack),
  releaseGraph,
  preparer: "@mannyc1/ts-release@0.2.0"
})

export const prepareRelease = Effect.fn("prepareRelease")(function*(input: PreparationRequest) {
  const sourceRoot = input.context.workspace.toString()
  const root = yield* attempt(() => mkdtempSync(join(tmpdir(), "ts-release-prepare-")))
  try {
    const sourceSnapshot = yield* input.materializeSource(input.context, WorkspaceRoot.make(root)).pipe(Effect.mapError(failure))
    const context = stagedContext(input.context, root)
    const declarations: Declarations = new Map(input.graph.artifacts.map((artifact) => [artifact.id.toString(), artifact]))
    const produced = new Set(input.graph.preparations.flatMap((preparation) =>
      preparation._tag === "GraphCommandArtifact"
        ? preparation.outputs.map((output) => output.id.toString())
        : preparation._tag === "GraphArchive" || preparation._tag === "GraphChecksum"
        ? [preparation.output.id.toString()]
        : []))
    const externalInputs: ExplicitInputSnapshot[] = []
    for (const artifact of input.graph.artifacts) {
      if (produced.has(artifact.id.toString()) || artifact.kind === "package") continue
      const path = artifact.path.toString()
      const tracked = sourceSnapshot.entries.some((entry) =>
        entry.path.toString() === path || entry.path.toString().startsWith(`${path}/`))
      if (tracked) continue
      externalInputs.push(yield* attempt(() => materializeExplicitInput({
        id: artifact.id.toString(),
        sourceWorkspace: sourceRoot,
        stageRoot: root,
        path: artifact.path
      })))
    }
    const request: PreparationRequest = { ...input, context }
    const dependencies = yield* materializeBunDependencies({
      request,
      sourceWorkspace: sourceRoot,
      sourceSnapshot
    })
    if (dependencies !== undefined) externalInputs.push(dependencies.input)
    const bytes: Bytes = new Map()
    const producers: Producers = new Map()
    const preparedCollections = new Map<string, PreparedArtifactCollection>()
    const isolationIdentities: NetworkIsolationIdentity[] = []
    for (const artifact of input.graph.artifacts) {
      if (produced.has(artifact.id.toString()) || artifact.kind === "package") continue
      bytes.set(artifact.id.toString(), yield* capture(context, artifact))
      producers.set(artifact.id.toString(), externalInputs.some((item) => item.id === artifact.id.toString())
        ? `explicit-input:${artifact.id}`
        : "verified-source")
    }
    for (const preparation of input.graph.preparations) {
      const result = yield* structured(request, preparation, declarations, bytes, sourceSnapshot, externalInputs)
      if (result.networkIsolation !== undefined) isolationIdentities.push(result.networkIsolation)
      for (const declaration of result.declarations) {
        const id = declaration.id.toString()
        const idCollision = [...declarations.keys()].find((candidate) =>
          candidate.toLocaleLowerCase("en-US") === id.toLocaleLowerCase("en-US"))
        if (idCollision !== undefined) {
          return yield* new PreparationError({
            reason: `Runtime artifact ${id} collides with existing artifact id ${idCollision}.`
          })
        }
        const path = declaration.path.toString()
        const pathCollision = [...declarations.values()].find((candidate) =>
          candidate.path.toString().toLocaleLowerCase("en-US") === path.toLocaleLowerCase("en-US"))
        if (pathCollision !== undefined) {
          return yield* new PreparationError({
            reason: `Runtime artifact ${id} path ${path} collides with ${pathCollision.id} at ${pathCollision.path}.`
          })
        }
        declarations.set(id, declaration)
      }
      if (result.collection !== undefined) {
        const id = result.collection.contract.id.toString()
        if (preparedCollections.has(id)) {
          return yield* new PreparationError({ reason: `Runtime artifact collection ${id} was produced more than once.` })
        }
        preparedCollections.set(id, result.collection)
      }
      for (const [id, value] of result.outputs) {
        bytes.set(id, value)
        producers.set(id, preparation.id.toString())
      }
    }
    const isolation = isolationIdentities[0]
    if (isolation !== undefined && isolationIdentities.some((value) =>
      encodeCanonicalJson(value) !== encodeCanonicalJson(isolation))) {
      return yield* new PreparationError({
        reason: "Network-isolated commands reported inconsistent helper, libseccomp, kernel, architecture, or syscall identities."
      })
    }
    const hasNpmPublication = input.graph.publications.some((publication) => publication._tag === "GraphNpmPublication")
    if (hasNpmPublication) yield* attempt(() => {
      for (const publication of input.graph.publications) {
        if (publication._tag !== "GraphNpmPublication") continue
        const declaration = declarations.get(publication.packageArtifact.toString())
        if (declaration?.kind !== "package") throw new Error(
          `npm publication ${publication.id} does not reference its declared package artifact.`
        )
        assertNpmLiteralSelectionsPresent(resolve(root, declaration.path.toString()))
      }
    })
    const npmPackIdentity = hasNpmPublication ? yield* establishNpmPackIdentity(request) : undefined
    const releaseGraph = sha256Digest(new TextEncoder().encode(encodeCanonicalJson(
      Schema.encodeSync(ReleaseGraph)(input.graph)
    )))
    const execution = runtimeIdentity(dependencies?.bunVersion, isolation, npmPackIdentity, releaseGraph)
    const basis = preparationBasisDigest(sourceSnapshot, externalInputs, {
      environment: execution.environment,
      network: execution.network,
      timezone: execution.timezone,
      locale: execution.locale,
      clock: execution.clock,
      randomness: execution.randomness,
      platform: execution.platform,
      runtime: execution.runtime,
      networkIsolation: execution.networkIsolation,
      npmPack: execution.npmPack,
      releaseGraph: execution.releaseGraph.hex,
      preparer: execution.preparer
    })
    const preparedArtifacts = new Map<string, PreparedArtifact>()
    for (const artifact of [...declarations.values()].sort(byCodepoint)) {
      const value = bytes.get(artifact.id.toString())
      if (value === undefined || artifact.kind === "package") continue
      const digest = sha256Digest(value)
      preparedArtifacts.set(artifact.id.toString(), PreparedArtifact.make({
        id: artifact.id,
        path: artifact.path,
        kind: artifact.kind,
        size: value.length,
        digest,
        blob: digest,
        ...(artifact.mediaType === undefined ? {} : { mediaType: artifact.mediaType }),
        producer: NonEmptyName.make(producers.get(artifact.id.toString()) ?? "verified-source"),
        inputBasis: basis
      }))
    }
    const publications: Array<PreparedNpmPublication | PreparedGitHubPublication> = []
    for (const publication of input.graph.publications) {
      if (publication._tag === "GraphNpmPublication") {
        const artifact = yield* npmTarball(request, publication, declarations, sourceSnapshot, basis, npmPackIdentity!)
        const artifactBytes = yield* capture(context, { id: artifact.id, path: artifact.path, kind: artifact.kind })
        bytes.set(artifact.id.toString(), artifactBytes)
        preparedArtifacts.set(artifact.id.toString(), artifact)
        publications.push(PreparedNpmPublication.make({
          id: NonEmptyName.make(publication.id),
          packageName: publication.packageName,
          version: Version.make(publication.version.toString()),
          registryUrl: publication.registryUrl,
          artifactId: artifact.id,
          distTag: publication.distTag,
          access: publication.access,
          authentication: publication.authentication,
          provenance: publication.provenance,
          authority: publication.authority
        }))
      } else {
        const selectedIds = publication.assetCollections.flatMap((selector) => {
          const collection = preparedCollections.get(selector.collection.toString())
          if (collection === undefined) {
            throw new Error(`GitHub publication ${publication.id} collection ${selector.collection} is unavailable.`)
          }
          if (!cardinalityAccepts(selector.cardinality, collection.members.length)) {
            throw new Error(
              `GitHub publication ${publication.id} collection ${selector.collection} selected ${collection.members.length} members outside its cardinality.`
            )
          }
          return collection.members.map((member) => member.artifactId)
        })
        const assets = [...publication.assetIds, ...selectedIds].map((id) => {
          const artifact = preparedArtifacts.get(id.toString())
          if (artifact === undefined) throw new Error(`GitHub publication ${publication.id} references unavailable artifact ${id}.`)
          return {
            artifactId: artifact.id,
            name: NonEmptyName.make(basename(artifact.path)),
            mediaType: artifact.mediaType ?? "application/octet-stream"
          }
        })
        const assetNames = new Map<string, string>()
        for (const asset of assets) {
          const folded = asset.name.toLocaleLowerCase("en-US")
          const previous = assetNames.get(folded)
          if (previous !== undefined) {
            throw new Error(`GitHub publication ${publication.id} assets ${previous} and ${asset.name} have duplicate portable names.`)
          }
          assetNames.set(folded, asset.name)
        }
        const body = publication.bodyArtifact === undefined
          ? publication.body
          : new TextDecoder().decode(bytes.get(publication.bodyArtifact.toString()) ?? (() => {
            throw new Error(`GitHub body artifact ${publication.bodyArtifact} is unavailable.`)
          })())
        publications.push(PreparedGitHubPublication.make({
          id: NonEmptyName.make(publication.id),
          repository: publication.repository,
          tag: publication.tag,
          title: publication.title,
          draft: publication.draft,
          prerelease: publication.prerelease,
          targetCommit: context.source.commit,
          ...(body === undefined ? {} : { body }),
          assets,
          authority: publication.authority
        }))
      }
    }
    assertSnapshotPresent(root, sourceSnapshot, "Verified source")
    const githubPublication = input.graph.publications.find((publication): publication is GraphGitHubPublication =>
      publication._tag === "GraphGitHubPublication")
    const npmPublication = input.graph.publications.find((publication): publication is GraphNpmPublication =>
      publication._tag === "GraphNpmPublication")
    const manifest = PreparedReleaseV2.make({
      kind: "complete",
      schemaVersion: "prepared-release/v2",
      source: PreparedSource.make({
        commit: context.source.commit,
        tree: context.source.tree,
        clean: true,
        packageManifestPath: context.source.packageManifestPath,
        packageManifestDigest: context.source.packageManifestDigest,
        materialized: sourceSnapshot
      }),
      project: PreparedProject.make({
        name: context.package.name,
        version: context.package.version,
        tag: githubPublication?.tag ?? NonEmptyName.make(`v${context.package.version}`),
        ...(npmPublication === undefined ? {} : { packageName: npmPublication.packageName }),
        ...(context.package.repository === undefined ? {} : { repository: context.package.repository })
      }),
      provenance: PreparedProvenance.make({
        source: sourceSnapshot,
        externalInputs,
        execution,
        inputBasis: basis,
        reproducibility: "not-asserted"
      }),
      artifacts: [...preparedArtifacts.values()].sort(byCodepoint),
      collections: [...preparedCollections.values()].sort((left, right) =>
        left.contract.id < right.contract.id ? -1 : left.contract.id > right.contract.id ? 1 : 0),
      publications
    })
    const blobMap = new Map([...bytes.entries()].filter(([id]) => preparedArtifacts.has(id)))
    return yield* input.store.commit(manifest, blobMap).pipe(Effect.mapError((cause) =>
      cause instanceof PreparedStoreError ? PreparationError.make({ reason: cause.reason }) : failure(cause)))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
