import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs"
import { basename, join, relative } from "node:path"
import { tmpdir } from "node:os"
import { secureRead, secureWrite } from "../drivers/workspace.js"
import { tarGz, zip, type ArchiveEntry } from "../drivers/archive.js"
import { sha256 } from "../drivers/utils.js"
import { contained } from "../drivers/contain.js"
import type { RunCommand } from "../drivers/process.js"
import { Digest, NonEmptyName, OutputId, SafeRelativePath, Version, WorkspaceRoot } from "../model/primitives.js"
import { VerifiedReleaseContext } from "./context.js"
import { GraphArchive, GraphCatalog, GraphChecksum, GraphCommandArtifact, GraphCommandCheck, GraphGitHubPublication, GraphNpmPublication, type GraphPreparation, type ReleaseGraph } from "./graph.js"
import { PreparedArtifact, PreparedGitHubPublication, PreparedNpmPublication, PreparedProject, PreparedReleaseV1, PreparedSource } from "./prepared.js"
import { PreparedStoreError, storePreparedRelease, type PreparedBundle } from "./prepared-store.js"

export class PreparationError
  extends Schema.TaggedErrorClass<PreparationError>()("PreparationError", { reason: Schema.String }) {}

export interface PreparationRequest {
  readonly context: VerifiedReleaseContext
  readonly graph: ReleaseGraph
  readonly storeDirectory: string
  readonly run: RunCommand
  /** Re-observes the checkout after each trusted local command. */
  readonly verifySource: (context: VerifiedReleaseContext) => Effect.Effect<VerifiedReleaseContext, unknown>
}

type Bytes = Map<string, Uint8Array>
type Declarations = Map<string, ReleaseGraph["artifacts"][number]>
const failure = (cause: unknown): PreparationError => PreparationError.make({
  reason: cause instanceof Error ? cause.message : String(cause)
})
const attempt = <A>(body: () => A): Effect.Effect<A, PreparationError> => Effect.try({
  try: body, catch: failure
})
const outputId = (value: string): OutputId => OutputId.make(value)
const pathOf = (context: VerifiedReleaseContext, path: SafeRelativePath): string => join(context.workspace, path)
const byCodepoint = (left: { readonly id: { toString(): string } }, right: { readonly id: { toString(): string } }): number => {
  const a = left.id.toString(); const b = right.id.toString()
  return a < b ? -1 : a > b ? 1 : 0
}
const hashBytes = (algorithm: "sha256" | "sha512", bytes: Uint8Array): string => {
  return createHash(algorithm).update(bytes).digest("hex")
}
const capture = (context: VerifiedReleaseContext, declaration: Pick<ReleaseGraph["artifacts"][number], "id" | "path" | "kind">): Effect.Effect<Uint8Array, PreparationError> =>
  attempt(() => {
    if (declaration.kind === "directory" || declaration.kind === "package") throw new Error(`Directory output ${declaration.id} cannot enter a blob store.`)
    const bytes = secureRead(context.workspace, declaration.path).bytes
    return new Uint8Array(bytes)
  })
const commandInput = (
  declaration: ReleaseGraph["artifacts"][number], bytes: Bytes, context: VerifiedReleaseContext
): Effect.Effect<void, PreparationError> => attempt(() => {
  if (declaration.kind === "directory" || declaration.kind === "package") {
    const location = join(context.workspace, declaration.path)
    if (lstatSync(location).isSymbolicLink() || !lstatSync(location).isDirectory()) throw new Error(`Input artifact ${declaration.id} is not a directory.`)
    return
  }
  const current = secureRead(context.workspace, declaration.path).bytes
  const expected = bytes.get(declaration.id.toString())
  if (expected !== undefined && sha256(current) !== sha256(expected)) throw new Error(`Input artifact ${declaration.id} changed before preparation.`)
})

