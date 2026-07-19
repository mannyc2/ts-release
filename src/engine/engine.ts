// Invariant: each workflow decodes, resolves, folds the fixed schedule, and finalizes evidence exactly once.
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import { loadReleaseIntent } from "../config/load.js"
import type { ReleaseIntent } from "../config/schema.js"
import {
  ExecutionApproval,
  Operation
} from "../grammar/operation.js"
import { ReleasePlan, SourceMetadata } from "../grammar/plan.js"
import { emptyPlanAccumulator, runPipeline, type PlanAccumulator } from "../grammar/runner.js"
import { ReleaseIdentity } from "../grammar/state.js"
import { schedule } from "../grammar/pipe.js"
import { archivePlanner } from "../features/archive.js"
import { buildPlanner } from "../features/build.js"
import { catalogGenericPlanner } from "../features/catalog-generic.js"
import { catalogHomebrewPlanner } from "../features/catalog-homebrew.js"
import { catalogScoopPlanner } from "../features/catalog-scoop.js"
import { checksumPlanner } from "../features/checksum.js"
import { importArtifactsPlanner } from "../features/import-artifacts.js"
import { npmPackPlanner } from "../features/npm-pack.js"
import { publishCatalogGenericPlanner } from "../features/publish-catalog-generic.js"
import { publishGitHubPlanner } from "../features/publish-github.js"
import {
  publishHomebrewPlanner,
  publishScoopPlanner
} from "../features/publish-catalog-git.js"
import { publishNpmPlanner } from "../features/publish-npm.js"
import { publishPyPiPlanner } from "../features/publish-pypi.js"
import { pypiWheelPlanner } from "../features/pypi-wheel.js"
import {
  makeEvidenceRef,
  operationsForPass,
  preflightEvidenceWorkflow,
  runEvidenceWorkflowInto,
  runOperations,
  type EvidenceWorkflow,
  type EvidenceRef,
  type OperationRunContext
} from "../run/executor.js"
import {
  EvidenceBundle,
  renderEvidenceJson
} from "../run/evidence.js"
import {
  EvidenceWriteError
} from "../run/errors.js"
import { resolveReleaseWorkflow, type ResolvedRelease } from "../resolve/resolved-release.js"
import { renderReleasePlan } from "../render/render.js"
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
import {
  writeWorkspaceFile
} from "../host/workspace-path.js"


export { renderEvidenceJson, renderReleasePlan }

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
    schedule(catalogHomebrewPlanner, build.release.homebrew),
    schedule(catalogScoopPlanner, build.release.scoop),
    ...(Option.isSome(build.release.catalogs) ? [schedule(catalogGenericPlanner, build.release.catalogs)] : []),
    schedule(publishNpmPlanner, build.release.npm),
    schedule(publishPyPiPlanner, build.release.pypi),
    schedule(publishGitHubPlanner, build.release.github),
    schedule(publishHomebrewPlanner, build.release.homebrew),
    schedule(publishScoopPlanner, build.release.scoop),
    ...(Option.isSome(build.release.catalogs) ? [schedule(publishCatalogGenericPlanner, build.release.catalogs)] : [])
  ])

const loadReleaseBuild = Effect.fn("engine.loadReleaseBuild")(function*(options: RunOptions) {
  const source = yield* loadReleaseIntent(options.config, { root: options.workspace, configPath: options.configPath })
  return { source, build: yield* resolveReleaseBuild(source.intent, source.root, options.snapshot ?? false) }
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
  const { build, source } = yield* loadReleaseBuild(options)
  const state = yield* resolveReleasePlan(build)
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

export type StagedReleaseArtifactsResult = Effect.Success<ReturnType<typeof buildReleaseArtifacts>>

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
    "artifacts:",
    ...(artifacts.length === 0 ? ["  none"] : artifacts.map((artifact) => `  ${artifact.id} ${artifact.path}`))
  ]
  return `${lines.join("\n")}\n`
}

const releaseEvidencePath = (plan: ReleasePlan, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

export const writeEvidenceBundle = Effect.fn("engine.writeEvidenceBundle")(function*(
  pathName: string,
  bundle: EvidenceBundle,
  root: string = "."
) {
  yield* writeWorkspaceFile(root, pathName, renderEvidenceJson(bundle), (path, reason, cause) =>
    EvidenceWriteError.make({ path, reason, ...(cause === undefined ? {} : { cause }) }))
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
  function*<A, E, R>(plan: ReleasePlan, name: string, ref: EvidenceRef, workflow: Effect.Effect<A, E, R>) {
    return yield* workflow.pipe(Effect.onExit((exit) => finalizeEvidenceOnExit(plan, name, ref, exit)))
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

const planWithEvidence = Effect.fn("engine.planWithEvidence")(function*<E, R>(
  options: RunOptions,
  write: (plan: ReleasePlan) => Effect.Effect<EvidenceBundle, E, R>
) {
  const plan = yield* planRelease(options)
  return { plan, evidence: yield* write(plan) }
})

export const verifyRelease = Effect.fn("engine.verifyRelease")(function*(
  options: RunOptions = {}
) {
  return yield* planWithEvidence(options, writeVerificationEvidence)
})

export const renderReleaseFiles = Effect.fn("engine.renderReleaseFiles")(function*(
  options: RunOptions = {}
) {
  const approval = ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: false
  })
  return yield* planWithEvidence(options, (plan) => writeWorkflowEvidence(plan, "render", "render", approval))
})

export const runApprovedRelease = Effect.fn("engine.runApprovedRelease")(function*(
  options: RunOptions = {}
) {
  return yield* planWithEvidence(options, (plan) => writeReleaseEvidence(plan, options))
})

export const plan = Effect.fn("engine.summary.plan")(function*(options: RunOptions = {}) {
  const document = yield* planRelease(options)
  return plannedSummary(document)
})

export const build = Effect.fn("engine.summary.build")(function*(options: RunOptions = {}) {
  const result = yield* buildReleaseArtifacts(options)
  return {
    ...plannedSummary(result.plan),
    stagedArtifacts: stagedArtifactSummaries(result.plan, result.operations)
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
  const executed = evidenceOperationStatuses(
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
    checks: evidenceOperationStatuses(
      result.plan,
      result.evidence,
      releaseEvidencePath(result.plan, "verification")
    )
  } satisfies VerifySummary
})

export type { ArtifactSummary, ReleasePlanSummary, BuildSummary, ReleaseSummary, VerifySummary }
