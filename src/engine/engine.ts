import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { ConfigReadError } from "../config/errors.js"
import { parseReleaseIntent } from "../config/load.js"
import { DEFAULT_CONFIG_PATH, type ReleaseIntent } from "../config/schema.js"
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
  executeOperationBatch,
  runApprovedReleaseWorkflow,
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
  OperationFailedError
} from "./errors.js"
import { ReleaseNormalizationError } from "./errors.js"
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
  StagedArtifactOperationResult,
  type StageOperation
} from "./stager.js"
import {
  resolveWorkspacePath,
  resolveWorkspaceWritePathEffect
} from "../internal/workspace-path.js"
import type * as PlatformError from "effect/PlatformError"


export { renderEvidenceJson, renderReleasePlan }

export const ReleasePlanFormat = Schema.Literals(["json", "text", "summary", "markdown"])
export type ReleasePlanFormat = typeof ReleasePlanFormat.Type

export const StageArtifactsFormat = Schema.Literals(["json", "text"])
export type StageArtifactsFormat = typeof StageArtifactsFormat.Type

export class ReleaseSourceOptions extends Schema.Class<ReleaseSourceOptions>("ReleaseSourceOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  snapshot: Schema.optionalKey(Schema.Boolean)
}) {}

export interface ReleaseSourceInput {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
  readonly snapshot?: boolean | undefined
}

export class PlanReleaseOptions extends Schema.Class<PlanReleaseOptions>("PlanReleaseOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  snapshot: Schema.optionalKey(Schema.Boolean),
  format: Schema.optionalKey(ReleasePlanFormat)
}) {}

export interface PlanReleaseInput extends ReleaseSourceInput {
  readonly format?: ReleasePlanFormat | undefined
}

export class BuildReleaseArtifactsOptions extends Schema.Class<BuildReleaseArtifactsOptions>(
  "BuildReleaseArtifactsOptions"
)({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  snapshot: Schema.optionalKey(Schema.Boolean),
  format: Schema.optionalKey(StageArtifactsFormat)
}) {}

export interface BuildReleaseArtifactsInput extends ReleaseSourceInput {
  readonly format?: StageArtifactsFormat | undefined
}

export class ReleaseExecutionOptions extends Schema.Class<ReleaseExecutionOptions>("ReleaseExecutionOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  snapshot: Schema.optionalKey(Schema.Boolean),
  execute: Schema.optionalKey(Schema.Boolean),
  approveIrreversible: Schema.optionalKey(Schema.Boolean)
}) {}

export interface ReleaseExecutionInput extends ReleaseSourceInput {
  readonly execute?: boolean | undefined
  readonly approveIrreversible?: boolean | undefined
}

export class StagedReleaseArtifactsResult extends Schema.Class<StagedReleaseArtifactsResult>(
  "StagedReleaseArtifactsResult"
)({
  schemaVersion: Schema.Literal("artifact-stage/v1"),
  identity: ReleaseIdentity,
  configPath: Schema.String,
  operations: Schema.Array(StagedArtifactOperationResult),
  plan: ReleasePlanDocument
}) {}

export class ReleaseEvidenceResult extends Schema.Class<ReleaseEvidenceResult>("ReleaseEvidenceResult")({
  plan: ReleasePlanDocument,
  evidence: EvidenceBundle
}) {}

export interface RunOptions {
  readonly config?: string | ReleaseIntent | undefined
  readonly workspace?: string | undefined
  readonly snapshot?: boolean | undefined
}

export interface ReleaseRunOptions extends RunOptions {
  readonly execute?: boolean | undefined
  readonly approvePublish?: boolean | undefined
}

const runOptionsSourceInput = (options: RunOptions): ReleaseSourceInput => ({
  ...optionalField(options.workspace, (root) => ({ root })),
  ...(typeof options.config === "string" ? { configPath: options.config } : {}),
  ...optionalField(options.snapshot, (snapshot) => ({ snapshot }))
})

const releaseRunOptionsSourceInput = (options: ReleaseRunOptions): ReleaseExecutionInput => ({
  ...runOptionsSourceInput(options),
  execute: options.execute ?? false,
  approveIrreversible: options.approvePublish ?? false
})

