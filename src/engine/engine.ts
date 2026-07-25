// Invariant: each workflow decodes, resolves, folds the fixed schedule, and finalizes evidence exactly once.
import * as Effect from "effect/Effect"
import { configPath, loadReleaseIntent } from "../config/load.js"
import { ConfigError } from "../config/errors.js"
import type { ReleaseIntent } from "../config/schema.js"
import { Operation, PublishedAssetsVerifyAction, RetryPolicy } from "../grammar/operation.js"
import { ExecutionApproval } from "../grammar/approval.js"
import { ReleasePlan } from "../grammar/plan.js"
import { validateReleasePlan } from "../grammar/plan-rules.js"
import { emptyPlanAccumulator, runPipeline, type PlanAccumulator } from "../grammar/accumulator.js"
import { ReleaseIdentity } from "../grammar/state.js"
import { scheduled } from "../grammar/planner.js"
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
import { diagnoseRelease, type DoctorReleaseInput } from "../doctor/doctor.js"
import { releaseEvidencePath, writeWorkflowEvidence, type Invocation } from "../run/workflow.js"
import { continueSkipSet } from "../run/workflow.js"
import { ContinueRequiresExecuteError, ContinueSnapshotRefusedError } from "../run/errors.js"


export { renderBuildArtifacts, renderEvidenceJson, renderReleasePlan }

export interface RunOptions {
  readonly config?: string | ReleaseIntent | undefined
  readonly configPath?: string | undefined
  readonly workspace?: string | undefined
  readonly snapshot?: boolean | undefined
  readonly execute?: boolean | undefined
  readonly approvePublish?: boolean | undefined
  readonly continueRun?: boolean | undefined
  readonly verifyPublished?: boolean | undefined
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
      ...scheduled(hooksBeforePlanner, release.hooksBefore),
      ...scheduled(buildPlanner, release.builds),
      ...scheduled(npmPackPlanner, release.npmPackage),
      ...scheduled(pypiWheelPlanner, release.pypiWheels),
      ...scheduled(importArtifactsPlanner, release.artifacts),
      ...scheduled(archivePlanner, release.archives),
      ...scheduled(checksumPlanner, release.checksum)
    ]
  )
  return { release, buildState }
})

