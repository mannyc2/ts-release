// `resolveConfig` is a PUBLIC boundary function that apps call directly, so its
// refusals follow the boundary rule SPEC §13 states: a stable plain error
// carrying a reason, readable as-is when a CLI prints it. (The internal
// ConfigValueError family is a decode-time vocabulary; its `message` is empty
// by construction, which would reach a user as a blank line.)
export class ResolveError extends Error {
  readonly _tag = "ResolveError"
  constructor(
    readonly field: string,
    readonly reason: string
  ) {
    super(reason)
    this.name = "ResolveError"
  }
}