const sourceOptionsFromInput = (input: ReleaseSourceInput = {}): ReleaseSourceOptions =>
  ReleaseSourceOptions.make({
    ...optionalField(input.root, (root) => ({ root })),
    ...optionalField(input.configPath, (configPath) => ({ configPath })),
    ...optionalField(input.snapshot, (snapshot) => ({ snapshot }))
  })

const planOptionsFromInput = (input: PlanReleaseInput = {}): PlanReleaseOptions =>
  PlanReleaseOptions.make({
    ...optionalField(input.root, (root) => ({ root })),
    ...optionalField(input.configPath, (configPath) => ({ configPath })),
    ...optionalField(input.snapshot, (snapshot) => ({ snapshot })),
    ...optionalField(input.format, (format) => ({ format }))
  })

const buildOptionsFromInput = (input: BuildReleaseArtifactsInput = {}): BuildReleaseArtifactsOptions =>
  BuildReleaseArtifactsOptions.make({
    ...optionalField(input.root, (root) => ({ root })),
    ...optionalField(input.configPath, (configPath) => ({ configPath })),
    ...optionalField(input.snapshot, (snapshot) => ({ snapshot })),
    ...optionalField(input.format, (format) => ({ format }))
  })

const buildOptionsFromRunInput = (
  input: BuildReleaseArtifactsInput,
  defaults: {
    readonly root?: string | undefined
    readonly configPath?: string | undefined
  } = {}
): BuildReleaseArtifactsOptions =>
  buildOptionsFromInput({
    ...optionalField(defaults.root, (root) => ({ root })),
    ...optionalField(defaults.configPath, (configPath) => ({ configPath })),
    ...input
  })

const executionOptionsFromInput = (input: ReleaseExecutionInput = {}): ReleaseExecutionOptions =>
  ReleaseExecutionOptions.make({
    ...optionalField(input.root, (root) => ({ root })),
    ...optionalField(input.configPath, (configPath) => ({ configPath })),
    ...optionalField(input.snapshot, (snapshot) => ({ snapshot })),
    ...optionalField(input.execute, (execute) => ({ execute })),
    ...optionalField(input.approveIrreversible, (approveIrreversible) => ({ approveIrreversible }))
  })

const configPath = (options: ReleaseSourceOptions): string =>
  options.configPath ?? DEFAULT_CONFIG_PATH

const configRoot = (path: Path.Path, options: ReleaseSourceOptions): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

const configReadPath = (path: Path.Path, options: ReleaseSourceOptions): string => {
  const pathName = configPath(options)
  return path.isAbsolute(pathName) ? pathName : path.resolve(configRoot(path, options), pathName)
}

const identityErrorToNormalization = (error: IdentityError): ReleaseNormalizationError =>
  ReleaseNormalizationError.make({
    field: error.field ?? error.source,
    reason: error.reason,
    ...optionalField(error.cause, (cause) => ({ cause }))
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
    ...optionalField(resolved.tag, (tag) => ({ tag })),
    ...optionalField(resolved.notes, (notes) => ({ notes })),
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

const planBuildState = Effect.fn("engine.planBuildState")(function*(
  intent: ReleaseIntent,
  identity: ReleaseIdentity
) {
  const initialState = emptyReleaseState(identity)
  return yield* runPipeline(initialState, intent, buildPipeline).pipe(
    Effect.mapError(planErrorToNormalization)
  )
})

const resolveReleaseBuild = Effect.fn("engine.resolveReleaseBuild")(function*(
  intent: ReleaseIntent,
  root: string = ".",
  snapshot: boolean = false
) {
  const identity = yield* resolvePipelineIdentity(intent, root, snapshot).pipe(
    Effect.mapError(identityErrorToNormalization)
  )
  const buildState = yield* planBuildState(intent, identity)
  return { identity, buildState }
})

const approvalFromOptions = (options: ReleaseExecutionOptions): ExecutionApproval =>
  ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: options.approveIrreversible ?? false
  })

const readReleaseConfig = Effect.fn("engine.readReleaseConfig")(function*(options: ReleaseSourceOptions) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const pathName = configPath(options)
  const readPath = configReadPath(path, options)
  return yield* fs.readFileString(readPath).pipe(
    Effect.mapError((error) =>
      ConfigReadError.make({
        path: pathName,
        reason: error.message
      })
    )
  )
})

