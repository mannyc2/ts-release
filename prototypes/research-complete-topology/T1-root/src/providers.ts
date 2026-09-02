import { Context, Effect, Layer } from "effect"
import type { ProviderPlugin } from "./kernel.js"

const makeProvider = (id: string, instances: ProviderPlugin["instances"]): ProviderPlugin => ({
  id,
  instances,
  prepare: (instanceId, requestId) => {
    if (!instances.some((instance) => instance.id === instanceId)) throw new Error(`unknown ${id} instance`)
    return { providerId: id, instanceId, requestId }
  }
})

export class ProviderA extends Context.Service<ProviderA, ProviderPlugin>()("@trial/root/ProviderA") {}
export class ProviderB extends Context.Service<ProviderB, ProviderPlugin>()("@trial/root/ProviderB") {}

export const providerA = makeProvider("provider-a", [
  { id: "provider-a-production", endpointClass: "production" },
  { id: "provider-a-staging", endpointClass: "staging" }
])
export const providerB = makeProvider("provider-b", [
  { id: "provider-b-primary", endpointClass: "primary" }
])
export const providerALayer = Layer.succeed(ProviderA, providerA)
export const providerBLayer = Layer.succeed(ProviderB, providerB)
export const prepareFirstParty = Effect.fn("Root.prepareFirstParty")(function* (requestId: string) {
  const a = yield* ProviderA
  const b = yield* ProviderB
  return [a.prepare("provider-a-staging", requestId), b.prepare("provider-b-primary", requestId)] as const
})
