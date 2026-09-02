import { kernelVersion } from "@trial/kernel";
if (kernelVersion !== "0.0.0-trial") throw new Error(`unsupported @trial/kernel ${kernelVersion}`);
export const providerB = { instances: ["provider-b-primary"], prepare: (instanceId, requestId) => ({ providerId: "provider-b", instanceId, requestId, kernelVersion }) };