const stageWorkspace = (workspace: string): string => {
  const sourceRoot = realpathSync(workspace)
  const stageRoot = mkdtempSync(join(tmpdir(), "ts-release-prepare-"))
  const excluded = (entry: string): boolean => entry === ".git" || entry === ".release" || entry === ".npmrc" || entry === ".pypirc" || entry === ".env" || entry.startsWith(".env.")
  const assertInSource = (candidate: string): void => {
    const resolved = realpathSync(candidate)
    if (!contained(sourceRoot, resolved)) throw new Error(`Preparation input ${candidate} escapes the workspace root.`)
  }
  try {
    for (const entry of readdirSync(sourceRoot)) {
      if (excluded(entry)) continue
      const source = join(sourceRoot, entry)
      assertInSource(source)
      // Bun's isolated linker keeps transitive workspace dependencies in its
      // hidden store. Copying node_modules dereferences the public links but
      // loses that store topology in the stage, so preserve the dependency
      // tree as a contained read-only-by-contract input while staging source.
      if (entry === "node_modules") {
        symlinkSync(source, join(stageRoot, entry), "dir")
        continue
      }
      cpSync(source, join(stageRoot, entry), {
        recursive: true,
        dereference: true,
        filter: (candidate) => {
          if (relative(sourceRoot, candidate).split(/[\\/]/u).includes("node_modules")) return false
          assertInSource(candidate)
          return true
        }
      })
    }
    return stageRoot
  } catch (cause) {
    rmSync(stageRoot, { recursive: true, force: true })
    throw cause
  }
}

const stagedContext = (context: VerifiedReleaseContext, root: string): VerifiedReleaseContext => VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(root), source: context.source, package: context.package
})
const inputFingerprint = (context: VerifiedReleaseContext, declaration: ReleaseGraph["artifacts"][number]): string => {
  if (declaration.kind !== "directory" && declaration.kind !== "package") return sha256(secureRead(context.workspace, declaration.path).bytes)
  const base = declaration.path.toString()
  const walk = (relative: string): string[] => {
    const location = join(context.workspace, relative)
    return readdirSync(location, { withFileTypes: true }).filter((entry) => ![".git", ".release", "node_modules"].includes(entry.name)).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0).flatMap((entry) => {
      const child = relative === "." ? entry.name : `${relative}/${entry.name}`
      if (entry.isSymbolicLink()) throw new Error(`Input artifact ${declaration.id} contains a symlink.`)
      if (entry.isDirectory()) return walk(child)
      if (!entry.isFile()) throw new Error(`Input artifact ${declaration.id} contains a non-file entry.`)
      const bytes = secureRead(context.workspace, SafeRelativePath.make(child)).bytes
      return [`${child}\u0000${bytes.length}\u0000${sha256(bytes)}`]
    })
  }
  return sha256(new TextEncoder().encode(walk(base).join("\n")))
}
const replaceReferences = (
  value: string, inputs: ReadonlyArray<ReleaseGraph["artifacts"][number]>, outputs: ReadonlyArray<ReleaseGraph["artifacts"][number]>
): string => value.replace(/\{(input|output):([^}]+)\}/gu, (_match, direction: string, id: string) => {
  const declarations = direction === "input" ? inputs : outputs
  const declaration = declarations.find((candidate) => candidate.id.toString() === id)
  if (declaration === undefined) throw new Error(`Unresolved command path reference ${direction}:${id}.`)
  return declaration.path.toString()
})

