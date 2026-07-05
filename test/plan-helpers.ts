import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { planReleaseFromIntent } from "../src/engine/engine.js"
import { ReleasePlanDocument } from "../src/engine/plan-document.js"
import {
  renderPlanJson,
  renderPlanMarkdown,
  renderPlanOperationExplanation,
  renderPlanSummary,
  renderPlanText
} from "../src/engine/render.js"
import {
  runApprovedReleaseWorkflow,
  validateOperations,
  writeRenderFiles
} from "../src/engine/executor.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { ExecutionApproval, type Operation } from "../src/pipeline/operation.js"
import { TestGitHubApiLayer } from "./helpers.js"

const OperationArmTestLayer = Layer.mergeAll(
  makeTestReleaseHttpLayer(),
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer
)

export interface TestPlan {
  readonly document: ReleasePlanDocument
  readonly identity: ReleasePlanDocument["state"]["identity"]
  readonly evidenceDirectory: string
  readonly artifacts: ReleasePlanDocument["artifacts"]
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
    const document = yield* planReleaseFromIntent(intent, {
      root,
      ...(configPath === undefined ? {} : { configPath })
    })
    return {
      document,
      identity: document.state.identity,
      evidenceDirectory: document.evidenceDirectory,
      artifacts: document.artifacts,
      surfaceIds: plannedSurfaceIds(document.state.operations),
      operations: document.state.operations
    }
  })

const operationContext = (plan: TestPlan) => ({
  root: plan.document.source.root,
  identity: plan.document.state.identity,
  artifacts: plan.document.state.artifacts,
  notices: plan.document.state.notices,
  ...(plan.document.source.configPath === undefined ? {} : { configPath: plan.document.source.configPath })
})

export const validateTestPlan = (plan: TestPlan) =>
  validateOperations(plan.operations, operationContext(plan)).pipe(
    Effect.provide(OperationArmTestLayer)
  )

export const renderTestPlan = (
  plan: TestPlan,
  approval: ExecutionApproval = ExecutionApproval.make({ execute: true, approveIrreversible: false })
) =>
  writeRenderFiles(plan.operations, approval, operationContext(plan)).pipe(
    Effect.provide(OperationArmTestLayer)
  )

export const runApprovedTestPlan = (
  plan: TestPlan,
  approval: ExecutionApproval
) =>
  runApprovedReleaseWorkflow(plan.operations, approval, operationContext(plan)).pipe(
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

export const renderTestPlanOperationExplanation = (plan: TestPlan, operationId: string) =>
  renderPlanOperationExplanation(plan.document, operationId)
