import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import { loadReleaseIntent } from "../config/load.js"
import type { ReleaseIntent } from "../config/schema.js"
import { readOptionalEnv } from "../host/platform.js"
import { IdentityError, PlanError } from "../pipeline/errors.js"
import {
  ExecutionApproval,
  Operation
} from "../pipeline/operation.js"
import { ReleasePlan, SourceMetadata } from "../pipeline/plan.js"
import { emptyPlanAccumulator, runPipeline, type PlanAccumulator } from "../pipeline/runner.js"
import { ReleaseIdentity } from "../pipeline/state.js"
import { schedule } from "../pipeline/pipe.js"
import { archivePlanner } from "../pipes/archive.js"
import { buildPlanner } from "../pipes/build.js"
import { catalogGenericPlanner } from "../pipes/catalog-generic.js"
import { catalogHomebrewPlanner } from "../pipes/catalog-homebrew.js"
import { catalogScoopPlanner } from "../pipes/catalog-scoop.js"
import { checksumPlanner } from "../pipes/checksum.js"
import { importArtifactsPlanner } from "../pipes/import-artifacts.js"
import { npmPackPlanner } from "../pipes/npm-pack.js"
import { publishCatalogGenericPlanner } from "../pipes/publish-catalog-generic.js"
import { publishGitHubPlanner } from "../pipes/publish-github.js"
import {
  publishHomebrewPlanner,
  publishScoopPlanner
} from "../pipes/publish-catalog-git.js"
import { publishNpmPlanner } from "../pipes/publish-npm.js"
import { publishPyPiPlanner } from "../pipes/publish-pypi.js"
import { pypiWheelPlanner } from "../pipes/pypi-wheel.js"
import {
  makeEvidenceRef,
  operationsForPass,
  preflightEvidenceWorkflow,
  runEvidenceWorkflowInto,
  runOperations,
  type EvidenceWorkflow,
  type EvidenceRef,
  type OperationRunContext
} from "./executor.js"
import {
  EvidenceBundle,
  renderEvidenceJson
} from "./evidence.js"
import {
  EvidenceWriteError,
  ReleaseNormalizationError
} from "./errors.js"
import { resolveReleaseWorkflow, type ResolvedRelease } from "./resolved-release.js"
import { renderReleasePlan } from "./render.js"
import {
  evidenceOperationStatuses,
  plannedSummary,
  stagedArtifactSummaries,
  type ArtifactSummary,
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
  resolveWorkspaceWritePathEffect
} from "../internal/workspace-path.js"


export { renderEvidenceJson, renderReleasePlan }

export interface StagedReleaseArtifactsResult {
  readonly schemaVersion: "artifact-stage/v1"
  readonly identity: ReleaseIdentity
  readonly configPath: string
  readonly operations: ReadonlyArray<StagedArtifactOperationResult>
  readonly plan: ReleasePlan
}

export interface ReleaseEvidenceResult {
  readonly plan: ReleasePlan
  readonly evidence: EvidenceBundle
}

