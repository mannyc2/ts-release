import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { parseReleaseIntent } from "../config/load.js"
import { configPath, configRoot, readReleaseConfig } from "../config/resolve.js"
import type { ReleaseIntent } from "../config/schema.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { readOptionalEnv } from "../host/platform.js"
import type { ArtifactInventoryItem } from "../pipeline/artifact.js"
import { IdentityError, PlanError } from "../pipeline/errors.js"
import { gitTagSource } from "../pipeline/identity/git-tag.js"
import { manifestSource } from "../pipeline/identity/manifest.js"
import { completeIdentity, ResolvedIdentity } from "../pipeline/identity/source.js"
import {
  ExecutionApproval,
  Operation
} from "../pipeline/operation.js"
import { parseJsonAs } from "../pipeline/json.js"
import { optionalField } from "../pipeline/optional-field.js"
import { buildPipeline, publishPipeline } from "../pipeline/pipeline.js"
import { runPipeline } from "../pipeline/runner.js"
import { emptyReleaseState, ReleaseIdentity, ReleaseState } from "../pipeline/state.js"
import {
  buildOperations,
  runApprovedReleaseWorkflow,
  runOperations,
  verifyOperations,
  writeRenderFiles,
  type OperationRunContext
} from "./executor.js"
import {
  decodeEvidenceBundle,
  emptyEvidenceBundle,
  EvidenceBundle,
  renderEvidenceJson
} from "./evidence.js"
import {
  EvidenceReadError,
  EvidenceWriteError,
  OperationFailedError,
  ReleaseNormalizationError
} from "./errors.js"
import { ReleasePlanDocument, SourceMetadata } from "./plan-document.js"
import { renderReleasePlan } from "./render.js"
import {
  evidenceOperationStatuses,
  plannedSummary,
  type BuildSummary,
  type ReleasePlanSummary,
  type ReleaseSummary,
  type VerifySummary
} from "./summary.js"
import {
  stageArtifactOperation,
  type StagedArtifactOperationResult,
  type StageOperation
} from "./stager.js"
import {
  resolveWorkspacePath,
  resolveWorkspaceWritePathEffect
} from "../internal/workspace-path.js"
import type * as PlatformError from "effect/PlatformError"


export { renderEvidenceJson, renderReleasePlan }

export interface ReleaseSourceInput {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
  readonly snapshot?: boolean | undefined
}

export interface ReleaseExecutionInput extends ReleaseSourceInput {
  readonly execute?: boolean | undefined
  readonly approveIrreversible?: boolean | undefined
}

export interface StagedReleaseArtifactsResult {
  readonly schemaVersion: "artifact-stage/v1"
  readonly identity: ReleaseIdentity
  readonly configPath: string
  readonly operations: ReadonlyArray<StagedArtifactOperationResult>
  readonly plan: ReleasePlanDocument
}

export interface ReleaseEvidenceResult {
  readonly plan: ReleasePlanDocument
  readonly evidence: EvidenceBundle
}

export interface RunOptions {
  readonly config?: string | ReleaseIntent | undefined
  readonly workspace?: string | undefined
  readonly snapshot?: boolean | undefined
}

export interface ReleaseRunOptions extends RunOptions {
  readonly execute?: boolean | undefined
  readonly approvePublish?: boolean | undefined
}

const identityErrorToNormalization = (error: IdentityError): ReleaseNormalizationError =>
  ReleaseNormalizationError.make({
    field: error.field ?? error.source,
    reason: error.reason,
    cause: error.cause
  })

const planErrorToNormalization = (error: PlanError): ReleaseNormalizationError =>
  ReleaseNormalizationError.make({
    field: error.field ?? error.pipeId,
    reason: error.reason
  })

const applySnapshotModifier = (resolved: ResolvedIdentity): ResolvedIdentity => {
  const shortCommit = resolved.commit.slice(0, 7) || "snapshot"
  return ResolvedIdentity.make({
    name: resolved.name,
    version: `${resolved.version}-SNAPSHOT-${shortCommit}`,
    commit: resolved.commit,
    tag: resolved.tag,
    notes: resolved.notes,
    sourceId: resolved.sourceId
  })
}

