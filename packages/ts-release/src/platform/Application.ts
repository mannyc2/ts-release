import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Cause from "effect/Cause"
import * as Duration from "effect/Duration"
import * as Exit from "effect/Exit"
import * as Logger from "effect/Logger"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Host, captureHost, type HostShape } from "../internal/Host.js"
import type { AdoptionError, OwnedBundle } from "../internal/ArtifactModel.js"
import { attempt, fail, failure, ReleaseError } from "../internal/Error.js"
import type { Operation, RunOptions } from "../internal/ReleaseModel.js"
import { FinalizedReport, reportFinalizedRelease } from "../internal/FinalizedReport.js"
import { observeRelease, runRelease } from "../Release.js"
import { decodeOwned } from "../internal/Identity.js"

export { FinalizedReport }
const positiveMilliseconds = Schema.Int.check(Schema.isGreaterThan(0))
export const BoundedObservationOptions = Schema.Struct({
  mode: Schema.Literal("observe"),
  definitionIds: Schema.Array(Schema.String.check(Schema.isMinLength(1))).check(
    Schema.isMinLength(1),
  ),
  budgetMilliseconds: positiveMilliseconds,
  initialDelayMilliseconds: positiveMilliseconds,
  maximumDelayMilliseconds: positiveMilliseconds,
})
/** Invocation-only observation policy. The budget includes provider/journal
 * work and backoff after initial admission; settlement and cleanup are joined. */
export type BoundedObservationOptions = typeof BoundedObservationOptions.Type
export type ApplicationMode = "run" | "observe" | BoundedObservationOptions

const captureMode = Effect.fnUntraced(function* (mode: ApplicationMode) {
  if (mode === "run" || mode === "observe") return mode
  const policy = yield* attempt(() => decodeOwned(BoundedObservationOptions, mode))
  if (
    policy.initialDelayMilliseconds > policy.maximumDelayMilliseconds ||
    new Set(policy.definitionIds).size !== policy.definitionIds.length
  )
    return yield* failure("application-observation", "Observation policy is invalid")
  return policy
})
export interface Application {
  readonly bundle: OwnedBundle
  readonly host: HostShape
  readonly options: RunOptions
  /** Complete live authentication only after a provider's terminal noncommit
   * proof is durable. The kernel alone authorizes any subsequent dispatch.
   * Called at most once per operation per invocation, never in observe mode. */
  readonly onRejected?: (operation: Operation) => Effect.Effect<boolean, ReleaseError>
}
export type CreateApplication<E = ReleaseError, R = never> = (
  input: unknown,
) => Effect.Effect<Application, E, R | Scope.Scope>
/** Own process signal listeners and liveness for exactly one asynchronous main. */
export const runInterruptibleProcess = async <A>(
  main: (signal: AbortSignal, exitCode: () => 0 | 130 | 143) => Promise<A>,
): Promise<A> => {
  const controller = new AbortController(),
    keepAlive = setInterval(() => {}, 2_147_483_647)
  let code: 0 | 130 | 143 = 0
  const stop = (exitCode: 130 | 143) => {
      code ||= exitCode
      controller.abort()
    },
    signals = { SIGINT: () => stop(130), SIGTERM: () => stop(143) } as const
  for (const [signal, listener] of Object.entries(signals)) process.on(signal, listener)
  try {
    return await main(controller.signal, () => code)
  } finally {
    clearInterval(keepAlive)
    for (const [signal, listener] of Object.entries(signals)) process.off(signal, listener)
  }
}

type Visibility = NonNullable<FinalizedReport["visibility"]>
const latestVisibility = (report: FinalizedReport, selected: ReadonlySet<string>) => {
  const latest = new Map<string, NonNullable<Visibility["operations"][number]["lastObservation"]>>()
  for (const event of report.journal.events) {
    const { body } = event
    if (
      event.planId === report.plan.planId &&
      body._tag === "ObservationRecorded" &&
      body.evidenceKind === "Observation" &&
      selected.has(body.operationId)
    )
      latest.set(body.operationId, {
        eventId: event.eventId,
        status: body.status,
        observedAt: body.observedAt,
      })
  }
  const operations: Visibility["operations"] = [...selected].map((operationId) => {
    const lastObservation = latest.get(operationId)
    return {
      operationId,
      status:
        lastObservation?.status === "Satisfied" || lastObservation?.status === "Conflict"
          ? lastObservation.status
          : "Pending",
      ...(lastObservation && { lastObservation }),
    }
  })
  const status: Visibility["status"] = operations.some((item) => item.status === "Conflict")
    ? "Conflict"
    : operations.every((item) => item.status === "Satisfied")
      ? "Satisfied"
      : "Pending"
  return { status, operations }
}

