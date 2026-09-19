import { kernelVersion } from "@trial/kernel";
if (kernelVersion !== "0.0.0-trial") throw new Error(`unsupported @trial/kernel ${kernelVersion}`);
export const providerA = { instances: ["provider-a-production", "provider-a-staging"], prepare: (instanceId, requestId) => ({ providerId: "provider-a", instanceId, requestId, kernelVersion }) };
