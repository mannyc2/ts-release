// Invariant: each workflow decodes, resolves, folds the fixed schedule, and finalizes evidence exactly once.
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { configPath, loadReleaseIntent } from "../config/load.js"
import { ConfigError } from "../config/errors.js"
import type { ReleaseIntent } from "../config/schema.js"
import { Operation, RetryPolicy } from "../grammar/operation.js"
import { ExecutionApproval } from "../grammar/approval.js"
import { ReleasePlan, SourceMetadata } from "../grammar/plan.js"
import { emptyPlanAccumulator, runPipeline, type PlanAccumulator } from "../grammar/accumulator.js"
import { ReleaseIdentity } from "../grammar/state.js"
import { schedule } from "../grammar/planner.js"
import { archivePlanner } from "../features/process/archive.js"
import { buildPlanner } from "../features/build/build.js"
import { hooksBeforePlanner } from "../features/build/hooks.js"
import { catalogGenericPlanner } from "../features/catalog/file.js"
import { checksumPlanner } from "../features/process/checksum.js"
import { importArtifactsPlanner } from "../features/build/import-artifacts.js"
import { npmPackPlanner } from "../features/build/npm-pack.js"
import { publishCatalogGenericPlanner } from "../features/publish/catalog-file.js"
import { publishGitHubPlanner } from "../features/publish/github.js"
import { publishNpmPlanner } from "../features/publish/npm.js"
import { publishPyPiPlanner } from "../features/publish/pypi.js"
import { hooksAfterPlanner, publishCustomPlanner } from "../features/publish/hooks.js"
import { pypiWheelPlanner } from "../features/build/pypi-wheel.js"
import {
  operationsForPass,
  runOperations,
  type OperationRunContext
} from "../run/executor.js"
import {
  EvidenceBundle,
  renderEvidenceJson
} from "../run/evidence.js"
import { resolveReleaseWorkflow, type ResolvedRelease } from "../resolve/resolved-release.js"
import { renderBuildArtifacts, renderReleasePlan } from "../render/render.js"
import {
  evidenceOperationStatuses,
  plannedSummary,
  stagedArtifactSummaries,
  type ArtifactSummary,
  type BuildSummary,
  type ReleasePlanSummary,
  type ReleaseSummary,
  type VerifySummary
} from "../render/summary.js"
import {
  ArtifactStager,
  type StagedArtifactOperationResult,
  type StageOperation
} from "../pack/stager.js"
import { diagnoseRelease, type DoctorReleaseInput } from "../doctor/doctor.js"
import { releaseEvidencePath, writeWorkflowEvidence } from "../run/workflow.js"


export { renderBuildArtifacts, renderEvidenceJson, renderReleasePlan }

export interface RunOptions {
  readonly config?: string | ReleaseIntent | undefined
  readonly configPath?: string | undefined
  readonly workspace?: string | undefined
  readonly snapshot?: boolean | undefined
  readonly execute?: boolean | undefined
  readonly approvePublish?: boolean | undefined
}

const resolveReleaseBuild = Effect.fn("engine.resolveReleaseBuild")(function*(
  intent: ReleaseIntent,
  root: string,
  snapshot: boolean
) {
  const release = yield* resolveReleaseWorkflow(intent, root, snapshot)
  const buildState = yield* runPipeline(
    emptyPlanAccumulator(release.identity),
    [
      ...(Option.isSome(release.hooksBefore) ? [schedule(hooksBeforePlanner, release.hooksBefore)] : []),
      schedule(buildPlanner, release.builds),
      schedule(npmPackPlanner, release.npmPackage),
      schedule(pypiWheelPlanner, release.pypiWheels),
      schedule(importArtifactsPlanner, release.artifacts),
      schedule(archivePlanner, release.archives),
      schedule(checksumPlanner, release.checksum)
    ]
  )
  return { release, buildState }
})

const resolveReleasePlan = (build: { readonly release: ResolvedRelease; readonly buildState: PlanAccumulator }) =>
  runPipeline(build.buildState, [
    ...(Option.isSome(build.release.catalogs) ? [schedule(catalogGenericPlanner, build.release.catalogs)] : []),
    schedule(publishNpmPlanner, build.release.npm),
    schedule(publishPyPiPlanner, build.release.pypi),
    schedule(publishGitHubPlanner, build.release.github),
    ...(Option.isSome(build.release.custom) ? [schedule(publishCustomPlanner, build.release.custom)] : []),
    ...(Option.isSome(build.release.catalogs) ? [schedule(publishCatalogGenericPlanner, build.release.catalogs)] : []),
    ...(Option.isSome(build.release.hooksAfter) ? [schedule(hooksAfterPlanner, build.release.hooksAfter)] : [])
  ])

const loadReleaseBuild = Effect.fn("engine.loadReleaseBuild")(function*(options: RunOptions) {
  const source = yield* loadReleaseIntent(options.config, { root: options.workspace, configPath: options.configPath })
  return { source, build: yield* resolveReleaseBuild(source.intent, source.root, options.snapshot ?? false) }
})

