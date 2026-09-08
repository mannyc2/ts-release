import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Effect, Schema } from "effect"
import type * as Producer from "effect-build/Artifact"
import { ReleaseError, createPlan, loadPlan, type Operation } from "@mannyc1/ts-release"
import type { ProviderDefinition, Transport } from "@mannyc1/ts-release"
import { Tree, encodeBundle, finalize, loadBundle } from "@mannyc1/ts-release/bundle"
import { verifiedArtifacts, type Artifact, type ContentOwner } from "@mannyc1/ts-release/bundle"
import { adoptFile } from "@mannyc1/ts-release/effect-build"
import { Intent as GitIntent, definition as gitDefinition } from "@mannyc1/ts-release/git"
import { decodeJson, sameBytes, sameData, type HttpRead } from "@mannyc1/ts-release/http"
import { fileContentOwner, openGitJournal } from "@mannyc1/ts-release/node"
import * as Npm from "@mannyc1/ts-release-npm"
import * as PyPi from "@mannyc1/ts-release-pypi"
import * as GitHub from "@mannyc1/ts-release-github"
import * as Homebrew from "@mannyc1/ts-release-catalog/homebrew"
import * as Scoop from "@mannyc1/ts-release-catalog/scoop"
import * as Mcp from "@mannyc1/ts-release-mcp"
import * as OpenAi from "@mannyc1/ts-release-openai"

const Sha256 = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u))
const GitOid = Schema.String.check(Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u))
const PositiveInt = Schema.Int.check(Schema.makeFilter((value) => value > 0))
const SourceIdentity = Schema.Struct({ commit: GitOid, repository: Schema.String, tree: GitOid })
class JournalInput extends Schema.Class<JournalInput>("SelfRelease.JournalInput")({
  cacheDirectory: Schema.String,
  remote: Schema.String,
  principal: Schema.String,
  scope: Schema.String,
  gitExecutable: Schema.String,
  timeoutMilliseconds: PositiveInt,
  maximumOutputBytes: PositiveInt,
}) {}
class CatalogInput extends Schema.Class<CatalogInput>("SelfRelease.CatalogInput")({
  homebrew: Homebrew.Formula,
  homebrewFile: Schema.String,
  scoop: Scoop.Manifest,
  scoopFile: Schema.String,
}) {}
class Input extends Schema.Class<Input>("SelfRelease.Input")({
  version: Schema.String,
  contentDirectory: Schema.String,
  bundleFile: Schema.String,
  planFile: Schema.String,
  bundleSha256: Sha256,
  planId: Sha256,
  sourceCommit: GitOid,
  sourceTree: GitOid,
  sourceFile: Schema.String,
  openAiPlugin: Tree,
  catalog: CatalogInput,
  journal: JournalInput,
}) {}

const failure = (code: string, message: string) => new ReleaseError({ code, message })
const read = (path: string, subject: string) =>
  Effect.tryPromise({
    try: () => readFile(path),
    catch: () => failure(`self-release-${subject}`, `Self-release ${subject} could not be read`),
  })
const unavailable = (code: string, message: string) => () =>
  Effect.fail(failure(`self-release-${code}`, message))
const unavailableRead: HttpRead = unavailable("network", "Rehearsal cannot perform network reads")
const noMutation: Transport = { send: unavailable("mutation", "Rehearsal cannot dispatch") }
const intents = <A, I>(
  operations: readonly Operation[],
  definitionId: string,
  codec: Schema.Codec<A, I>,
) =>
  operations
    .filter((operation) => operation.definitionId === definitionId)
    .map((operation) => Schema.decodeUnknownSync(codec)(operation.intent))
const packageNames = [
  "@mannyc1/ts-release",
  "@mannyc1/ts-release-catalog",
  "@mannyc1/ts-release-github",
  "@mannyc1/ts-release-mcp",
  "@mannyc1/ts-release-npm",
  "@mannyc1/ts-release-openai",
  "@mannyc1/ts-release-pypi",
] as const

export const prepareSelfRelease = Effect.fn("selfRelease.prepare")(function* (input: {
  readonly owner: ContentOwner
  readonly producerFiles: ReadonlyArray<{
    readonly logicalName: string
    readonly artifact: Producer.HashedFile | Producer.HashedExecutable
  }>
  readonly ownedArtifacts?: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<Operation>
  readonly journalId?: string
}) {
  const adopted = yield* Effect.forEach(input.producerFiles, ({ logicalName, artifact }) =>
    adoptFile(input.owner, logicalName, artifact),
  )
  const bundle = yield* finalize([...adopted, ...(input.ownedArtifacts ?? [])])
  const bundleBytes = encodeBundle(bundle)
  const identity = yield* input.owner.putOwned(bundleBytes)
  const plan = yield* createPlan(identity.sha256, input.operations, input.journalId)
  return Object.freeze({ bundle, bundleBytes, plan })
})