const resolvePipelineIdentity = Effect.fn("engine.resolvePipelineIdentity")(function*(
  intent: ReleaseIntent,
  root: string,
  snapshot: boolean
) {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const commandRunner = yield* ReleaseCommandRunner
  const workspace = { fileSystem, path, commandRunner }
  const source = intent.versionFrom ?? "manifest"
  const resolved = source === "git-tag"
    ? yield* gitTagSource.resolve(
      { project: intent.project, root, snapshot },
      workspace
    )
    : yield* manifestSource.resolve(
      { project: intent.project, root },
      workspace
    )
  return completeIdentity(snapshot ? applySnapshotModifier(resolved) : resolved, { snapshot })
})

const resolveReleaseBuild = Effect.fn("engine.resolveReleaseBuild")(function*(
  intent: ReleaseIntent,
  root: string,
  snapshot: boolean
) {
  const identity = yield* resolvePipelineIdentity(intent, root, snapshot).pipe(
    Effect.mapError(identityErrorToNormalization)
  )
  const buildState = yield* runPipeline(emptyReleaseState(identity), intent, buildPipeline).pipe(
    Effect.mapError(planErrorToNormalization)
  )
  return { identity, buildState }
})

const readIntent = Effect.fn("engine.readIntent")(function*(options: ReleaseSourceInput) {
  const pathName = configPath(options)
  const contents = yield* readReleaseConfig(options)
  return yield* parseReleaseIntent(contents, pathName)
})

const artifactFormat = (
  artifact: ReleaseState["artifacts"]["artifacts"][number]
): ArtifactInventoryItem["format"] =>
  artifact.kind === "package"
    ? "directory"
    : artifact.kind === "executable"
    ? "executable"
    : artifact.extra?._tag === "archive"
    ? artifact.extra.format === "zip" ? "zip" : "tarball"
    : artifact.extra?._tag === "file"
    ? artifact.extra.format
    : "file"

const artifactInventoryFromState = (state: ReleaseState): ReadonlyArray<ArtifactInventoryItem> =>
  state.artifacts.artifacts.map((artifact) => ({
    id: artifact.id,
    path: artifact.path,
    format: artifactFormat(artifact),
    consumers: [],
    sizeBytes: 0,
    ...optionalField(artifact.checksum, (checksum) => ({ checksum })),
    ...optionalField(artifact.platform, (variant) => ({ variant }))
  }))

const releaseEvidenceDirectory = (intent: ReleaseIntent, state: ReleaseState): string => {
  const template = typeof intent.evidence === "string"
    ? intent.evidence
    : intent.evidence?.directory ?? ".release/evidence"
  return template.split("{version}").join(state.identity.version)
}

const planDocumentFromState = (
  intent: ReleaseIntent,
  root: string,
  configPathName: string | undefined,
  state: ReleaseState
): ReleasePlanDocument => {
  const planState = ReleaseState.make({
    identity: state.identity,
    artifacts: state.artifacts,
    operations: state.operations.filter((operation) => operation.phase !== "build"),
    notices: state.notices
  })
  return ReleasePlanDocument.make({
    schemaVersion: "release-plan/v2",
    state: planState,
    source: SourceMetadata.make({
      root,
      configPath: configPathName
    }),
    artifacts: artifactInventoryFromState(planState),
    evidenceDirectory: releaseEvidenceDirectory(intent, planState)
  })
}

export const planRelease = Effect.fn("engine.planRelease")(function*(
  input: ReleaseSourceInput = {},
  intentArg?: ReleaseIntent
) {
  const path = yield* Path.Path
  const root = configRoot(path, input)
  const intent = intentArg ?? (yield* readIntent(input))
  // Reading from disk stamps the resolved (defaulted) config path into the
  // plan source; a directly supplied intent records only an explicit one.
  const sourcePath = intentArg === undefined ? configPath(input) : input.configPath
  const build = yield* resolveReleaseBuild(intent, root, input.snapshot ?? false)
  const state = yield* runPipeline(build.buildState, intent, publishPipeline)
  return planDocumentFromState(intent, root, sourcePath, state)
})