export interface RunOptions {
  readonly config?: string | ReleaseIntent | undefined
  readonly configPath?: string | undefined
  readonly workspace?: string | undefined
  readonly snapshot?: boolean | undefined
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

const resolveReleaseBuild = Effect.fn("engine.resolveReleaseBuild")(function*(
  intent: ReleaseIntent,
  root: string,
  snapshot: boolean
) {
  const release = yield* resolveReleaseWorkflow(intent, root, snapshot).pipe(
    Effect.mapError(identityErrorToNormalization)
  )
  const buildState = yield* runPipeline(
    emptyPlanAccumulator(release.identity),
    [
      schedule(buildPlanner, release.builds),
      schedule(npmPackPlanner, release.npmPackage),
      schedule(pypiWheelPlanner, release.pypiWheels),
      schedule(importArtifactsPlanner, release.artifacts),
      schedule(archivePlanner, release.archives),
      schedule(checksumPlanner, release.checksum)
    ]
  ).pipe(
    Effect.mapError(planErrorToNormalization)
  )
  return { release, buildState }
})

const releasePlanFromAccumulator = (
  release: ResolvedRelease,
  root: string,
  configPathName: string | undefined,
  state: PlanAccumulator
): ReleasePlan =>
  ReleasePlan.make({
    schemaVersion: "release-plan/v3",
    identity: state.identity,
    artifacts: state.artifacts,
    operations: state.operations,
    notices: state.notices,
    source: SourceMetadata.make({
      root,
      configPath: configPathName
    }),
    evidenceDirectory: release.evidenceDirectory
  })

export const planRelease = Effect.fn("engine.planRelease")(function*(
  options: RunOptions = {}
) {
  const source = yield* loadReleaseIntent(options.config, {
    root: options.workspace,
    configPath: options.configPath
  })
  const build = yield* resolveReleaseBuild(source.intent, source.root, options.snapshot ?? false)
  const state = yield* runPipeline(build.buildState, [
    schedule(catalogHomebrewPlanner, build.release.homebrew),
    schedule(catalogScoopPlanner, build.release.scoop),
    ...(Option.isSome(build.release.catalogs) ? [schedule(catalogGenericPlanner, build.release.catalogs)] : []),
    schedule(publishNpmPlanner, build.release.npm),
    schedule(publishPyPiPlanner, build.release.pypi),
    schedule(publishGitHubPlanner, build.release.github),
    schedule(publishHomebrewPlanner, build.release.homebrew),
    schedule(publishScoopPlanner, build.release.scoop),
    ...(Option.isSome(build.release.catalogs)
      ? [schedule(publishCatalogGenericPlanner, build.release.catalogs)]
      : [])
  ])
  return releasePlanFromAccumulator(build.release, source.root, source.sourcePath, state)
})

const isStageOperation = (operation: Operation): operation is StageOperation =>
  operation.action._tag === "stage"

const operationContext = (
  state: Pick<PlanAccumulator, "identity" | "artifacts" | "notices">,
  root: string,
  configPathName: string | undefined
): OperationRunContext => ({
  root,
  identity: state.identity,
  artifacts: state.artifacts,
  notices: state.notices,
  configPath: configPathName
})

const planContext = (plan: ReleasePlan): OperationRunContext =>
  operationContext(plan, plan.source.root, plan.source.configPath)

export const buildReleaseArtifacts = Effect.fn("engine.buildReleaseArtifacts")(function*(
  options: RunOptions = {}
) {
  const source = yield* loadReleaseIntent(options.config, {
    root: options.workspace,
    configPath: options.configPath
  })
  const pathName = source.sourcePath ?? "inline config"
  const build = yield* resolveReleaseBuild(source.intent, source.root, options.snapshot ?? false)
  const staged: Array<StagedArtifactOperationResult> = []
  for (const operation of operationsForPass(build.buildState.operations, "build")) {
    if (isStageOperation(operation)) {
      staged.push(yield* stageArtifactOperation(operation, {
        root: source.root,
        identity: build.buildState.identity,
        configPath: pathName
      }))
    } else {
      yield* runOperations(
        [operation],
        ExecutionApproval.make({ execute: true, approveIrreversible: false }),
        operationContext(build.buildState, source.root, pathName)
      )
    }
  }
  const planState = yield* runPipeline(build.buildState, [
    schedule(catalogHomebrewPlanner, build.release.homebrew),
    schedule(catalogScoopPlanner, build.release.scoop),
    ...(Option.isSome(build.release.catalogs) ? [schedule(catalogGenericPlanner, build.release.catalogs)] : []),
    schedule(publishNpmPlanner, build.release.npm),
    schedule(publishPyPiPlanner, build.release.pypi),
    schedule(publishGitHubPlanner, build.release.github),
    schedule(publishHomebrewPlanner, build.release.homebrew),
    schedule(publishScoopPlanner, build.release.scoop),
    ...(Option.isSome(build.release.catalogs)
      ? [schedule(publishCatalogGenericPlanner, build.release.catalogs)]
      : [])
  ])
  const plan = releasePlanFromAccumulator(build.release, source.root, source.sourcePath, planState)
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

const releaseEvidencePath = (plan: ReleasePlan, name: string): string =>
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

const finalizeEvidenceOnExit = <A, E>(
  plan: ReleasePlan,
  name: string,
  ref: EvidenceRef,
  workflowExit: Exit.Exit<A, E>
): Effect.Effect<void, E | EvidenceWriteError, FileSystem.FileSystem | Path.Path> =>
  Ref.get(ref).pipe(
    Effect.flatMap((evidence) =>
      writeEvidenceBundle(releaseEvidencePath(plan, name), evidence, plan.source.root)
    ),
    Effect.catchCause((writeCause) =>
      Exit.isFailure(workflowExit)
        ? Effect.failCause(Cause.combine(writeCause, workflowExit.cause))
        : Effect.failCause(writeCause)
    )
  )

export const runEvidenceWorkflowWithFinalizer = Effect.fn("engine.runEvidenceWorkflowWithFinalizer")(
  function*<A, E, R>(
    plan: ReleasePlan,
    name: string,
    ref: EvidenceRef,
    workflow: Effect.Effect<A, E, R>
  ): Effect.fn.Return<A, E | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> {
    return yield* workflow.pipe(
      Effect.onExit((workflowExit) => finalizeEvidenceOnExit(plan, name, ref, workflowExit))
    )
  }
)

const writeWorkflowEvidence = Effect.fn("engine.writeWorkflowEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  workflow: EvidenceWorkflow,
  approval: ExecutionApproval
) {
  const context = planContext(plan)
  yield* preflightEvidenceWorkflow(plan.operations, workflow, approval, context)
  const ref = yield* makeEvidenceRef(context)
  return yield* runEvidenceWorkflowWithFinalizer(
    plan,
    name,
    ref,
    runEvidenceWorkflowInto(ref, plan.operations, workflow, approval, context)
      .pipe(Effect.andThen(Ref.get(ref)))
  )
})

export const writeVerificationEvidence = Effect.fn("engine.writeVerificationEvidence")(function*(
  plan: ReleasePlan
) {
  return yield* writeWorkflowEvidence(plan, "verification", "verification", ExecutionApproval.none)
})

export const writeReleaseEvidence = Effect.fn("engine.writeReleaseEvidence")(function*(
  plan: ReleasePlan,
  options: RunOptions = {}
) {
  const approval = ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: options.approvePublish ?? false
  })
  return yield* writeWorkflowEvidence(plan, "evidence", "release", approval)
})

