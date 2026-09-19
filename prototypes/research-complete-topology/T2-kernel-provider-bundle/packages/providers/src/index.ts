import { Context, Effect, Layer } from "effect"
import type { ProviderPlugin } from "../../kernel/src/index.js"

const makeProvider = (id: string, instances: ProviderPlugin["instances"]): ProviderPlugin => ({ id, instances, prepare: (instanceId, requestId) => ({ providerId: id, instanceId, requestId }) })
export class ProviderA extends Context.Service<ProviderA, ProviderPlugin>()("@trial/providers/ProviderA") {}
export class ProviderB extends Context.Service<ProviderB, ProviderPlugin>()("@trial/providers/ProviderB") {}
export const providerALayer = Layer.succeed(ProviderA, makeProvider("provider-a", [{ id: "provider-a-production", endpointClass: "production" }, { id: "provider-a-staging", endpointClass: "staging" }]))
export const providerBLayer = Layer.succeed(ProviderB, makeProvider("provider-b", [{ id: "provider-b-primary", endpointClass: "primary" }]))
export const firstPartyLayers = Layer.mergeAll(providerALayer, providerBLayer)
export const prepareFirstParty = Effect.fn("Bundle.prepareFirstParty")(function* (requestId: string) { const a = yield* ProviderA; const b = yield* ProviderB; return [a.prepare("provider-a-staging", requestId), b.prepare("provider-b-primary", requestId)] as const })