const runCommand = (
  request: PreparationRequest,
  preparation: GraphCommandCheck | GraphCommandArtifact,
  declarations: Declarations,
  bytes: Bytes
): Effect.Effect<ReadonlyArray<[string, Uint8Array]>, PreparationError> => Effect.gen(function*() {
  const inputs = preparation.inputs.map((id) => declarations.get(id.toString()) ?? (() => { throw new Error(`Missing input ${id}.`) })())
  const before = new Map<string, string>()
  for (const input of inputs) {
    yield* commandInput(input, bytes, request.context)
    before.set(input.id.toString(), yield* attempt(() => inputFingerprint(request.context, input)))
  }
  const outputs = preparation._tag === "GraphCommandArtifact" ? preparation.outputs : []
  const argv = preparation.argv.map((part) => replaceReferences(part, inputs, outputs))
  const outcome = yield* request.run({ argv, cwd: pathOf(request.context, preparation.cwd), environmentNames: preparation.environmentNames }).pipe(Effect.mapError(failure))
  if (outcome.exitCode !== 0) return yield* new PreparationError({ reason: `Command ${preparation.id} exited ${outcome.exitCode}: ${outcome.stderr.trim()}` })
  for (const input of inputs) {
    const after = yield* attempt(() => inputFingerprint(request.context, input))
    if (after !== before.get(input.id.toString())) return yield* new PreparationError({ reason: `Input artifact ${input.id} changed during ${preparation.id}.` })
  }
  if (preparation._tag === "GraphCommandCheck") return []
  const produced: Array<[string, Uint8Array]> = []
  for (const output of outputs) {
    const value = yield* capture(request.context, output)
    produced.push([output.id.toString(), value])
  }
  return produced
})

