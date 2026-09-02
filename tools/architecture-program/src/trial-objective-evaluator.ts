import { constants } from "node:fs"
import { open } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Result } from "effect"
import * as ts from "typescript"
import { ArtifactId } from "./schema/primitives.js"
import {
  EvidenceEntryV2,
  EvidenceName,
  IntegerEvidenceValueV2
} from "./schema/trial-evidence.js"
import type { GateReceipt } from "./schema/trial-result.js"
import {
  RunnerMeasuredObjectiveValue,
  RunnerUnavailableObjectiveValue,
  type RunnerOwnedObjectiveEvaluationRequest,
  type RunnerOwnedObjectiveEvaluator,
  type RunnerOwnedObjectiveMetricId
} from "./trial-objectives.js"
import { sha256Bytes } from "./trial-hash.js"
import type { PreparedTrialRun } from "./trial-runner-preflight.js"

export const LIVE_OBJECTIVE_DERIVATION_ID = ArtifactId.make(
  "objective-derivation.runner-source-v2"
)

interface ObservedCandidateFile {
  readonly path: string
  readonly bytes: Uint8Array
  readonly text: string
}

const sameTreeEntries = (
  left: RunnerOwnedObjectiveEvaluationRequest["candidateTreeEntries"],
  right: PreparedTrialRun["candidateTreeInventory"]["entries"]
): boolean => left.length === right.length && left.every((entry, index) => {
  const other = right[index]
  return other !== undefined && entry.path === other.path && entry.mode === other.mode &&
    entry.bytes === other.bytes && entry.sha256 === other.sha256
})

const readBoundFile = Effect.fn("LiveObjectiveEvaluator.readBoundFile")(function* (
  root: string,
  path: string,
  expectedSha256: string
) {
  const handle = yield* Effect.acquireRelease(
    Effect.tryPromise(() => open(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW)),
    (value) => Effect.promise(() => value.close()).pipe(Effect.orDie)
  )
  const before = yield* Effect.tryPromise(() => handle.stat())
  if (!before.isFile()) return yield* Effect.fail(new Error(`${path} is not a regular file`))
  const bytes = new Uint8Array(yield* Effect.tryPromise(() => handle.readFile()))
  const after = yield* Effect.tryPromise(() => handle.stat())
  if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino ||
    before.mode !== after.mode || before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
    bytes.byteLength !== after.size) {
    return yield* Effect.fail(new Error(`${path} changed while it was observed`))
  }
  if (sha256Bytes(bytes) !== expectedSha256) {
    return yield* Effect.fail(new Error(`${path} does not equal its preflight digest`))
  }
  const text = yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => new Error(`${path} is not UTF-8`)
  })
  return { path, bytes, text } satisfies ObservedCandidateFile
})

const loadCandidateFiles = Effect.fn("LiveObjectiveEvaluator.loadCandidateFiles")(function* (
  prepared: Pick<PreparedTrialRun, "candidateRoot" | "candidateTreeInventory">,
  request: RunnerOwnedObjectiveEvaluationRequest
) {
  if (!sameTreeEntries(request.candidateTreeEntries, prepared.candidateTreeInventory.entries)) {
    return yield* Effect.fail(new Error("objective tree does not equal preflight authority"))
  }
  const entries = new Map(request.candidateTreeEntries.map((entry) => [entry.path, entry] as const))
  const files: Array<ObservedCandidateFile> = []
  for (const manifestFile of request.candidateManifest.files) {
    const entry = entries.get(manifestFile.path)
    if (entry === undefined) {
      return yield* Effect.fail(new Error(`manifest path ${manifestFile.path} is absent`))
    }
    files.push(yield* Effect.scoped(readBoundFile(
      prepared.candidateRoot,
      manifestFile.path,
      entry.sha256
    )))
  }
  return files
})

const physicalLineCount = (bytes: Uint8Array): number => {
  if (bytes.byteLength === 0) return 0
  let lines = 0
  for (const byte of bytes) if (byte === 0x0a) lines += 1
  if (bytes[bytes.byteLength - 1] !== 0x0a) lines += 1
  return lines
}

const exportedStringArrayCount = (
  files: ReadonlyArray<ObservedCandidateFile>,
  exportName: string
): number | undefined => {
  const values: Array<number> = []
  for (const file of files.filter(({ path }) => path.endsWith(".ts"))) {
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.ESNext, true)
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(
        ({ kind }) => kind === ts.SyntaxKind.ExportKeyword
      )) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName) continue
        let initializer = declaration.initializer
        if (initializer !== undefined && ts.isAsExpression(initializer)) initializer = initializer.expression
        if (initializer === undefined || !ts.isArrayLiteralExpression(initializer) ||
          initializer.elements.some((element) => !ts.isStringLiteral(element))) return undefined
        values.push(initializer.elements.length)
      }
    }
  }
  return values.length === 1 ? values[0] : undefined
}

const productLaneIds: ReadonlySet<string> = new Set([
  "product-source",
  "generated-product-input",
  "action-source"
])