const isStageOperation = (operation: Operation): operation is StageOperation =>
  operation.action._tag === "stage"

const operationContext = (
  state: ReleaseState,
  root: string,
  configPathName: string | undefined
): OperationRunContext => ({
  root,
  identity: state.identity,
  artifacts: state.artifacts,
  notices: state.notices,
  configPath: configPathName
})

const planContext = (plan: ReleasePlanDocument): OperationRunContext =>
  operationContext(plan.state, plan.source.root, plan.source.configPath)

export const buildReleaseArtifacts = Effect.fn("engine.buildReleaseArtifacts")(function*(
  input: ReleaseSourceInput = {},
  intentArg?: ReleaseIntent
) {
  const path = yield* Path.Path
  const root = configRoot(path, input)
  const pathName = configPath(input)
  const intent = intentArg ?? (yield* readIntent(input))
  const build = yield* resolveReleaseBuild(intent, root, input.snapshot ?? false)
  const staged: Array<StagedArtifactOperationResult> = []
  for (const operation of buildOperations(build.buildState.operations)) {
    if (isStageOperation(operation)) {
      staged.push(yield* stageArtifactOperation(operation, {
        root,
        identity: build.buildState.identity,
        configPath: pathName
      }))
    } else {
      yield* runOperations(
        [operation],
        ExecutionApproval.make({ execute: true, approveIrreversible: false }),
        operationContext(build.buildState, root, pathName)
      )
    }
  }
  const planState = yield* runPipeline(build.buildState, intent, publishPipeline)
  const plan = planDocumentFromState(intent, root, pathName, planState)
  return {
    schemaVersion: "artifact-stage/v1",
    identity: build.buildState.identity,
    configPath: pathName,
    operations: staged,
    plan
  } satisfies StagedReleaseArtifactsResult
})

