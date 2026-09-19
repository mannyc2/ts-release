import { releaseVersion, runLibraryConsumer } from "@trial/release";
export const externalProvider = {
  instances: ["external-provider-primary", "external-provider-secondary"],
  prepare: (instanceId, requestId) => ({ providerId: "external-provider", instanceId, requestId })
};
export const verifyRootConsumer = async requestId => {
  if (releaseVersion !== "0.0.0-trial") throw new Error(`unsupported @trial/release ${releaseVersion}`);
  return (await runLibraryConsumer(requestId)).length;
};
