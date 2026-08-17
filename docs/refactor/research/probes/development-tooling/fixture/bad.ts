import * as Effect from "effect/Effect"

export const badProgram = Effect.gen(function*() {
  Effect.succeed("floating")
  const nested = Effect.runSync(Effect.succeed(1))
  try {
    return yield* Effect.fail(`failed-${nested}`)
  } catch {
    return nested
  }
})