export const verifyRelease = Effect.fn("engine.verifyRelease")(function*(
  options: RunOptions = {}
) {
  const plan = yield* planRelease(options)
  const evidence = yield* writeVerificationEvidence(plan)
  return { plan, evidence } satisfies ReleaseEvidenceResult
})

export const renderReleaseFiles = Effect.fn("engine.renderReleaseFiles")(function*(
  options: RunOptions = {}
) {
  const plan = yield* planRelease(options)
  const approval = ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: false
  })
  const evidence = yield* writeWorkflowEvidence(plan, "render", "render", approval)
  return { plan, evidence } satisfies ReleaseEvidenceResult
})

export const runApprovedRelease = Effect.fn("engine.runApprovedRelease")(function*(
  options: RunOptions = {}
) {
  const plan = yield* planRelease(options)
  const evidence = yield* writeReleaseEvidence(plan, options)
  return { plan, evidence } satisfies ReleaseEvidenceResult
})

export const plan = Effect.fn("engine.summary.plan")(function*(options: RunOptions = {}) {
  const document = yield* planRelease(options)
  return plannedSummary(document)
})

export const build = Effect.fn("engine.summary.build")(function*(options: RunOptions = {}) {
  const result = yield* buildReleaseArtifacts(options)
  return {
    ...plannedSummary(result.plan),
    stagedArtifacts: yield* stagedArtifactSummaries(result.plan, result.operations)
  } satisfies BuildSummary
})

export const release = Effect.fn("engine.summary.release")(function*(options: RunOptions = {}) {
  if (options.execute !== true) {
    const document = yield* planRelease(options)
    return {
      ...plannedSummary(document),
      executed: [],
      refused: []
    } satisfies ReleaseSummary
  }
  const result = yield* runApprovedRelease(options)
  const summary = plannedSummary(result.plan)
  const executed = yield* evidenceOperationStatuses(
    result.plan,
    result.evidence,
    releaseEvidencePath(result.plan, "evidence")
  )
  return {
    ...summary,
    executed,
    refused: executed.filter((operation) => operation.status === "refused")
  } satisfies ReleaseSummary
})

export const verify = Effect.fn("engine.summary.verify")(function*(options: RunOptions = {}) {
  const result = yield* verifyRelease(options)
  return {
    identity: plannedSummary(result.plan).identity,
    checks: yield* evidenceOperationStatuses(
      result.plan,
      result.evidence,
      releaseEvidencePath(result.plan, "verification")
    )
  } satisfies VerifySummary
})

export const envExists = Effect.fn("engine.envExists")(function*(name: string) {
  const value = yield* readOptionalEnv(name)
  return value !== undefined
})

export type { ArtifactSummary, ReleasePlanSummary, BuildSummary, ReleaseSummary, VerifySummary }