/** Reuse the acquired application; every sweep still admits fresh durable
 * history. Observation evidence cannot reach the dispatch interpreter. */
const observeApplication = Effect.fn("ts-release.observeApplication")(function* (
  admitted: FinalizedReport,
  policy: BoundedObservationOptions,
) {
  const selected = new Set(
    admitted.plan.operations
      .filter((operation) => policy.definitionIds.includes(operation.definitionId))
      .map((operation) => operation.operationId),
  )
  if (
    selected.size === 0 ||
    policy.definitionIds.some(
      (id) => !admitted.plan.operations.some((operation) => operation.definitionId === id),
    )
  )
    return yield* failure(
      "application-observation",
      "Observation selection is absent from the Plan",
    )
  const start = yield* Clock.monotonicTimeNanos
  const deadline = start + BigInt(policy.budgetMilliseconds) * 1_000_000n
  let delay = BigInt(policy.initialDelayMilliseconds) * 1_000_000n
  const maximumDelay = BigInt(policy.maximumDelayMilliseconds) * 1_000_000n
  let report = admitted
  while (true) {
    let remaining = deadline - (yield* Clock.monotonicTimeNanos)
    if (remaining <= 0n) break
    const settlement: { exit?: Exit.Exit<FinalizedReport, ReleaseError | AdoptionError> } = {}
    const refreshed = yield* observeRelease({ plan: admitted.plan }).pipe(
      Effect.andThen(reportFinalizedRelease(admitted.bundle, admitted.plan)),
      Effect.onExit((exit) =>
        Effect.sync(() => {
          settlement.exit = exit
        }),
      ),
      Effect.timeoutOption(Duration.nanos(remaining)),
    )
    if (Option.isNone(refreshed)) {
      // rc.115 joins the timeout loser but discards its Exit. Preserve any
      // failure/defect produced during settlement, including composite causes.
      const exit = settlement.exit
      if (exit && Exit.isFailure(exit) && (Cause.hasFails(exit.cause) || Cause.hasDies(exit.cause)))
        return yield* Effect.failCause(exit.cause)
      // An append may have settled during cancellation. Reconcile its real
      // history after joined interruption; a failed read remains a failure.
      report = yield* reportFinalizedRelease(admitted.bundle, admitted.plan)
      break
    }
    report = refreshed.value
    if (latestVisibility(report, selected).status !== "Pending") break
    remaining = deadline - (yield* Clock.monotonicTimeNanos)
    if (remaining <= 0n) break
    yield* Effect.sleep(Duration.nanos(delay < remaining ? delay : remaining))
    delay = delay * 2n < maximumDelay ? delay * 2n : maximumDelay
  }
  const elapsedMilliseconds = Number(((yield* Clock.monotonicTimeNanos) - start) / 1_000_000n)
  return yield* attempt(() =>
    decodeOwned(FinalizedReport, {
      ...report,
      visibility: {
        ...latestVisibility(report, selected),
        elapsedMilliseconds,
        budgetMilliseconds: policy.budgetMilliseconds,
      },
    }),
  )
})

