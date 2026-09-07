import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { type ProviderDescriptor, verifyDescriptor } from "./Provider.js"
import { ReleaseError, attempt, fail } from "./internal/Error.js"
import { canonical, hashCanonical, copyData, decodeOwned, freeze } from "./internal/Identity.js"
import { Operation, Plan } from "./internal/ReleaseModel.js"
import { type Scope } from "./Journal.js"

export const createOperation = Effect.fn("ts-release.createOperation")(function* (
  provider: ProviderDescriptor,
  intent: unknown,
  dependsOn: ReadonlyArray<string> = [],
) {
  yield* attempt(() => verifyDescriptor(provider))
  const encoded = yield* attempt(() => {
    const decoded = Schema.decodeUnknownSync(provider.intentCodec, { onExcessProperty: "error" })(
      copyData(intent),
    )
    return copyData(Schema.encodeSync(provider.intentCodec)(decoded))
  })
  const value = {
    definitionId: provider.definitionId,
    intentVersion: provider.intentVersion,
    intent: encoded,
  }
  const operationId = yield* hashCanonical("ts-release/operation/1", value)
  return freeze(new Operation({ operationId, ...value, dependsOn: [...dependsOn].sort() }))
})
export const validateDag = (operations: ReadonlyArray<Operation>): void => {
  const index = new Map<string, Operation>()
  for (const operation of operations) {
    if (index.has(operation.operationId))
      fail("duplicate-operation", "Operation IDs must be unique")
    if (operation.dependsOn.length !== new Set(operation.dependsOn).size)
      fail("duplicate-dependency", "Dependencies must be unique")
    if (canonical(operation.dependsOn) !== canonical([...operation.dependsOn].sort()))
      fail("dependency-order", "Dependencies must be sorted")
    index.set(operation.operationId, operation)
  }
  const active = new Set<string>()
  const done = new Set<string>()
  const visit = (id: string): void => {
    if (active.has(id)) fail("cyclic-plan", "Plan dependencies contain a cycle")
    if (done.has(id)) return
    const operation = index.get(id)
    if (!operation) fail("missing-dependency", "Plan has a dangling dependency")
    active.add(id)
    for (const dependency of operation.dependsOn) visit(dependency)
    active.delete(id)
    done.add(id)
  }
  for (const id of index.keys()) visit(id)
}
export const planValue = (bundleId: string, operations: ReadonlyArray<Operation>) => ({
  format: "ts-release/plan/1" as const,
  bundleId,
  operations: [...operations].sort((a, b) => (a.operationId < b.operationId ? -1 : 1)),
})
export const createPlan = Effect.fn("ts-release.createPlan")(function* (
  bundleId: string,
  operations: ReadonlyArray<Operation>,
  journalId?: string,
) {
  operations = yield* attempt(() => decodeOwned(Schema.Array(Operation), operations))
  yield* attempt(() => validateDag(operations))
  for (const operation of operations) {
    const expected = yield* hashCanonical("ts-release/operation/1", {
      definitionId: operation.definitionId,
      intentVersion: operation.intentVersion,
      intent: operation.intent,
    })
    if (expected !== operation.operationId)
      return yield* new ReleaseError({
        code: "operation-identity",
        message: "Operation does not match its canonical intent",
      })
  }
  const content = planValue(bundleId, operations)
  const value = {
    ...content,
    journalId: journalId ?? (yield* hashCanonical("ts-release/journal/1", content)),
  }
  const planId = yield* hashCanonical("ts-release/plan/1", value)
  return freeze(new Plan({ planId, ...value }))
})
export const createPreparationScope = Effect.fn("ts-release.createPreparationScope")(function* (
  provider: ProviderDescriptor,
  input: unknown,
  journalId?: string,
) {
  const operation = yield* createOperation(provider, input)
  const plan = yield* createPlan(`preparation:${operation.operationId}`, [operation], journalId)
  return { _tag: "PreparationScope", plan } as const satisfies Scope
})
export const loadPlan = Effect.fn("ts-release.loadPlan")(function* (
  input: unknown,
  providers: ReadonlyArray<ProviderDescriptor>,
) {
  const plan = yield* attempt(() => decodeOwned(Plan, input))
  const definitions = new Map<string, ProviderDescriptor>()
  yield* attempt(() => {
    for (const provider of providers) {
      if (definitions.has(provider.definitionId))
        fail("duplicate-provider", "Provider definition IDs must be unique")
      definitions.set(provider.definitionId, provider)
    }
    validateDag(plan.operations)
    if (
      canonical(plan.operations) !== canonical(planValue(plan.bundleId, plan.operations).operations)
    )
      fail("operation-order", "Operations must be sorted")
  })
  for (const operation of plan.operations) {
    const provider = definitions.get(operation.definitionId)
    if (!provider || provider.intentVersion !== operation.intentVersion)
      return yield* new ReleaseError({
        code: "unknown-provider-codec",
        message: "Provider or intent version is unavailable",
      })
    const rebuilt = yield* createOperation(provider, operation.intent, operation.dependsOn)
    if (
      rebuilt.operationId !== operation.operationId ||
      canonical(rebuilt.intent) !== canonical(operation.intent)
    )
      return yield* new ReleaseError({
        code: "operation-identity",
        message: "Operation does not match its canonical intent",
      })
  }
  const rebuilt = yield* createPlan(plan.bundleId, plan.operations, plan.journalId)
  if (rebuilt.planId !== plan.planId)
    return yield* new ReleaseError({ code: "plan-identity", message: "Plan ID mismatch" })
  return freeze(plan)
})
