import * as Effect from "effect/Effect"

export const program = Effect.succeed(1)

// Deliberate application/runtime boundary: Effect execution is allowed here.
export const runBoundary = (): Promise<number> => Effect.runPromise(program)
