const providers = ["provider-a", "provider-b"];
export const runLibraryConsumer = async requestId => providers.map(providerId => ({ providerId, requestId }));
export const runNodeHost = runLibraryConsumer;
export const runBunHost = runLibraryConsumer;
export const runCli = async requestId => (await runLibraryConsumer(requestId)).map(x => x.providerId).join(",");
export const runAction = async requestId => ({ artifact: "action-bundle", operations: await runLibraryConsumer(requestId) });
export const runPackedExternal = async requestId => ["primary", "secondary"].map(instanceId => ({ providerId: "external-provider", instanceId, requestId }));
export const adoptFinalizedArtifacts = artifacts => artifacts.map(value => ({ ...value, bytes: value.bytes.slice() }));
export class ProviderA {}
export class ProviderB {}
export const releaseVersion = "0.0.0-trial";