const structured = (
  request: PreparationRequest, preparation: GraphPreparation, declarations: Declarations, bytes: Bytes
): Effect.Effect<ReadonlyArray<[string, Uint8Array]>, PreparationError> => {
  switch (preparation._tag) {
    case "GraphCommandCheck":
    case "GraphCommandArtifact":
      return runCommand(request, preparation, declarations, bytes)
    case "GraphArchive":
      return attempt(() => {
        const entries: ArchiveEntry[] = preparation.inputs.map((id) => {
          const declaration = declarations.get(id.toString())
          const value = bytes.get(id.toString())
          if (declaration === undefined || value === undefined) throw new Error(`Archive ${preparation.id} references unavailable artifact ${id}.`)
          return { path: basename(declaration.path), data: value, mode: declaration.kind === "executable" ? 0o100755 : 0o100644 }
        }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
        if (entries.length === 0) throw new Error(`Archive ${preparation.id} has no inputs.`)
        const value = preparation.format === "zip" ? zip(entries) : tarGz(entries)
        secureWrite(request.context.workspace, preparation.output.path, value)
        return [[preparation.output.id.toString(), value]]
      })
    case "GraphChecksum":
      return attempt(() => {
        const lines = preparation.inputs.map((id) => {
          const value = bytes.get(id.toString())
          const declaration = declarations.get(id.toString())
          if (value === undefined || declaration === undefined) throw new Error(`Checksum ${preparation.id} references unavailable artifact ${id}.`)
          return `${hashBytes(preparation.algorithm, value)}  ${basename(declaration.path)}`
        })
        const value = new TextEncoder().encode(`${lines.join("\n")}\n`)
        secureWrite(request.context.workspace, preparation.output.path, value)
        return [[preparation.output.id.toString(), value]]
      })
    case "GraphCatalog":
      return attempt(() => {
        const value = typeof preparation.content === "string" ? preparation.content : preparation.content.map((part) =>
          typeof part === "string" ? part : part.fact === "sha256"
            ? sha256(bytes.get(part.outputId.toString()) ?? (() => { throw new Error(`Catalog ${preparation.id} references unavailable artifact ${part.outputId}.`) })())
            : part.fact === "assetName"
            ? basename(declarations.get(part.outputId.toString())?.path ?? (() => { throw new Error(`Catalog ${preparation.id} references unavailable artifact ${part.outputId}.`) })())
            : (() => { throw new Error(`Catalog ${preparation.id} contains an unresolved downloadUrl hole.`) })()
        ).join("")
        const encoded = new TextEncoder().encode(value)
        secureWrite(request.context.workspace, preparation.output.path, encoded)
        return [[preparation.output.id.toString(), encoded]]
      })
  }
}

const npmTarball = (
  request: PreparationRequest, publication: GraphNpmPublication, declarations: Declarations, bytes: Bytes
): Effect.Effect<PreparedArtifact, PreparationError> => Effect.gen(function*() {
  const packageId = publication.artifactIds.find((id) => declarations.get(id.toString())?.kind === "package")
  if (packageId === undefined) return yield* new PreparationError({ reason: `npm publication ${publication.id} has no package artifact.` })
  const destination = `.release/ts-release/npm/${publication.id}`
  const cache = `.release/ts-release/npm-cache/${publication.id}`
  mkdirSync(join(request.context.workspace, destination), { recursive: true })
  mkdirSync(join(request.context.workspace, cache), { recursive: true })
  const existing = readdirSync(join(request.context.workspace, destination))
  if (existing.length > 0) return yield* new PreparationError({ reason: `npm publication ${publication.id} has a non-empty output directory.` })
  const packagePath = declarations.get(packageId.toString())!.path.toString()
  const outcome = yield* request.run({ argv: ["npm", "pack", packagePath, "--json", "--pack-destination", destination, "--cache", cache], cwd: request.context.workspace, environmentNames: [] }).pipe(Effect.mapError(failure))
  if (outcome.exitCode !== 0) return yield* new PreparationError({ reason: `npm pack exited ${outcome.exitCode}: ${outcome.stderr.trim()}` })
  const files = yield* attempt(() => readdirSync(join(request.context.workspace, destination)).filter((entry) => {
    const candidate = join(request.context.workspace, destination, entry)
    return lstatSync(candidate).isFile() && entry.endsWith(".tgz")
  }))
  const entries = yield* attempt(() => readdirSync(join(request.context.workspace, destination)))
  if (entries.length !== 1 || files.length !== 1) return yield* new PreparationError({ reason: `npm pack produced an invalid output directory.` })
  if (outcome.stdout.trim().length > 0) {
    yield* attempt(() => {
      const parsed: unknown = JSON.parse(outcome.stdout)
      const record = Array.isArray(parsed) ? parsed[0] : parsed
      if (typeof record !== "object" || record === null || !("filename" in record) || typeof record.filename !== "string" || record.filename !== files[0]) {
        throw new Error("npm pack result did not identify the captured tarball.")
      }
    })
  }
  const path = SafeRelativePath.make(`${destination}/${files[0]}`)
  const artifactBytes = yield* capture(request.context, { ...declarations.get(packageId.toString())!, id: outputId(`npm-tarball:${publication.id}`), path, kind: "archive" })
  const hash = sha256(artifactBytes)
  return PreparedArtifact.make({ id: outputId(`npm-tarball:${publication.id}`), path, kind: "archive", size: artifactBytes.length,
    digest: Digest.make(hash), blob: Digest.make(hash), mediaType: "application/gzip" })
})

export const prepareRelease = Effect.fn("prepareRelease")(function*(input: PreparationRequest) {
  let observed = yield* input.verifySource(input.context).pipe(Effect.mapError(failure))
  const root = yield* attempt(() => stageWorkspace(observed.workspace))
  try {
    const request: PreparationRequest = {
      ...input,
      context: stagedContext(observed, root),
      verifySource: () => input.verifySource(observed).pipe(Effect.mapError(failure), Effect.map((next) => {
        observed = next
        return stagedContext(next, root)
      }))
    }
    let context = request.context
    const declarations: Declarations = new Map(request.graph.artifacts.map((artifact) => [artifact.id.toString(), artifact]))
    const bytes: Bytes = new Map()
    const produced = new Set(request.graph.preparations.flatMap((preparation) =>
      preparation._tag === "GraphCommandArtifact" ? preparation.outputs.map((output) => output.id.toString())
        : preparation._tag === "GraphArchive" || preparation._tag === "GraphChecksum" || preparation._tag === "GraphCatalog" ? [preparation.output.id.toString()] : []))
    for (const artifact of request.graph.artifacts) {
      if (produced.has(artifact.id.toString())) continue
      if (artifact.kind === "directory" || artifact.kind === "package") continue
      bytes.set(artifact.id.toString(), yield* capture(request.context, artifact))
    }
    for (const preparation of request.graph.preparations) {
      const outputs = yield* structured(request, preparation, declarations, bytes)
      for (const [id, value] of outputs) bytes.set(id, value)
      context = yield* request.verifySource(context)
      if (context.source.commit !== request.context.source.commit || context.source.tree !== request.context.source.tree) {
        return yield* new PreparationError({ reason: `Source identity changed during ${preparation.id}.` })
      }
    }
    const preparedArtifacts = new Map<string, PreparedArtifact>()
    for (const artifact of request.graph.artifacts) {
      const value = bytes.get(artifact.id.toString())
      if (value === undefined || artifact.kind === "directory" || artifact.kind === "package") continue
      const contentHash = sha256(value)
      preparedArtifacts.set(artifact.id.toString(), PreparedArtifact.make({ id: artifact.id, path: artifact.path, kind: artifact.kind,
        size: value.length, digest: Digest.make(contentHash), blob: Digest.make(contentHash),
        ...(artifact.mediaType === undefined ? {} : { mediaType: artifact.mediaType }) }))
    }
    const publications = [] as Array<PreparedNpmPublication | PreparedGitHubPublication>
    for (const publication of request.graph.publications) {
      if (publication._tag === "GraphNpmPublication") {
        const artifact = yield* npmTarball(request, publication, declarations, bytes)
        const artifactBytes = yield* capture(request.context, { id: artifact.id, path: artifact.path, kind: artifact.kind })
        bytes.set(artifact.id.toString(), artifactBytes)
        preparedArtifacts.set(artifact.id.toString(), artifact)
        context = yield* request.verifySource(context)
        if (context.source.commit !== request.context.source.commit || context.source.tree !== request.context.source.tree) {
          return yield* new PreparationError({ reason: `Source identity changed during ${publication.id}.` })
        }
        publications.push(PreparedNpmPublication.make({ id: NonEmptyName.make(publication.id), packageName: publication.packageName,
          version: Version.make(publication.version.toString()), registryUrl: publication.registryUrl, artifactId: artifact.id }))
      } else {
        const assets = publication.assetIds.map((id) => {
          const artifact = preparedArtifacts.get(id.toString())
          if (artifact === undefined) throw new Error(`GitHub publication ${publication.id} references unavailable artifact ${id}.`)
          return { artifactId: artifact.id, name: NonEmptyName.make(basename(artifact.path)), mediaType: artifact.mediaType ?? "application/octet-stream" }
        })
        const body = publication.bodyArtifact === undefined ? publication.body : new TextDecoder().decode(bytes.get(publication.bodyArtifact.toString()) ?? (() => { throw new Error(`GitHub body artifact ${publication.bodyArtifact} is unavailable.`) })())
        publications.push(PreparedGitHubPublication.make({ id: NonEmptyName.make(publication.id), repository: publication.repository,
          tag: publication.tag, title: publication.title, draft: publication.draft, prerelease: publication.prerelease, targetCommit: context.source.commit,
          ...(body === undefined ? {} : { body }), assets }))
      }
    }
    const githubPublication = request.graph.publications.find((publication): publication is GraphGitHubPublication => publication._tag === "GraphGitHubPublication")
    const npmPublication = request.graph.publications.find((publication): publication is GraphNpmPublication => publication._tag === "GraphNpmPublication")
    const manifest = PreparedReleaseV1.make({ schemaVersion: "prepared-release/v1",
      source: PreparedSource.make({ commit: context.source.commit, tree: context.source.tree, clean: true,
        packageManifestPath: context.source.packageManifestPath, packageManifestDigest: Digest.make(context.source.packageManifestDigest.toString()) }),
      project: PreparedProject.make({ name: context.package.name, version: context.package.version,
        tag: githubPublication?.tag ?? NonEmptyName.make(`v${context.package.version}`),
        ...(npmPublication === undefined ? {} : { packageName: npmPublication.packageName }),
        ...(context.package.repository === undefined ? {} : { repository: context.package.repository }) }),
      artifacts: [...preparedArtifacts.values()].sort(byCodepoint), publications })
    const blobMap = new Map([...bytes.entries()].filter(([id]) => preparedArtifacts.has(id)))
    return yield* storePreparedRelease(request.storeDirectory, manifest, blobMap).pipe(Effect.mapError((cause) =>
      cause instanceof PreparedStoreError ? PreparationError.make({ reason: cause.reason }) : failure(cause)))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