/** Interpret an acquired application with one captured host and authorization. */
const executeApplication = Effect.fn("ts-release.executeApplication")(function* (
  app: Application,
  mode: ApplicationMode,
) {
  const options = { ...app.options }
  const onRejected = yield* attempt(() => {
    if (app.onRejected !== undefined && typeof app.onRejected !== "function")
      fail("application-rejection", "Application rejection handler must be callable")
    return app.onRejected?.bind(app)
  })
  const host = yield* attempt(() => captureHost(app.host))
  return yield* Effect.gen(function* () {
    // Admit the complete Bundle/Plan/Journal binding before dispatch, then keep
    // these owned inputs across the run. Reports never grant dispatch authority.
    const admitted = yield* reportFinalizedRelease(app.bundle, options.plan)
    if (typeof mode !== "string") return yield* observeApplication(admitted, mode)
    if (mode === "observe") yield* observeRelease({ plan: admitted.plan })
    else yield* runRelease({ ...options, plan: admitted.plan })
    let report = yield* reportFinalizedRelease(admitted.bundle, admitted.plan)
    const initialDispatches = admitted.operations.reduce((sum, item) => sum + item.dispatches, 0)
    const handled = new Set<string>()
    while (mode === "run" && options.authorize && onRejected) {
      const used =
        report.operations.reduce((sum, item) => sum + item.dispatches, 0) - initialDispatches
      const remaining =
        options.maxDispatches === undefined ? undefined : options.maxDispatches - used
      if (remaining !== undefined && remaining <= 0) break
      const rejected = report.operations.filter((item) => item.status === "Rejected")
      if (rejected.length === 0 || rejected.some((item) => handled.has(item.operationId))) break
      let ready = true
      for (const item of rejected) {
        handled.add(item.operationId)
        const operation = admitted.plan.operations.find(
          (operation) => operation.operationId === item.operationId,
        )
        if (operation === undefined)
          return yield* failure(
            "application-operation",
            "Rejected operation is absent from the admitted Plan",
          )
        if (!(yield* Effect.suspend(() => onRejected(operation)))) {
          ready = false
          break
        }
      }
      if (!ready) break
      // Re-enter the public interpreter with the original Plan and journal.
      // The hook supplies live credentials, never a send permit or replay.
      yield* runRelease({
        ...options,
        plan: admitted.plan,
        ...(remaining === undefined ? {} : { maxDispatches: remaining }),
      })
      report = yield* reportFinalizedRelease(admitted.bundle, admitted.plan)
    }
    return report
  }).pipe(Effect.provideService(Host, host))
})

/** Acquire and interpret an application in one scope. The caller supplies any
 * factory services or layers and owns execution, interruption and logging.
 * Factory failures retain their typed error; construction bugs remain defects. */
export const runApplicationEffect = <E = never, R = never>(
  createApplication: CreateApplication<E, R>,
  input: unknown,
  mode: ApplicationMode = "run",
): Effect.Effect<FinalizedReport, E | ReleaseError | AdoptionError, Exclude<R, Scope.Scope>> =>
  Effect.scoped(
    Effect.gen(function* () {
      const selected = yield* captureMode(mode)
      const app = yield* Effect.suspend(
        (): Effect.Effect<Application, E | ReleaseError, R | Scope.Scope> => {
          const application = createApplication(input)
          return Effect.isEffect(application)
            ? application
            : Effect.fail(
                failure("application-effect", "createApplication must return a scoped Effect"),
              )
        },
      )
      return yield* executeApplication(app, selected)
    }),
  )

/** The legacy Promise adapter selects a trusted module and preserves its
 * published factory-throw normalization at this framework boundary only. */
const loadApplication = Effect.fnUntraced(function* (
  applicationPath: string,
  input: unknown,
): Effect.fn.Return<Application, ReleaseError, Scope.Scope> {
  const loaded: unknown = yield* Effect.tryPromise({
    try: () => import(pathToFileURL(resolve(applicationPath)).href),
    catch: () => failure("application-load", "Application module could not be loaded"),
  })
  const factory = yield* Effect.try({
    try: () => {
      if (
        typeof loaded !== "object" ||
        loaded === null ||
        !("createApplication" in loaded) ||
        typeof loaded.createApplication !== "function"
      )
        return fail("application-export", "Application must export createApplication(input)")
      const effect: unknown = Reflect.apply(loaded.createApplication, loaded, [input])
      if (!Effect.isEffect(effect))
        return fail("application-effect", "createApplication must return a scoped Effect")
      // Trusted application code owns the dynamic module's E/R contract; the host
      // admits only Effect values and scopes them. The runtime cannot inspect E/R.
      // @effect-diagnostics-next-line anyUnknownInErrorContext:off
      return effect as ReturnType<CreateApplication> // oxlint-disable-line typescript/no-unsafe-type-assertion -- Trusted dynamic module contract checked above.
    },
    catch: (error) =>
      error instanceof ReleaseError
        ? error
        : failure("invalid-data", "Value could not be admitted"),
  })
  return yield* factory
})

/** Promise adapter for a trusted module path. Effect applications can instead
 * compose runApplicationEffect without starting a nested runtime. */
export const runApplication = (
  applicationPath: string,
  input: unknown,
  signal?: AbortSignal,
  mode: ApplicationMode = "run",
): Promise<FinalizedReport> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const selected = yield* captureMode(mode)
        return yield* executeApplication(yield* loadApplication(applicationPath, input), selected)
      }),
    ).pipe(Effect.provideService(Logger.LogToStderr, true)),
    { signal },
  )
