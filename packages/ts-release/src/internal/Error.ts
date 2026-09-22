import { Effect, Schema } from "effect"

/** A failure to admit or execute a release operation. */
export class ReleaseError extends Schema.TaggedError<ReleaseError>()("ReleaseError", {
  code: Schema.String,
  message: Schema.String,
}) {}
export function fail(code: string, message: string): never {
  throw new ReleaseError({ code, message })
}
export const failure = (code: string, message: string) => new ReleaseError({ code, message })
export const reject = (code: string, message: string): Effect.Effect<never, ReleaseError> =>
  Effect.fail(failure(code, message))
export const attempt = <A>(body: () => A): Effect.Effect<A, ReleaseError> =>
  Effect.try({
    try: body,
    catch: (error) =>
      error instanceof ReleaseError
        ? error
        : new ReleaseError({ code: "invalid-data", message: "Value could not be admitted" }),
  })

const bounded = (text: string): string =>
  text
    .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, " ")
    .trim()
    .slice(0, 512)
const isReleaseErrorLike = (
  cause: unknown,
): cause is { readonly _tag: "ReleaseError"; readonly code: string; readonly message: string } =>
  typeof cause === "object" &&
  cause !== null &&
  (cause as { _tag?: unknown })._tag === "ReleaseError" &&
  typeof (cause as { code?: unknown }).code === "string" &&
  typeof (cause as { message?: unknown }).message === "string"
/** One bounded line for host diagnostics. A ReleaseError's code and message are
 * the typed failure contract and are printed. Any other value is named only, so
 * defect text, paths and native output never reach process logs. */
export const describeFailure = (cause: unknown): string => {
  if (isReleaseErrorLike(cause)) return `${bounded(cause.code)}: ${bounded(cause.message)}`
  const value = cause as { _tag?: unknown; code?: unknown } | null
  const name =
    typeof value?._tag === "string"
      ? value._tag
      : cause instanceof Error
        ? cause.name
        : typeof cause
  const code = typeof value?.code === "string" ? ` ${value.code}` : ""
  return `${bounded(`${name}${code}`) || "unknown"} (only a ReleaseError's code and message are printed)`
}
