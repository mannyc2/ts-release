import { kernelVersion } from "@trial/kernel";
if (kernelVersion !== "0.0.0-trial") throw new Error(`unsupported @trial/kernel ${kernelVersion}`);
export const externalProvider = { instances: ["external-provider-primary", "external-provider-secondary"], prepare: (instanceId, requestId) => ({ providerId: "external-provider", instanceId, requestId, kernelVersion }) };