const readIntent = Effect.fn("engine.readIntent")(function*(options: ReleaseSourceOptions) {
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
      ...optionalField(configPathName, (configPath) => ({ configPath }))
    }),
    artifacts: artifactInventoryFromState(planState),
    evidenceDirectory: releaseEvidenceDirectory(intent, planState)
  })
}

export const planReleaseFromIntent = Effect.fn("engine.planReleaseFromIntent")(function*(
  intent: ReleaseIntent,
  input: ReleaseSourceInput = {}
) {
  const options = planOptionsFromInput(input)
  const path = yield* Path.Path
  const root = configRoot(path, options)
  const build = yield* resolveReleaseBuild(intent, root, options.snapshot ?? false)
  const state = yield* runPipeline(build.buildState, intent, publishPipeline)
  return planDocumentFromState(intent, root, input.configPath, state)
})

export const planRelease = Effect.fn("engine.planRelease")(function*(input: PlanReleaseInput = {}) {
  const options = planOptionsFromInput(input)
  const path = yield* Path.Path
  const pathName = configPath(options)
  const intent = yield* readIntent(options)
  const root = configRoot(path, options)
  const build = yield* resolveReleaseBuild(intent, root, options.snapshot ?? false)
  const state = yield* runPipeline(build.buildState, intent, publishPipeline)
  return planDocumentFromState(intent, root, pathName, state)
})

const isStageOperation = (operation: Operation): operation is StageOperation =>
  operation.action._tag === "stage"

const operationContext = (plan: ReleasePlanDocument): OperationRunContext => ({
  root: plan.source.root,
  identity: plan.state.identity,
  artifacts: plan.state.artifacts,
  notices: plan.state.notices,
  ...optionalField(plan.source.configPath, (configPath) => ({ configPath }))
})

const operationContextFromState = (
  state: ReleaseState,
  root: string,
  configPath: string | undefined
): OperationRunContext => ({
  root,
  identity: state.identity,
  artifacts: state.artifacts,
  notices: state.notices,
  ...optionalField(configPath, (pathName) => ({ configPath: pathName }))
})

const buildReleaseArtifactsFromResolvedIntent = Effect.fn("engine.buildReleaseArtifactsFromResolvedIntent")(function*(
  intent: ReleaseIntent,
  input: BuildReleaseArtifactsInput,
  resolved: {
    readonly root: string
    readonly configPath: string
  }
) {
  const options = buildOptionsFromRunInput(input, resolved)
  const root = resolved.root
  const pathName = resolved.configPath
  const build = yield* resolveReleaseBuild(intent, root, options.snapshot ?? false)
  const buildOps = buildOperations(build.buildState.operations)
  const staged: Array<StagedArtifactOperationResult> = []
  for (const operation of buildOps) {
    if (isStageOperation(operation)) {
      staged.push(yield* stageArtifactOperation(operation, {
        root,
        identity: build.buildState.identity,
        configPath: pathName
      }))
    } else {
      yield* executeOperationBatch(
        [operation],
        ExecutionApproval.make({ execute: true, approveIrreversible: false }),
        operationContextFromState(build.buildState, root, pathName)
      )
    }
  }
  const planState = yield* runPipeline(build.buildState, intent, publishPipeline)
  const plan = planDocumentFromState(intent, root, pathName, planState)
  return StagedReleaseArtifactsResult.make({
    schemaVersion: "artifact-stage/v1",
    identity: build.buildState.identity,
    configPath: pathName,
    operations: staged,
    plan
  })
})

export const buildReleaseArtifactsFromIntent = Effect.fn("engine.buildReleaseArtifactsFromIntent")(function*(
  intent: ReleaseIntent,
  input: BuildReleaseArtifactsInput = {}
) {
  const options = buildOptionsFromInput(input)
  const path = yield* Path.Path
  const root = configRoot(path, options)
  return yield* buildReleaseArtifactsFromResolvedIntent(intent, input, {
    root,
    configPath: configPath(options)
  })
})

export const buildReleaseArtifacts = Effect.fn("engine.buildReleaseArtifacts")(function*(
  input: BuildReleaseArtifactsInput = {}
) {
  const options = buildOptionsFromInput(input)
  const path = yield* Path.Path
  const root = configRoot(path, options)
  const intent = yield* readIntent(options)
  return yield* buildReleaseArtifactsFromResolvedIntent(intent, input, {
    root,
    configPath: configPath(options)
  })
})

