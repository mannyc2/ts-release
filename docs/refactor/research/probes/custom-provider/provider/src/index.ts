import type { Artifact } from "@ts-release-research/core"
import { Config, Context, Effect, Layer, Schema } from "effect"

export class PublishReceipt extends Schema.Class<PublishReceipt>("OutsidePublishReceipt")({
  destination: Schema.NonEmptyString,
  artifactId: Schema.NonEmptyString,
  acceptedBytes: Schema.Number
}) {}

export interface ClientService {
  readonly put: (artifact: Artifact) => Effect.Effect<PublishReceipt>
}

export class Client extends Context.Service<Client, ClientService>()(
  "@outside/custom-publication-provider/Client"
) {}

export interface Options {
  readonly destination: string
}

export const make = Effect.fnUntraced(function*(options: Options) {
  return Client.of({
    put: (artifact) => Effect.succeed(new PublishReceipt({
      destination: options.destination,
      artifactId: artifact.id,
      acceptedBytes: artifact.bytes.byteLength
    }))
  })
})

export const layer = (options: Options): Layer.Layer<Client> =>
  Layer.effect(Client, make(options))

export const layerConfig = (options: {
  readonly destination: Config.Config<string>
}): Layer.Layer<Client, Config.ConfigError> =>
  Layer.effect(Client, Effect.flatMap(options.destination, (destination) => make({ destination })))

export const publish = Effect.fn("OutsideProvider.publish")(function*(artifact: Artifact) {
  const client = yield* Client
  return yield* client.put(artifact)
})
