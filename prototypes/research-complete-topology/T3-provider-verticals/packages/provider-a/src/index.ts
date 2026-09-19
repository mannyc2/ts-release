import { Context, Layer } from "effect"
import type { ProviderPlugin } from "../../kernel/src/index.js"
export class ProviderA extends Context.Service<ProviderA, ProviderPlugin>()("@trial/provider-a/Provider") {}
export const providerA: ProviderPlugin = { id: "provider-a", instances: [{ id: "provider-a-production", endpointClass: "production" }, { id: "provider-a-staging", endpointClass: "staging" }], prepare: (instanceId, requestId) => ({ providerId: "provider-a", instanceId, requestId }) }
export const providerALayer = Layer.succeed(ProviderA, providerA)