export const renderBuildArtifactsJson = (result: StagedReleaseArtifactsResult): string =>
  `${JSON.stringify(result, null, 2)}\n`

export const renderBuildArtifactsText = (result: StagedReleaseArtifactsResult): string => {
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

export const renderBuildArtifacts = (
  result: StagedReleaseArtifactsResult,
  format: StageArtifactsFormat = "text"
): string =>
  format === "json"
    ? renderBuildArtifactsJson(result)
    : renderBuildArtifactsText(result)

const releaseEvidencePath = (plan: ReleasePlanDocument, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

const releaseWorkflowEvidencePath = (plan: ReleasePlanDocument): string =>
  releaseEvidencePath(plan, "evidence")

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
  const targetPath = resolveWorkspacePath(path, root, pathName)
  return yield* fs.readFileString(targetPath)
})

const parseEvidenceJson = (contents: string, pathName: string): Effect.Effect<unknown, EvidenceReadError> =>
  parseJsonAs(
    Schema.Unknown,
    contents,
    (cause) =>
      EvidenceReadError.make({
        path: pathName,
        reason: "Evidence bundle is not valid JSON.",
        cause
      })
  )

const decodeEvidenceJson = (
  parsed: unknown,
  pathName: string,
  includeCause: boolean
): Effect.Effect<EvidenceBundle, EvidenceReadError> =>
  decodeEvidenceBundle(parsed).pipe(
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message,
        ...(includeCause ? { cause: error } : {})
      })
    )
  )

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
  const parsed = yield* parseEvidenceJson(contents, pathName)
  return yield* decodeEvidenceJson(parsed, pathName, true)
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
  const parsed = yield* parseEvidenceJson(contents, pathName)
  return yield* decodeEvidenceJson(parsed, pathName, false)
})

const emptyPlanEvidenceBundle = (plan: ReleasePlanDocument): EvidenceBundle =>
  emptyEvidenceBundle({
    releaseName: plan.state.identity.name,
    releaseVersion: plan.state.identity.version,
    notices: plan.state.notices
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
  const base = existing ?? emptyPlanEvidenceBundle(plan)
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

const writeNamedEvidence = Effect.fn("engine.writeNamedEvidence")(function*(
  plan: ReleasePlanDocument,
  name: string,
  evidence: EvidenceBundle
) {
  const path = releaseEvidencePath(plan, name)
  yield* writeEvidenceBundle(path, evidence, plan.source.root)
  return path
})

const writeWorkflowEvidence = Effect.fn("engine.writeWorkflowEvidence")(function*(
  plan: ReleasePlanDocument,
  evidence: EvidenceBundle
) {
  const path = releaseWorkflowEvidencePath(plan)
  yield* writeEvidenceBundle(path, evidence, plan.source.root)
  return path
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
          yield* writeNamedEvidence(plan, name, error.evidence)
        }
        return yield* Effect.fail(error)
      })
    ),
    Effect.flatMap((evidence) =>
      writeNamedEvidence(plan, name, evidence).pipe(
        Effect.map(() => evidence)
      )
    )
  )

const writeWorkflowEvidenceWithFailure = <E, R>(
  plan: ReleasePlanDocument,
  effect: Effect.Effect<EvidenceBundle, E | OperationFailedError, R>
): Effect.Effect<EvidenceBundle, E | OperationFailedError | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> =>
  effect.pipe(
    Effect.catchIf(isOperationFailedError, (error) =>
      Effect.gen(function*() {
        if (error.evidence !== undefined) {
          yield* writeWorkflowEvidence(plan, error.evidence)
        }
        return yield* Effect.fail(error)
      })
    ),
    Effect.flatMap((evidence) =>
      writeWorkflowEvidence(plan, evidence).pipe(
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
    verifyOperations(plan.state.operations, operationContext(plan))
  )
})

export const writeRenderEvidence = Effect.fn("engine.writeRenderEvidence")(function*(
  plan: ReleasePlanDocument,
  input: ReleaseExecutionInput = {}
) {
  const options = executionOptionsFromInput(input)
  const approval = ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: false
  })
  return yield* writeNamedEvidenceWithFailure(
    plan,
    "render",
    writeRenderFiles(plan.state.operations, approval, operationContext(plan))
  )
})

