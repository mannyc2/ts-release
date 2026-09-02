import { kernelVersion } from "@trial/kernel";
if (kernelVersion !== "0.0.0-trial") throw new Error(`unsupported @trial/kernel ${kernelVersion}`);
const prepare = (providerId, instanceId, requestId) => ({ providerId, instanceId, requestId, kernelVersion });
export const providerA = { instances: ["provider-a-production", "provider-a-staging"] };
export const providerB = { instances: ["provider-b-primary"] };
export const prepareFirstParty = requestId => [prepare("provider-a", "provider-a-staging", requestId), prepare("provider-b", "provider-b-primary", requestId)];
