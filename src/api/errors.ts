export type ReleaseApiPhase = "plan" | "review" | "apply"

export class ReleaseApiError extends Error {
  readonly _tag = "ReleaseApiError"
  constructor(
    readonly phase: ReleaseApiPhase,
    readonly reason: string
  ) {
    super(`${phase}: ${reason}`)
    this.name = "ReleaseApiError"
  }

  static from(phase: ReleaseApiPhase, cause: unknown): ReleaseApiError {
    if (cause instanceof ReleaseApiError) return cause
    const reason = typeof cause === "object" && cause !== null && "reason" in cause
      ? String(cause.reason)
      : cause instanceof Error
      ? cause.message
      : "Operation failed."
    return new ReleaseApiError(phase, reason)
  }
}
