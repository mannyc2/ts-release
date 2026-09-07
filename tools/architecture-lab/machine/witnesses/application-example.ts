// Ordinary application composition against the public kernel surface: no registry, no config language.
// The application decides evaluator, store (with an optional cache decorator), transport and providers.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SqliteJournal } from "../../storage/sqlite.js"
import {
  LabError, historyMachine, makeCoreGitTransport, type HostShape, type RunOptions, type ProviderDefinition, type Transport
} from "../src/index.js"
import { CachingJournalStore } from "./caching-store.js"
import { memoizedMachine } from "./memoized-machine.js"
import { transitionMachine } from "./m2-transition.js"

/** The application owns its input schema; the kernel never reads release configuration. */
export class ReleaseInput extends Schema.Class<ReleaseInput>("ReleaseInput")({
  statePath: Schema.String, authorize: Schema.Boolean,
  evaluator: Schema.Literals(["history", "memoized-history", "transition"]),
  cache: Schema.Boolean,
  git: Schema.optionalKey(Schema.Struct({ principal: Schema.String, scope: Schema.String, executable: Schema.String }))
}) {}

export interface Application { readonly host: HostShape; readonly options: RunOptions }

/** Everything below is plain composition; the executor keeps every permit, admission and append law. */
export const createApplication = (
  providers: ReadonlyArray<ProviderDefinition>, http: Transport, plan: RunOptions["plan"]
) => Effect.fn("example.createApplication")(function*(rawInput: unknown) {
  const input = yield* Schema.decodeUnknownEffect(ReleaseInput, { onExcessProperty: "error" })(rawInput).pipe(
    Effect.mapError((error) => new LabError({ code: "input", message: String(error) }))
  )
  const sqlite = yield* Effect.acquireRelease(Effect.sync(() => new SqliteJournal(input.statePath)), (store) => Effect.sync(() => store.close()))
  const store = input.cache ? new CachingJournalStore(sqlite) : sqlite            // decorator, not a kernel option
  const machine = input.evaluator === "history" ? historyMachine                 // kernel default
    : input.evaluator === "memoized-history" ? memoizedMachine(historyMachine)  // derived-state wrapper
    : transitionMachine                                                          // external evaluator (M2 lives outside the kernel)
  const transport = input.git
    ? makeCoreGitTransport({ principal: input.git.principal, scope: input.git.scope, otherwise: http,
        execute: (argv) => Effect.tryPromise({ try: async () => { const p = Bun.spawn([input.git!.executable, ...argv], { stdout: "pipe", stderr: "pipe" }); const stdout = await new Response(p.stdout).text(); return { exitCode: await p.exited, stdout } }, catch: (cause) => new LabError({ code: "git", message: String(cause) }) }) })
    : http
  const host: HostShape = { store, transport, providers, machine, now: () => Date.now(), uniqueId: () => crypto.randomUUID() }
  return { host, options: { plan, authorize: input.authorize } } satisfies Application
})