export const createApplication = Effect.fn("selfRelease.createApplication")(function* (
  raw: unknown,
) {
  const input = yield* Schema.decodeUnknownEffect(Input, { onExcessProperty: "error" })(raw).pipe(
    Effect.mapError(() => failure("self-release-input", "Self-release input is invalid")),
  )
  const bundleBytes = yield* read(input.bundleFile, "bundle")
  if (createHash("sha256").update(bundleBytes).digest("hex") !== input.bundleSha256)
    return yield* failure("self-release-bundle", "Self-release Bundle identity differs")
  const owner = fileContentOwner(input.contentDirectory)
  const bundle = yield* loadBundle(owner, bundleBytes)
  const artifacts = new Map<string, Artifact>(
    bundle.artifacts.map((artifact) => [artifact.logicalName, artifact]),
  )
  const planBytes = yield* read(input.planFile, "plan")
  const planInput = yield* Effect.try({
    try: () => decodeJson(planBytes),
    catch: () => failure("self-release-plan", "Self-release Plan is not exact JSON"),
  })
  const readContent = Effect.fn("selfRelease.readContent")((content) =>
    Effect.mapError(owner.read(content), () =>
      failure("self-release-content", "Owned self-release content could not be read"),
    ),
  )
  const access = { bundle, readContent }
  const providers: ProviderDefinition[] = [
    ...Npm.definitions({ ...access, read: unavailableRead }),
    ...PyPi.definitions({ ...access, read: unavailableRead }),
    ...GitHub.definitions({ ...access, read: unavailableRead }),
    ...Mcp.definitions({ read: unavailableRead }),
    gitDefinition({
      readContent,
      observeRef: unavailable("observation", "Rehearsal cannot observe a publication ref"),
    }),
  ]
  const plan = yield* loadPlan(planInput, providers)
  if (plan.planId !== input.planId || plan.bundleId !== input.bundleSha256)
    return yield* failure("self-release-plan", "Self-release Plan identity differs")

  const files = verifiedArtifacts(access, 32 * 1024 * 1024)
  if (!files.has(input.openAiPlugin))
    return yield* failure("self-release-openai", "OpenAI plugin is not an exact Bundle member")
  const source = artifacts.get(input.sourceFile)
  if (source?._tag !== "OwnedFile")
    return yield* failure("self-release-source", "Source identity is not a Bundle member")
  const sourceBytes = yield* files.read(source)
  const sourceIdentity = yield* Effect.try(() =>
    Schema.decodeUnknownSync(SourceIdentity, { onExcessProperty: "error" })(
      decodeJson(sourceBytes),
    ),
  ).pipe(Effect.mapError(() => failure("self-release-source", "Source identity is invalid")))
  if (
    sourceIdentity.repository !== "mannyc2/ts-release" ||
    sourceIdentity.commit !== input.sourceCommit ||
    sourceIdentity.tree !== input.sourceTree
  )
    return yield* failure("self-release-source", "Source commit or tree differs")

  const npm = intents(plan.operations, "npm.publish", Npm.PublishIntent)
  if (
    npm.some((intent) => intent.version !== input.version) ||
    !sameData(npm.map((intent) => intent.name).sort(), packageNames)
  )
    return yield* failure("self-release-npm", "npm cohort differs from the seven packages")
  const python = intents(plan.operations, "pypi.upload", PyPi.UploadIntent)
  const wheelPrefix = `ts_release-${input.version.replaceAll("-", "_")}-py3-none-`
  const wheelNames = [
    `${wheelPrefix}manylinux_2_17_x86_64.whl`,
    `${wheelPrefix}manylinux_2_17_aarch64.whl`,
    `${wheelPrefix}macosx_13_0_x86_64.whl`,
    `${wheelPrefix}macosx_13_0_arm64.whl`,
  ].sort()
  if (
    !sameData(python.map((intent) => intent.filename).sort(), wheelNames) ||
    python.some(
      (intent) =>
        intent._tag !== "WheelUpload" ||
        intent.project !== "ts-release" ||
        intent.version !== input.version,
    )
  )
    return yield* failure("self-release-pypi", "PyPI four-wheel cohort differs")
  const githubTags = intents(plan.operations, "github.lightweight-tag", GitHub.LightweightTag)
  if (
    githubTags.length !== 1 ||
    githubTags[0]!.tag !== `v${input.version}` ||
    githubTags[0]!.commit !== input.sourceCommit
  )
    return yield* failure("self-release-github", "GitHub tag differs from the source release")
  const marketplace = yield* OpenAi.marketplace(
    {
      plugin: input.openAiPlugin,
      existing: null,
      marketplaceName: "ts-release",
      displayName: "ts-release",
      sourcePath: "./plugins/ts-release",
      category: "Developer Tools",
    },
    readContent,
  )
  const outputs = new Map<string, Uint8Array>([
    [input.catalog.homebrewFile, yield* Homebrew.render(input.catalog.homebrew, bundle)],
    [input.catalog.scoopFile, yield* Scoop.render(input.catalog.scoop, bundle)],
    [marketplace.path, marketplace.bytes],
  ])
  const gitUpdates = intents(plan.operations, "git.catalog.update", GitIntent),
    gitFiles = gitUpdates.flatMap((intent) => intent.files)
  if (
    outputs.size !== 3 ||
    gitUpdates.length !== outputs.size ||
    gitFiles.length !== outputs.size ||
    intents(plan.operations, "mcp.publish", Mcp.PublishIntent).length !== 1
  )
    return yield* failure("self-release-plan", "Catalog, marketplace or MCP operation differs")
  for (const edit of gitFiles) {
    const expected = outputs.get(edit.path),
      artifact = artifacts.get(edit.path)
    if (
      !expected ||
      artifact?._tag !== "OwnedFile" ||
      !sameData(edit.content, artifact.content) ||
      !sameBytes(yield* files.read(artifact), expected)
    )
      return yield* failure("self-release-output", "Planned output differs from its Bundle file")
    outputs.delete(edit.path)
  }
  const store = yield* openGitJournal({
    ...input.journal,
    credentials: () => Effect.succeed({ _tag: "Anonymous" as const }),
  })
  return {
    bundle,
    options: { plan, authorize: false, observe: false, maxDispatches: 0 },
    host: { store, providers, transport: noMutation, now: Date.now, uniqueId: randomUUID },
  }
})
