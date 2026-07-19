// Invariant: every durable operation has one approval derivation from its risk.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Operation, OperationId } from "./operation.js"

export class ExecutionApproval extends Schema.Class<ExecutionApproval>("ExecutionApproval")({
  execute: Schema.Boolean,
  approveIrreversible: Schema.Boolean
}) {
  static readonly none = ExecutionApproval.make({
    execute: false,
    approveIrreversible: false
  })
}

export class ExecutionApprovalError extends Schema.TaggedErrorClass<ExecutionApprovalError>()(
  "ExecutionApprovalError",
  {
    operationId: OperationId,
    reason: Schema.String
  }
) {}

export const operationApprovalRequirements = (operation: Operation) => {
  const requiresExecute = operation.risk !== "read-only"
  const requiresIrreversibleApproval = operation.risk === "irreversible"
  return {
    requiresExecute,
    requiresIrreversibleApproval,
    label: !requiresExecute
      ? "none"
      : requiresIrreversibleApproval
      ? "--execute + --approve-publish"
      : "--execute"
  } as const
}

export const canExecuteOperation = (operation: Operation, approval: ExecutionApproval): boolean => {
  const requirements = operationApprovalRequirements(operation)
  return (!requirements.requiresExecute || approval.execute)
    && (!requirements.requiresIrreversibleApproval || approval.approveIrreversible)
}

export const requireExecutionApproval = Effect.fn("requireExecutionApproval")(function*(
  operation: Operation,
  approval: ExecutionApproval
) {
  const requirements = operationApprovalRequirements(operation)
  if ((!requirements.requiresExecute || approval.execute)
    && (!requirements.requiresIrreversibleApproval || approval.approveIrreversible)) return

  const reason = requirements.requiresIrreversibleApproval && !approval.approveIrreversible
    ? "Operation requires irreversible approval."
    : "Operation requires execute approval."

  return yield* Effect.fail(
    ExecutionApprovalError.make({
      operationId: operation.id,
      reason
    })
  )
})
