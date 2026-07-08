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
  if (typeof cause === "object" && cause !== null) {
    const record = cause as Record<string, unknown>
    const tag = typeof record._tag === "string" ? record._tag : undefined
    const reason = typeof record.reason === "string" ? record.reason : undefined
    if (tag !== undefined && reason !== undefined) {
      return `${tag}: ${reason}`
    }
    if (tag !== undefined) {
      return tag
    }
  }
  return typeof cause === "string" && cause.length > 0 ? cause : "Release operation failed."
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
