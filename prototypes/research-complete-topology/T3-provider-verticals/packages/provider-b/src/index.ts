import { Context, Layer } from "effect"
import type { ProviderPlugin } from "../../kernel/src/index.js"
export class ProviderB extends Context.Service<ProviderB, ProviderPlugin>()("@trial/provider-b/Provider") {}
export const providerB: ProviderPlugin = { id: "provider-b", instances: [{ id: "provider-b-primary", endpointClass: "primary" }], prepare: (instanceId, requestId) => ({ providerId: "provider-b", instanceId, requestId }) }
export const providerBLayer = Layer.succeed(ProviderB, providerB)
