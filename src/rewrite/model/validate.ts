import * as Schema from "effect/Schema"
import { encodeCanonicalJson, hashFramed } from "./canonical.js"
import {
  CredentialConfinementError,
  DuplicatePlanValueError,
  OutputReferenceError,
  SecretLikePlanValueError
} from "./errors.js"
import {
  Operation,
  type Operation as OperationType,
  type OutputDeclaration
} from "./operation.js"
import { ReleasePlanV6 } from "./plan.js"

export const stageOrder = [
  "build",
  "process",
  "catalog",
  "validate",
  "publish",
  "announce",
  "verify"
] as const
export type StageName = typeof stageOrder[number]

export interface OperationEntry {
  readonly stage: StageName
  readonly operation: OperationType
}
export interface DerivedOutput {
  readonly output: OutputDeclaration
  readonly producerId: string
  readonly stage: StageName
}
export interface Dependency {
  readonly operationId: string
  readonly inputId: string
  readonly producerId: string
}

export type PlanValidationFailure =
  | CredentialConfinementError
  | DuplicatePlanValueError
  | OutputReferenceError
  | SecretLikePlanValueError

export const operationEntries = (plan: ReleasePlanV6): ReadonlyArray<OperationEntry> =>
  stageOrder.flatMap((stage) =>
    plan.stages[stage].map((operation) => ({ stage, operation })))

const duplicate = (
  values: ReadonlyArray<string>,
  kind: "operation-id" | "output-id" | "output-path"
): DuplicatePlanValueError | undefined => {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) return DuplicatePlanValueError.make({ kind, value })
    seen.add(value)
  }
  return undefined
}

const secretLike = (plan: ReleasePlanV6): SecretLikePlanValueError | undefined => {
  const text = encodeCanonicalJson(Schema.encodeSync(ReleasePlanV6)(plan))
  const patterns = [
    /ghp_[A-Za-z0-9]{20,}/u,
    /github_pat_[A-Za-z0-9_]{20,}/u,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u
  ]
  return patterns.some((pattern) => pattern.test(text))
    ? SecretLikePlanValueError.make({ field: "durable-plan" })
    : undefined
}

const credentialFailure = (
  entries: ReadonlyArray<OperationEntry>
): CredentialConfinementError | undefined => {
  const read = new Set<string>()
  const publish = new Set<string>()
  for (const { operation } of entries) {
    if (operation._tag === "HttpRead" && operation.credential !== undefined) {
      read.add(operation.credential.name)
    }
    if (operation._tag === "HttpPublish" || operation._tag === "ForgeRelease") {
      publish.add(operation.credential.name)
    }
  }
  const dual = [...read].find((name) => publish.has(name))
  return dual === undefined
    ? undefined
    : CredentialConfinementError.make({
        credential: dual,
        reason: "One credential name cannot occupy read and publish slots."
      })
}

export interface ValidatedPlanProjection {
  readonly entries: ReadonlyArray<OperationEntry>
  readonly outputs: ReadonlyArray<DerivedOutput>
  readonly dependencies: ReadonlyArray<Dependency>
  readonly operationHashes: ReadonlyArray<{
    readonly operationId: string
    readonly hash: string
  }>
}

export const validatePlan = (
  plan: ReleasePlanV6
): PlanValidationFailure | ValidatedPlanProjection => {
  const entries = operationEntries(plan)
  const operationDuplicate = duplicate(
    entries.map(({ operation }) => operation.id),
    "operation-id"
  )
  if (operationDuplicate !== undefined) return operationDuplicate
  const declarations = entries.flatMap(({ operation }) => operation.outputs)
  const outputDuplicate = duplicate(declarations.map((output) => output.id), "output-id")
  if (outputDuplicate !== undefined) return outputDuplicate
  const pathDuplicate = duplicate(declarations.map((output) => output.path), "output-path")
  if (pathDuplicate !== undefined) return pathDuplicate
  const credential = credentialFailure(entries)
  if (credential !== undefined) return credential
  const secret = secretLike(plan)
  if (secret !== undefined) return secret
  const producer = new Map<string, { readonly id: string; readonly stage: StageName }>()
  const outputs: Array<DerivedOutput> = []
  const dependencies: Array<Dependency> = []
  for (const { operation, stage } of entries) {
    for (const input of operation.inputs) {
      const prior = producer.get(input)
      if (prior === undefined) {
        return OutputReferenceError.make({
          operationId: operation.id,
          outputId: input,
          reason: "Output reference is missing, same-operation, or forward."
        })
      }
      dependencies.push({ operationId: operation.id, inputId: input, producerId: prior.id })
    }
    for (const output of operation.outputs) {
      producer.set(output.id, { id: operation.id, stage })
      outputs.push({ output, producerId: operation.id, stage })
    }
  }
  const encoder = new TextEncoder()
  const operationHashes = entries.map(({ operation }) => ({
    operationId: operation.id,
    hash: hashFramed("ts-release/operation/v1", [
      encoder.encode(encodeCanonicalJson(Schema.encodeSync(Operation)(operation)))
    ])
  }))
  return { entries, outputs, dependencies, operationHashes }
}

export const isValidationFailure = (
  value: PlanValidationFailure | ValidatedPlanProjection
): value is PlanValidationFailure => "_tag" in value