const resolveReleasePlan = (build: { readonly release: ResolvedRelease; readonly buildState: PlanAccumulator }) =>
  runPipeline(build.buildState, [
    ...scheduled(catalogGenericPlanner, build.release.catalogs),
    ...scheduled(publishNpmPlanner, build.release.npm),
    ...scheduled(publishPyPiPlanner, build.release.pypi),
    ...scheduled(publishGitHubPlanner, build.release.github),
    ...scheduled(publishCustomPlanner, build.release.custom),
    ...scheduled(publishCatalogGenericPlanner, build.release.catalogs),
    ...scheduled(hooksAfterPlanner, build.release.hooksAfter)
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
  state: PlanAccumulator
): ReleasePlan =>
  ReleasePlan.make({
    schemaVersion: "release-plan/v5",
    identity: state.identity,
    artifacts: state.artifacts,
    operations: withDefaultVerifyRetry(state.operations, release.retry),
    evidenceDirectory: release.evidenceDirectory
  })

const withPublishedAssetsVerify = (release: ResolvedRelease, plan: ReleasePlan): ReleasePlan => {
  const github = plan.operations.find(({ action }) => action._tag === "github-release-create")
  if (github?.action._tag !== "github-release-create") return plan
  const githubAction = github.action
  const checksum = plan.artifacts.find((artifact) =>
    artifact.extra._tag === "checksum-file" &&
    githubAction.assets.some(({ artifactId }) => artifactId === artifact.id))
  if (checksum?.extra._tag !== "checksum-file") return plan
  const checksumAsset = githubAction.assets.find(({ artifactId }) => artifactId === checksum.id)
  if (checksumAsset === undefined) return plan
  const covered = new Set(checksum.extra.coversArtifactIds)
  const operation = Operation.make({
    id: "published:github-assets-verify",
    pipeId: "publish:github",
    description: "Verify published GitHub assets against the release checksum file.",
    phase: "verify",
    risk: "read-only",
    action: PublishedAssetsVerifyAction.make({
      repository: githubAction.repository,
      tag: githubAction.tag,
      checksumAssetName: checksumAsset.name,
      algorithm: checksum.extra.algorithm,
      assetNames: githubAction.assets.filter(({ artifactId }) => covered.has(artifactId)).map(({ name }) => name)
    }),
    ...(release.retry === undefined ? {} : { retry: release.retry })
  })
  return ReleasePlan.make({ ...plan, operations: [...plan.operations, operation] })
}

const loadReleasePlan = Effect.fn("engine.loadReleasePlan")(function*(options: RunOptions) {
  const { build, source } = yield* loadReleaseBuild(options)
  const state = yield* resolveReleasePlan(build)
  const planned = releasePlanFromAccumulator(build.release, state)
  // Constructed plans pass the same integrity gate durable plans face on decode (D4).
  const plan = yield* validateReleasePlan(
    options.verifyPublished === true ? withPublishedAssetsVerify(build.release, planned) : planned
  )
  const invocation: Invocation = { root: source.root, configPath: source.sourcePath }
  return { release: build.release, plan, invocation }
})

export const planRelease = Effect.fn("engine.planRelease")(function*(options: RunOptions = {}) {
  return (yield* loadReleasePlan(options)).plan
})

// v5 moved root/configPath out of the durable plan (D3), so surfaces that need those
// machine-local facts take them from the invocation the same run produced.
export const planReleaseWithInvocation = Effect.fn("engine.planReleaseWithInvocation")(
  function*(options: RunOptions = {}) {
    const { plan, invocation } = yield* loadReleasePlan(options)
    return { plan, invocation }
  }
)

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

const planWithEvidence = Effect.fn("engine.planWithEvidence")(function*<E, R>(
  options: RunOptions,
  write: (plan: ReleasePlan, invocation: Invocation) => Effect.Effect<EvidenceBundle, E, R>
) {
  const { plan, invocation } = yield* loadReleasePlan(options)
  return { plan, evidence: yield* write(plan, invocation) }
})

export const plan = Effect.fn("engine.summary.plan")(function*(options: RunOptions = {}) {
  const document = yield* planRelease(options)
  return plannedSummary(document)
})

export const build = Effect.fn("engine.summary.build")(function*(options: RunOptions = {}) {
  const { plan, invocation } = yield* loadReleasePlan(options)
  const evidence = yield* writeWorkflowEvidence(
    plan,
    "build",
    "build",
    ExecutionApproval.make({ execute: true, approveIrreversible: false }),
    new Set(),
    invocation
  )
  return {
    ...plannedSummary(plan),
    stagedArtifacts: stagedArtifactSummaries(plan),
    plan,
    evidence,
    invocation
  } satisfies BuildSummary & {
    readonly plan: ReleasePlan
    readonly evidence: EvidenceBundle
    readonly invocation: Invocation
  }
})

export const release = Effect.fn("engine.summary.release")(function*(options: RunOptions = {}) {
  if (options.continueRun === true && options.execute !== true) {
    return yield* Effect.fail(ContinueRequiresExecuteError.make())
  }
  if (options.continueRun === true && options.snapshot === true) {
    return yield* Effect.fail(ContinueSnapshotRefusedError.make())
  }
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
  const result = yield* planWithEvidence(options, (document, invocation) =>
    Effect.flatMap(
      options.continueRun === true
        ? continueSkipSet(document, invocation.root)
        : Effect.succeed(new Set<string>()),
      (skip) => writeWorkflowEvidence(document, "evidence", "release", approval, skip, invocation)
    ))
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
    (document, invocation) =>
      writeWorkflowEvidence(document, "verification", "verification", ExecutionApproval.none, new Set(), invocation))
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