export const writeReleaseEvidence = Effect.fn("engine.writeReleaseEvidence")(function*(
  plan: ReleasePlanDocument,
  input: ReleaseExecutionInput = {}
) {
  const options = executionOptionsFromInput(input)
  return yield* writeWorkflowEvidenceWithFailure(
    plan,
    runApprovedReleaseWorkflow(plan.state.operations, approvalFromOptions(options), operationContext(plan))
  )
})

export const verifyRelease = Effect.fn("engine.verifyRelease")(function*(
  input: ReleaseSourceInput = {}
) {
  const options = sourceOptionsFromInput(input)
  const plan = yield* planRelease(options)
  const evidence = yield* writeVerificationEvidence(plan)
  return ReleaseEvidenceResult.make({ plan, evidence })
})

export const renderReleaseFiles = Effect.fn("engine.renderReleaseFiles")(function*(
  input: ReleaseExecutionInput = {}
) {
  const options = executionOptionsFromInput(input)
  const plan = yield* planRelease(options)
  const evidence = yield* writeRenderEvidence(plan, options)
  return ReleaseEvidenceResult.make({ plan, evidence })
})

export const runApprovedRelease = Effect.fn("engine.runApprovedRelease")(function*(
  input: ReleaseExecutionInput = {}
) {
  const options = executionOptionsFromInput(input)
  const plan = yield* planRelease(options)
  const evidence = yield* writeReleaseEvidence(plan, options)
  return ReleaseEvidenceResult.make({ plan, evidence })
})

const planDocumentForRunOptions = Effect.fn("engine.summary.planDocumentForRunOptions")(function*(
  options: RunOptions
) {
  const input = runOptionsSourceInput(options)
  if (typeof options.config === "object" && options.config !== null) {
    return yield* planReleaseFromIntent(options.config, input)
  }
  return yield* planRelease(input)
})

const buildArtifactsForRunOptions = Effect.fn("engine.summary.buildArtifactsForRunOptions")(function*(
  options: RunOptions
) {
  const input = runOptionsSourceInput(options)
  if (typeof options.config === "object" && options.config !== null) {
    return yield* buildReleaseArtifactsFromIntent(options.config, input)
  }
  return yield* buildReleaseArtifacts(input)
})

const runApprovedReleaseForRunOptions = Effect.fn("engine.summary.runApprovedReleaseForRunOptions")(function*(
  options: ReleaseRunOptions
) {
  const input = releaseRunOptionsSourceInput(options)
  if (typeof options.config === "object" && options.config !== null) {
    const plan = yield* planReleaseFromIntent(options.config, input)
    const evidence = yield* writeReleaseEvidence(plan, input)
    return ReleaseEvidenceResult.make({ plan, evidence })
  }
  return yield* runApprovedRelease(input)
})

const verifyReleaseForRunOptions = Effect.fn("engine.summary.verifyReleaseForRunOptions")(function*(
  options: RunOptions
) {
  const input = runOptionsSourceInput(options)
  if (typeof options.config === "object" && options.config !== null) {
    const plan = yield* planReleaseFromIntent(options.config, input)
    const evidence = yield* writeVerificationEvidence(plan)
    return ReleaseEvidenceResult.make({ plan, evidence })
  }
  return yield* verifyRelease(input)
})

export const plan = Effect.fn("engine.summary.plan")(function*(options: RunOptions = {}) {
  const document = yield* planDocumentForRunOptions(options)
  return plannedSummary(document)
})

export const build = Effect.fn("engine.summary.build")(function*(options: RunOptions = {}) {
  const result = yield* buildArtifactsForRunOptions(options)
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
    const document = yield* planDocumentForRunOptions(options)
    return {
      ...plannedSummary(document),
      executed: [],
      refused: []
    } satisfies ReleaseSummary
  }
  const result = yield* runApprovedReleaseForRunOptions(options)
  const summary = plannedSummary(result.plan)
  const executed = evidenceOperationStatuses(result.plan, result.evidence, releaseWorkflowEvidencePath(result.plan))
  return {
    ...summary,
    executed,
    refused: executed.filter((operation) => operation.status === "refused")
  } satisfies ReleaseSummary
})

export const verify = Effect.fn("engine.summary.verify")(function*(options: RunOptions = {}) {
  const result = yield* verifyReleaseForRunOptions(options)
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
