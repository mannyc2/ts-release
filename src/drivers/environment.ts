import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"

// Environment is a host capability, so it is read through effect/Config rather
// than process.env. The default ConfigProvider reads the host environment; a
// test or an embedding host substitutes one with ConfigProvider.layer.
export const readOptionalEnv = (name: string): Effect.Effect<string | undefined> =>
  Config.option(Config.string(name)).pipe(
    Effect.map(Option.getOrUndefined),
    Effect.orElseSucceed(() => undefined)
  )

// Exec and command publish run with a closed environment: PATH plus the
// operation's named variables and nothing else. The parent environment is
// never inherited, so a plan states every variable a command can observe.
export const readEnvironment = (
  names: ReadonlyArray<string>
): Effect.Effect<Record<string, string>> =>
  Effect.forEach(["PATH", ...names], (name) =>
    readOptionalEnv(name).pipe(Effect.map((value) => [name, value] as const))).pipe(
    Effect.map((entries) => Object.fromEntries(entries.flatMap(([name, value]) =>
      value === undefined ? [] : [[name, value]]))))
