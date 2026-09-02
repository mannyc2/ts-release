import { Context, Layer } from "effect"
import type { ProviderPlugin } from "../src/kernel.js"

export class ExternalProvider extends Context.Service<ExternalProvider, ProviderPlugin>()("@trial/external/Provider") {}
export const externalProvider: ProviderPlugin = {
  id: "external-provider",
  instances: [
    { id: "external-provider-primary", endpointClass: "primary" },
    { id: "external-provider-secondary", endpointClass: "secondary" }
  ],
  prepare: (instanceId, requestId) => ({ providerId: "external-provider", instanceId, requestId })
}
export const externalProviderLayer = Layer.succeed(ExternalProvider, externalProvider)
