import { Context, Effect, Layer, Schema } from "effect"
import * as Activity from "effect/unstable/workflow/Activity"

interface ExampleClientService {
  readonly get: (key: string) => Effect.Effect<string>
}
class ExampleClient extends Context.Service<ExampleClient, ExampleClientService>()("probe/ExampleClient") {}

class BoundaryValue extends Schema.Class<BoundaryValue>("BoundaryValue")({ value: Schema.String }) {}
class BoundaryError extends Schema.TaggedErrorClass<BoundaryError>()("BoundaryError", {
  reason: Schema.String
}) {}

const make = Effect.fnUntraced(function*() {
  return ExampleClient.of({ get: (key) => Effect.succeed(key) })
})
const layer = Layer.effect(ExampleClient, make)
const operation = Effect.fn("probe.operation")(function*(key: string) {
  const client = yield* ExampleClient
  return yield* client.get(key)
})
const decoded = Schema.decodeUnknownEffect(BoundaryValue)({ value: "ok" })
const activity = Activity.make({
  name: "probe.activity",
  success: BoundaryValue,
  error: BoundaryError,
  execute: decoded
})
void activity.exitSchema
// beta.83 does not expose partial-exit encoding.
// @ts-expect-error expected baseline delta
void activity.exitSchemaPartial
void operation("ok").pipe(Effect.provide(layer))
