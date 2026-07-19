// Invariant: foreign failures are normalized once at the public boundary without discarding their original cause.
import { formatTaggedReason } from "./error-message.js"

export type ReleaseApiPhase = "plan" | "build" | "release" | "verify" | "dispose"

export interface ReleaseApiErrorInput {
  readonly phase: ReleaseApiPhase
  readonly message: string
  readonly cause?: unknown
}

const errorMessage = (cause: unknown): string => {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message
  }
  return formatTaggedReason(cause) ??
    (typeof cause === "string" && cause.length > 0 ? cause : "Release operation failed.")
}

export class ReleaseApiError extends Error {
  readonly _tag = "ReleaseApiError"
  readonly phase: ReleaseApiPhase
  override readonly cause?: unknown

  constructor(input: ReleaseApiErrorInput) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause })
    this.name = "ReleaseApiError"
    this.phase = input.phase
    if (input.cause !== undefined) {
      this.cause = input.cause
    }
  }

  static fromCause(phase: ReleaseApiPhase, cause: unknown): ReleaseApiError {
    if (cause instanceof ReleaseApiError) {
      return cause
    }
    return new ReleaseApiError({
      phase,
      message: errorMessage(cause),
      cause
    })
  }
}
