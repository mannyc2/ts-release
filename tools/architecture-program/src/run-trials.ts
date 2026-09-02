import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Schema } from "effect"
import { runTrialOrchestrationLive } from "./trial-orchestration.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))

export const defaultTrialRepositoryRoot = resolve(moduleDirectory, "../../..")

export class TrialOrchestrationCliError extends Schema.TaggedError<
  TrialOrchestrationCliError
>()("TrialOrchestrationCliError", {
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(reason: string) {
    super({ reason, message: `Architecture trial CLI rejected its invocation: ${reason}` })
  }
}

/** Runs the live orchestration for the default repository or one explicit root. */
export const runTrialOrchestrationCli = Effect.fn("TrialOrchestrationCli.run")(
  function* (argv: ReadonlyArray<string>) {
    if (argv.length > 1) {
      return yield* new TrialOrchestrationCliError(
        "expected zero arguments or one explicit repository root"
      )
    }
    return yield* runTrialOrchestrationLive(resolve(argv[0] ?? defaultTrialRepositoryRoot))
  }
)

const selectionSummary = (
  selection: { readonly _tag: string; readonly selectedCandidateId?: string } | null
): string => selection === null
  ? "not-run"
  : selection.selectedCandidateId === undefined
  ? selection._tag
  : `${selection._tag}:${selection.selectedCandidateId}`

if (import.meta.main) {
  const outcome = await Effect.runPromise(runTrialOrchestrationCli(
    process.argv.slice(2)
  ).pipe(Effect.match({
    onFailure: (error) => ({ _tag: "Failure" as const, error }),
    onSuccess: (aggregate) => ({ _tag: "Success" as const, aggregate })
  })))
  if (outcome._tag === "Failure") {
    const rendered = outcome.error instanceof Error
      ? outcome.error.message
      : String(outcome.error)
    console.error(`architecture trials failed: ${rendered.split("\n", 1)[0]}`)
    process.exitCode = 1
  } else {
    console.log(
      `architecture trials persisted (${outcome.aggregate.aggregateId}; ` +
      `machine=${selectionSummary(outcome.aggregate.machineSelection)}; ` +
      `topology=${selectionSummary(outcome.aggregate.topologySelection)})`
    )
  }
}
