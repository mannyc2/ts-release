import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import { parseReleaseIntent } from "../src/config/load.js"
import { planRelease } from "../src/engine/engine.js"
import { ReleasePlan } from "../src/grammar/plan.js"
import {
  renderPlanJson,
  renderPlanMarkdown,
  renderPlanSummary,
  renderPlanText
} from "../src/render/render.js"
import {
  makeEvidenceRef,
  preflightEvidenceWorkflow,
  runEvidenceWorkflowInto,
  type EvidenceWorkflow,
  type OperationRunContext
} from "../src/run/executor.js"
import { UnsupportedArtifactStagerLayer } from "../src/pack/stager.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { ExecutionApproval, type Operation } from "../src/grammar/operation.js"
import { TestGitHubApiLayer } from "./helpers.js"
const OperationArmTestLayer = Layer.mergeAll(
  makeTestReleaseHttpLayer(),
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer
)
export interface TestPlan {
  readonly document: ReleasePlan
  readonly identity: ReleasePlan["identity"]
  readonly evidenceDirectory: string
  readonly artifacts: ReleasePlan["artifacts"]
  readonly surfaceIds: ReadonlyArray<string>
  readonly operations: ReadonlyArray<Operation>
}
const operationSurfaceId = (operation: Operation): string | undefined => {
  const parts = operation.pipeId.split(":")
  const surfaceId = parts[1]
  return operation.pipeId.startsWith("publish:") || operation.pipeId.startsWith("catalog:")
    ? surfaceId
    : undefined
}
export const plannedSurfaceIds = (operations: ReadonlyArray<Operation>): ReadonlyArray<string> =>
  [...new Set(operations.flatMap((operation) => {
    const surfaceId = operationSurfaceId(operation)
    return surfaceId === undefined ? [] : [surfaceId]
  }))].sort()
export const createTestPlan = (config: string, root = ".", configPath?: string | undefined) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config, configPath)
    const document = yield* planRelease({
      workspace: root,
      config: intent,
      configPath
    })
    return {
      document,
      identity: document.identity,
      evidenceDirectory: document.evidenceDirectory,
      artifacts: document.artifacts,
      surfaceIds: plannedSurfaceIds(document.operations),
      operations: document.operations
    }
  })
const operationContext = (plan: TestPlan) => ({
  root: plan.document.source.root,
  identity: plan.document.identity,
  artifacts: plan.document.artifacts,
  notices: plan.document.notices,
  configPath: plan.document.source.configPath
})
export const runEvidenceWorkflow = Effect.fn("test.runEvidenceWorkflow")(function*(
  operations: ReadonlyArray<Operation>, workflow: EvidenceWorkflow,
  approval: ExecutionApproval, context: OperationRunContext
) {
  yield* preflightEvidenceWorkflow(operations, workflow, approval, context)
  const ref = yield* makeEvidenceRef(context)
  yield* runEvidenceWorkflowInto(ref, operations, workflow, approval, context)
  return yield* Ref.get(ref)
})
export const validateTestPlan = (plan: TestPlan) =>
  runEvidenceWorkflow(
    plan.operations,
    "validation",
    ExecutionApproval.none,
    operationContext(plan)
  ).pipe(
    Effect.provide(OperationArmTestLayer)
  )
export const renderTestPlan = (
  plan: TestPlan,
  approval: ExecutionApproval = ExecutionApproval.make({ execute: true, approveIrreversible: false })
) =>
  runEvidenceWorkflow(plan.operations, "render", approval, operationContext(plan)).pipe(
    Effect.provide(OperationArmTestLayer)
  )
export const runApprovedTestPlan = (
  plan: TestPlan,
  approval: ExecutionApproval
) =>
  runEvidenceWorkflow(plan.operations, "release", approval, operationContext(plan)).pipe(
    Effect.provide(OperationArmTestLayer)
  )
export const renderTestPlanText = (plan: TestPlan): string =>
  renderPlanText(plan.document)
export const renderTestPlanJson = (plan: TestPlan): string =>
  renderPlanJson(plan.document)
export const renderTestPlanSummary = (plan: TestPlan): string =>
  renderPlanSummary(plan.document)
export const renderTestPlanMarkdown = (plan: TestPlan): string =>
  renderPlanMarkdown(plan.document)