export const renderBuildArtifacts = (
  result: StagedReleaseArtifactsResult,
  format: "json" | "text" = "text"
): string => {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`
  }
  const artifacts = result.operations.flatMap((operation) => operation.artifacts)
  const lines = [
    `staged artifact operations: ${result.operations.length}`,
    "artifacts:"
  ]
  if (artifacts.length === 0) {
    lines.push("  none")
  } else {
    for (const artifact of artifacts) {
      lines.push(`  ${artifact.id} ${artifact.path}`)
    }
  }
  return `${lines.join("\n")}\n`
}

const releaseEvidencePath = (plan: ReleasePlanDocument, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

export const writeEvidenceBundle = Effect.fn("engine.writeEvidenceBundle")(function*(
  pathName: string,
  bundle: EvidenceBundle,
  root: string = "."
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = yield* resolveWorkspaceWritePathEffect(
    path,
    root,
    pathName,
    (errorPath, reason) => EvidenceWriteError.make({ path: errorPath, reason })
  )
  yield* Effect.gen(function*() {
    yield* fs.makeDirectory(path.dirname(targetPath), { recursive: true })
    yield* fs.writeFileString(targetPath, renderEvidenceJson(bundle))
  }).pipe(
    Effect.mapError((error) =>
      EvidenceWriteError.make({
        path: pathName,
        reason: error.message,
        cause: error
      })
    )
  )
})

const isNotFoundError = (error: PlatformError.PlatformError): boolean =>
  error.reason._tag === "NotFound"

const readEvidenceContents = Effect.fn("engine.readEvidenceContents")(function*(pathName: string, root: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return yield* fs.readFileString(resolveWorkspacePath(path, root, pathName))
})

const decodeEvidenceContents = Effect.fn("engine.decodeEvidenceContents")(function*(
  contents: string,
  pathName: string,
  includeCause: boolean
) {
  const parsed = yield* parseJsonAs(
    Schema.Unknown,
    contents,
    (cause) =>
      EvidenceReadError.make({
        path: pathName,
        reason: "Evidence bundle is not valid JSON.",
        cause
      })
  )
  return yield* decodeEvidenceBundle(parsed).pipe(
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message,
        cause: includeCause ? error : undefined
      })
    )
  )
})

export const readEvidenceBundle = Effect.fn("engine.readEvidenceBundle")(function*(
  pathName: string,
  root: string = "."
) {
  const contents = yield* readEvidenceContents(pathName, root).pipe(
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message,
        cause: error
      })
    )
  )
  return yield* decodeEvidenceContents(contents, pathName, true)
})

export const tryReadEvidenceBundle = Effect.fn("engine.tryReadEvidenceBundle")(function*(
  pathName: string,
  root: string = "."
) {
  const contents = yield* readEvidenceContents(pathName, root).pipe(
    Effect.catchIf(isNotFoundError, () => Effect.succeed(undefined)),
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message
      })
    )
  )
  if (contents === undefined) {
    return undefined
  }
  return yield* decodeEvidenceContents(contents, pathName, false)
})

const ensureBundleMatchesPlan = (
  plan: ReleasePlanDocument,
  bundle: EvidenceBundle,
  pathName: string
): Effect.Effect<void, EvidenceReadError> => {
  if (bundle.releaseName === plan.state.identity.name && bundle.releaseVersion === plan.state.identity.version) {
    return Effect.void
  }
  return Effect.fail(
    EvidenceReadError.make({
      path: pathName,
      reason:
        `Evidence bundle is for ${bundle.releaseName}@${bundle.releaseVersion}, expected ${plan.state.identity.name}@${plan.state.identity.version}.`
    })
  )
}

export const mergeEvidenceBundles = Effect.fn("engine.mergeEvidenceBundles")(function*(
  plan: ReleasePlanDocument,
  existing: EvidenceBundle | undefined,
  fresh: EvidenceBundle
) {
  const base = existing ?? emptyEvidenceBundle({
    releaseName: plan.state.identity.name,
    releaseVersion: plan.state.identity.version,
    notices: plan.state.notices
  })
  yield* ensureBundleMatchesPlan(plan, base, plan.evidenceDirectory)
  yield* ensureBundleMatchesPlan(plan, fresh, plan.evidenceDirectory)
  return EvidenceBundle.make({
    schemaVersion: "release-evidence/v2",
    releaseName: plan.state.identity.name,
    releaseVersion: plan.state.identity.version,
    notices: [...base.notices, ...fresh.notices],
    records: [...base.records, ...fresh.records]
  })
})

const isOperationFailedError = (error: unknown): error is OperationFailedError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "OperationFailedError"

const writeNamedEvidenceWithFailure = <E, R>(
  plan: ReleasePlanDocument,
  name: string,
  effect: Effect.Effect<EvidenceBundle, E | OperationFailedError, R>
): Effect.Effect<EvidenceBundle, E | OperationFailedError | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> =>
  effect.pipe(
    Effect.catchIf(isOperationFailedError, (error) =>
      Effect.gen(function*() {
        if (error.evidence !== undefined) {
          yield* writeEvidenceBundle(releaseEvidencePath(plan, name), error.evidence, plan.source.root)
        }
        return yield* Effect.fail(error)
      })
    ),
    Effect.flatMap((evidence) =>
      writeEvidenceBundle(releaseEvidencePath(plan, name), evidence, plan.source.root).pipe(
        Effect.map(() => evidence)
      )
    )
  )

export const writeVerificationEvidence = Effect.fn("engine.writeVerificationEvidence")(function*(
  plan: ReleasePlanDocument
) {
  return yield* writeNamedEvidenceWithFailure(
    plan,
    "verification",
    verifyOperations(plan.state.operations, planContext(plan))
  )
})

export const writeReleaseEvidence = Effect.fn("engine.writeReleaseEvidence")(function*(
  plan: ReleasePlanDocument,
  input: ReleaseExecutionInput = {}
) {
  const approval = ExecutionApproval.make({
    execute: input.execute ?? false,
    approveIrreversible: input.approveIrreversible ?? false
  })
  return yield* writeNamedEvidenceWithFailure(
    plan,
    "evidence",
    runApprovedReleaseWorkflow(plan.state.operations, approval, planContext(plan))
  )
})

export const verifyRelease = Effect.fn("engine.verifyRelease")(function*(
  input: ReleaseSourceInput = {},
  intentArg?: ReleaseIntent
) {
  const plan = yield* planRelease(input, intentArg)
  const evidence = yield* writeVerificationEvidence(plan)
  return { plan, evidence } satisfies ReleaseEvidenceResult
})

export const renderReleaseFiles = Effect.fn("engine.renderReleaseFiles")(function*(
  input: ReleaseExecutionInput = {},
  intentArg?: ReleaseIntent
) {
  const plan = yield* planRelease(input, intentArg)
  const approval = ExecutionApproval.make({
    execute: input.execute ?? false,
    approveIrreversible: false
  })
  const evidence = yield* writeNamedEvidenceWithFailure(
    plan,
    "render",
    writeRenderFiles(plan.state.operations, approval, planContext(plan))
  )
  return { plan, evidence } satisfies ReleaseEvidenceResult
})

export const runApprovedRelease = Effect.fn("engine.runApprovedRelease")(function*(
  input: ReleaseExecutionInput = {},
  intentArg?: ReleaseIntent
) {
  const plan = yield* planRelease(input, intentArg)
  const evidence = yield* writeReleaseEvidence(plan, input)
  return { plan, evidence } satisfies ReleaseEvidenceResult
})

const runOptionsInput = (options: ReleaseRunOptions): ReleaseExecutionInput => ({
  root: options.workspace,
  configPath: typeof options.config === "string" ? options.config : undefined,
  snapshot: options.snapshot,
  execute: options.execute ?? false,
  approveIrreversible: options.approvePublish ?? false
})

const runOptionsIntent = (options: RunOptions): ReleaseIntent | undefined =>
  typeof options.config === "object" && options.config !== null ? options.config : undefined

export const plan = Effect.fn("engine.summary.plan")(function*(options: RunOptions = {}) {
  const document = yield* planRelease(runOptionsInput(options), runOptionsIntent(options))
  return plannedSummary(document)
})

export const build = Effect.fn("engine.summary.build")(function*(options: RunOptions = {}) {
  const result = yield* buildReleaseArtifacts(runOptionsInput(options), runOptionsIntent(options))
  return {
    ...plannedSummary(result.plan),
    stagedArtifacts: result.operations.flatMap((operation) =>
      operation.artifacts.map((artifact) => ({
        id: artifact.id,
        path: artifact.path,
        format: "file"
      }))
    )
  } satisfies BuildSummary
})

export const release = Effect.fn("engine.summary.release")(function*(options: ReleaseRunOptions = {}) {
  if (options.execute !== true) {
    const document = yield* planRelease(runOptionsInput(options), runOptionsIntent(options))
    return {
      ...plannedSummary(document),
      executed: [],
      refused: []
    } satisfies ReleaseSummary
  }
  const result = yield* runApprovedRelease(runOptionsInput(options), runOptionsIntent(options))
  const summary = plannedSummary(result.plan)
  const executed = evidenceOperationStatuses(result.plan, result.evidence, releaseEvidencePath(result.plan, "evidence"))
  return {
    ...summary,
    executed,
    refused: executed.filter((operation) => operation.status === "refused")
  } satisfies ReleaseSummary
})

export const verify = Effect.fn("engine.summary.verify")(function*(options: RunOptions = {}) {
  const result = yield* verifyRelease(runOptionsInput(options), runOptionsIntent(options))
  return {
    identity: plannedSummary(result.plan).identity,
    checks: evidenceOperationStatuses(result.plan, result.evidence, releaseEvidencePath(result.plan, "verification"))
  } satisfies VerifySummary
})

export const envExists = Effect.fn("engine.envExists")(function*(name: string) {
  const value = yield* readOptionalEnv(name)
  return value !== undefined
})

export type { ReleasePlanSummary, BuildSummary, ReleaseSummary, VerifySummary }