const sourceLineCount = (
  request: RunnerOwnedObjectiveEvaluationRequest,
  files: ReadonlyArray<ObservedCandidateFile>,
  include: (file: RunnerOwnedObjectiveEvaluationRequest["candidateManifest"]["files"][number]) => boolean
): number | undefined => {
  const bytesByPath = new Map(files.map((file) => [file.path, file.bytes] as const))
  let total = 0
  for (const file of request.candidateManifest.files) {
    if (!productLaneIds.has(file.laneId) || !include(file)) continue
    const bytes = bytesByPath.get(file.path)
    if (bytes === undefined) return undefined
    total += physicalLineCount(bytes)
    if (!Number.isSafeInteger(total)) return undefined
  }
  return total
}

const ownerHops = (
  request: RunnerOwnedObjectiveEvaluationRequest,
  conceptId: "concept.main-path" | "concept.difficult-path"
): number | undefined => {
  const owners = new Set<string>()
  for (const file of request.candidateManifest.files) {
    if (!file.conceptIds.some((id) => id === conceptId)) continue
    file.ownerRoleIds.forEach((owner) => owners.add(owner))
  }
  return owners.size === 0 ? undefined : Math.max(0, owners.size - 1)
}

const acceptedIntegerGateFact = (
  receipts: ReadonlyArray<GateReceipt>,
  gateId: string,
  factName: string
): number | undefined => {
  const receipt = receipts.find((candidate) => candidate.gateId === gateId)
  if (receipt?.execution._tag !== "Passed") return undefined
  const evaluation = receipt.execution.evaluationRecord
  if (evaluation.disposition._tag !== "Accepted") return undefined
  const fact = evaluation.disposition.facts.find(({ name }) => name === factName)
  return fact?.value._tag === "Integer" && fact.value.value >= 0
    ? fact.value.value
    : undefined
}

const deliveryBundleBytes = (
  request: RunnerOwnedObjectiveEvaluationRequest
): number | undefined => {
  const entries = new Map(request.candidateTreeEntries.map((entry) => [entry.path, entry] as const))
  let found = false
  let total = 0
  for (const file of request.candidateManifest.files) {
    if (file.laneId !== "delivery-bundle") continue
    const entry = entries.get(file.path)
    if (entry === undefined) return undefined
    found = true
    total += entry.bytes
    if (!Number.isSafeInteger(total)) return undefined
  }
  return found ? total : undefined
}

const valueFact = (value: number): [EvidenceEntryV2] => [new EvidenceEntryV2({
  sequence: 1,
  name: EvidenceName.make("runner.objective-value"),
  value: new IntegerEvidenceValueV2({ value })
})]

const unavailable = (
  id: RunnerOwnedObjectiveMetricId
): RunnerUnavailableObjectiveValue => new RunnerUnavailableObjectiveValue({ id })

const measured = (
  id: RunnerOwnedObjectiveMetricId,
  value: number | undefined
): RunnerMeasuredObjectiveValue | RunnerUnavailableObjectiveValue => value === undefined ||
    !Number.isSafeInteger(value) || value < 0
  ? unavailable(id)
  : new RunnerMeasuredObjectiveValue({ id, value, facts: valueFact(value) })

export const makeLiveObjectiveEvaluator = (
  prepared: Pick<PreparedTrialRun, "candidateRoot" | "candidateTreeInventory">
): RunnerOwnedObjectiveEvaluator => ({
  derivationId: LIVE_OBJECTIVE_DERIVATION_ID,
  evaluate: Effect.fn("LiveObjectiveEvaluator.evaluate")(function* (request) {
    const loaded = yield* Effect.result(loadCandidateFiles(prepared, request))
    if (Result.isFailure(loaded)) return unavailable(request.metricId)
    const files = loaded.success

    switch (request.metricId) {
      case "representable-invalid-state-count":
        return measured(request.metricId, exportedStringArrayCount(files, "FORBIDDEN_TRANSITIONS"))
      case "machine-interpreter-product-lines":
        return measured(request.metricId, sourceLineCount(request, files, (file) =>
          file.ownerRoleIds.some((id) => id === "role-machine") ||
          file.ownerRoleIds.some((id) => id === "role-kernel-workflow")))
      case "main-path-owner-hops":
        return measured(request.metricId, ownerHops(request, "concept.main-path"))
      case "difficult-path-owner-hops":
        return measured(request.metricId, ownerHops(request, "concept.difficult-path"))
      case "invalid-version-publication-state-count": {
        const sourceValue = exportedStringArrayCount(files, "INVALID_VERSION_STATES")
        const gateValue = acceptedIntegerGateFact(
          request.gateReceipts,
          "GT12-version-skew-partial-publication",
          "runner.invalid-version-state-count"
        )
        return measured(
          request.metricId,
          sourceValue !== undefined && sourceValue === gateValue ? sourceValue : undefined
        )
      }
      case "product-source-lines":
        return measured(request.metricId, sourceLineCount(request, files, () => true))
      case "packed-byte-count": {
        const inventoryValue = deliveryBundleBytes(request)
        const gateValue = acceptedIntegerGateFact(
          request.gateReceipts,
          "GT14-tree-shaking-and-packed-bytes",
          "runner.packed-byte-count"
        )
        return measured(
          request.metricId,
          inventoryValue !== undefined && inventoryValue === gateValue
            ? inventoryValue
            : undefined
        )
      }
    }
  })
})