const withDefaultVerifyRetry = (
  operations: ReadonlyArray<Operation>,
  retry: RetryPolicy | undefined
): ReadonlyArray<Operation> =>
  retry === undefined ? operations : operations.map((operation) =>
    operation.phase === "verify" && operation.retry === undefined
      ? Operation.make({ ...operation, retry })
      : operation)

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
    operations: withDefaultVerifyRetry(state.operations, release.retry),
    notices: state.notices,
    source: SourceMetadata.make({
      root,
      configPath: configPathName
    }),
    evidenceDirectory: release.evidenceDirectory
  })

const loadReleasePlan = Effect.fn("engine.loadReleasePlan")(function*(options: RunOptions) {
  const { build, source } = yield* loadReleaseBuild(options)
  const state = yield* resolveReleasePlan(build)
  return { release: build.release, plan: releasePlanFromAccumulator(build.release, source.root, source.sourcePath, state) }
})

export const planRelease = Effect.fn("engine.planRelease")(function*(options: RunOptions = {}) {
  return (yield* loadReleasePlan(options)).plan
})

export const doctorRelease = Effect.fn("engine.doctorRelease")(function*(input: DoctorReleaseInput = {}) {
  const planned = loadReleasePlan({ workspace: input.root, configPath: input.configPath }).pipe(
    Effect.map(({ plan }) => ({
      identity: plan.identity,
      operations: plan.operations,
      evidenceDirectory: plan.evidenceDirectory
    })),
    Effect.mapError((error) => ({ configFailed: error instanceof ConfigError, message: error.message }))
  )
  return yield* diagnoseRelease(input, configPath(input), planned)
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

const stageReleaseArtifacts = Effect.fn("engine.stageReleaseArtifacts")(function*(
  options: RunOptions = {}
) {
  const { build, source } = yield* loadReleaseBuild(options)
  const pathName = source.sourcePath ?? "inline config"
  const staged: Array<StagedArtifactOperationResult> = []
  for (const operation of operationsForPass(build.buildState.operations, "build")) {
    if (isStageOperation(operation)) {
      staged.push(yield* (yield* ArtifactStager).stage(operation, {
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
  const planState = yield* resolveReleasePlan(build)
  const plan = releasePlanFromAccumulator(build.release, source.root, source.sourcePath, planState)
  return {
    schemaVersion: "artifact-stage/v1",
    identity: build.buildState.identity,
    configPath: pathName,
    operations: staged,
    plan
  }
})

const planWithEvidence = Effect.fn("engine.planWithEvidence")(function*<E, R>(
  options: RunOptions,
  write: (plan: ReleasePlan) => Effect.Effect<EvidenceBundle, E, R>
) {
  const plan = yield* planRelease(options)
  return { plan, evidence: yield* write(plan) }
})

export const plan = Effect.fn("engine.summary.plan")(function*(options: RunOptions = {}) {
  const document = yield* planRelease(options)
  return plannedSummary(document)
})

export const build = Effect.fn("engine.summary.build")(function*(options: RunOptions = {}) {
  const result = yield* stageReleaseArtifacts(options)
  return {
    ...plannedSummary(result.plan),
    stagedArtifacts: stagedArtifactSummaries(result.plan, result.operations),
    plan: result.plan,
    stagedOperations: result.operations
  } satisfies BuildSummary & {
    readonly plan: ReleasePlan
    readonly stagedOperations: ReadonlyArray<StagedArtifactOperationResult>
  }
})

export const release = Effect.fn("engine.summary.release")(function*(options: RunOptions = {}) {
  if (options.execute !== true) {
    const document = yield* planRelease(options)
    return {
      ...plannedSummary(document),
      executed: [],
      refused: [],
      plan: document,
      evidence: undefined
    } satisfies ReleaseSummary & { readonly plan: ReleasePlan; readonly evidence: EvidenceBundle | undefined }
  }
  const approval = ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: options.approvePublish ?? false
  })
  const result = yield* planWithEvidence(options,
    (document) => writeWorkflowEvidence(document, "evidence", "release", approval))
  const summary = plannedSummary(result.plan)
  const executed = evidenceOperationStatuses(
    result.plan,
    result.evidence,
    releaseEvidencePath(result.plan, "evidence")
  )
  return {
    ...summary,
    executed,
    refused: executed.filter((operation) => operation.status === "refused"),
    plan: result.plan,
    evidence: result.evidence
  } satisfies ReleaseSummary & { readonly plan: ReleasePlan; readonly evidence: EvidenceBundle }
})

export const verify = Effect.fn("engine.summary.verify")(function*(options: RunOptions = {}) {
  const result = yield* planWithEvidence(options,
    (document) => writeWorkflowEvidence(document, "verification", "verification", ExecutionApproval.none))
  return {
    identity: plannedSummary(result.plan).identity,
    checks: evidenceOperationStatuses(
      result.plan,
      result.evidence,
      releaseEvidencePath(result.plan, "verification")
    ),
    plan: result.plan,
    evidence: result.evidence
  } satisfies VerifySummary & { readonly plan: ReleasePlan; readonly evidence: EvidenceBundle }
})

export type { ArtifactSummary, ReleasePlanSummary, BuildSummary, ReleaseSummary, VerifySummary }
