import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  CommandEvidence,
  EvidenceBundle,
  EvidenceRecord,
  ExecutionEvidence,
  ValidationEvidence
} from "../domain/evidence.js"
import { CommandSpec, Operation } from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { ReleaseHost } from "../host/host.js"
import { EvidenceWriteError } from "./errors.js"

export type * from "../types/effect-internal.js"

export const emptyEvidenceBundle = (plan: ReleasePlan): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v1",
    releaseName: plan.identity.name,
    releaseVersion: plan.identity.version,
    records: []
  })

export const appendEvidenceRecord = (
  bundle: EvidenceBundle,
  record: EvidenceRecord
): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: bundle.schemaVersion,
    releaseName: bundle.releaseName,
    releaseVersion: bundle.releaseVersion,
    records: [...bundle.records, record]
  })

export const redactText = (input: string, secrets: ReadonlyArray<string>): string => {
  let output = input
  for (const secret of secrets) {
    if (secret.length > 0) {
      output = output.split(secret).join("[REDACTED]")
    }
  }
  return output
}

export const readRedactionSecrets = Effect.fn("readRedactionSecrets")(function*(operation: Operation) {
  const host = yield* ReleaseHost
  const secrets: Array<string> = []
  const names = "command" in operation ? operation.command.redactedEnv : []
  for (const name of names) {
    const value = yield* host.readEnv(name)
    if (value !== undefined) {
      secrets.push(value)
    }
  }
  return secrets
})

export const commandEvidenceFromResult = Effect.fn("commandEvidenceFromResult")(function*(
  operation: Extract<Operation, { readonly command: CommandSpec }>
) {
  const host = yield* ReleaseHost
  const secrets = yield* readRedactionSecrets(operation)
  const result = yield* host.runCommand(operation.command)
  const status = result.exitCode === 0 ? "passed" : "failed"
  return CommandEvidence.make({
    id: `${operation.id}:command`,
    operationId: operation.id,
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    status,
    severity: result.exitCode === 0 ? "info" : "error",
    command: result.command,
    exitCode: result.exitCode,
    stdout: redactText(result.stdout, secrets),
    stderr: redactText(result.stderr, secrets),
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    durationMillis: result.durationMillis
  })
})

export const executionEvidence = Effect.fn("executionEvidence")(function*(operation: Operation, message: string) {
  const host = yield* ReleaseHost
  const timestamp = yield* host.now
  return ExecutionEvidence.make({
    id: `${operation.id}:execution`,
    operationId: operation.id,
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    status: "passed",
    severity: "info",
    message,
    timestamp
  })
})

export const validationNoteEvidence = Effect.fn("validationNoteEvidence")(function*(
  operation: Extract<Operation, { readonly _tag: "ValidationNoteOperation" }>
) {
  const host = yield* ReleaseHost
  const timestamp = yield* host.now
  const status = operation.skipped ? "skipped" : operation.severity === "warning" ? "warning" : "passed"
  return ValidationEvidence.make({
    id: `${operation.id}:validation`,
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    status,
    severity: operation.severity,
    message: operation.message,
    timestamp,
    skipped: operation.skipped
  })
})

export const renderEvidenceJson = (bundle: EvidenceBundle): string =>
  `${JSON.stringify(bundle, null, 2)}\n`

export const writeEvidenceBundle = Effect.fn("writeEvidenceBundle")(function*(path: string, bundle: EvidenceBundle) {
  const host = yield* ReleaseHost
  yield* host.writeFileString(path, renderEvidenceJson(bundle)).pipe(
    Effect.mapError((error) =>
      EvidenceWriteError.make({
        path,
        reason: error.reason
      })
    )
  )
})

export const decodeEvidenceBundle = Schema.decodeUnknownEffect(EvidenceBundle)
