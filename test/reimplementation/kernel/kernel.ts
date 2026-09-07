// Retained independent oracles now execute the production kernel. Faults are
// injected at actual host ports; production RunOptions has no checkpoint hook.
import * as Effect from "effect/Effect"
import * as Release from "../../../packages/ts-release/src/index.js"
export * from "../../../packages/ts-release/src/index.js"
export {
  canonical,
  parseCanonical,
  sha256,
  hashCanonical,
} from "../../../packages/ts-release/src/internal/Identity.js"
export { validateDag } from "../../../packages/ts-release/src/Plan.js"
export { verifyRequest, requestFingerprint } from "../../../packages/ts-release/src/Provider.js"

type FaultOptions = Release.RunOptions & {
  readonly checkpoint?: (
    stage: "after-append" | "after-send" | "after-receipt",
    event: Release.JournalEvent,
  ) => Effect.Effect<void, Release.ReleaseError>
}
export const runRelease = (options: FaultOptions) =>
  Effect.gen(function* () {
    const host = yield* Release.Host
    if (!options.checkpoint) return yield* Release.runRelease(options)
    const checkpoint = options.checkpoint
    let dispatch: Release.JournalEvent | undefined
    const adapted: Release.HostShape = {
      ...host,
      store: {
        read: host.store.read,
        append: (id, revision, event) =>
          host.store.append(id, revision, event).pipe(
            Effect.tap((result) => {
              if (result._tag !== "Appended") return Effect.void
              if (event.body._tag === "DispatchStarted") {
                dispatch = event
                return checkpoint("after-append", event)
              }
              return event.body._tag === "ReceiptAccepted" && dispatch
                ? checkpoint("after-receipt", dispatch)
                : Effect.void
            }),
          ),
      },
      transport: {
        send: (request) =>
          host.transport
            .send(request)
            .pipe(
              Effect.tap(() =>
                dispatch
                  ? checkpoint("after-send", dispatch).pipe(
                      Effect.catch((error) => Effect.die(error)),
                    )
                  : Effect.void,
              ),
            ),
      },
    }
    return yield* Release.runRelease(options).pipe(Effect.provideService(Release.Host, adapted))
  })
