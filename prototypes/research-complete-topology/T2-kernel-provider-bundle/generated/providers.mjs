export class ProviderA {}
export class ProviderB {}
export const prepareFirstParty = requestId => [{ providerId: "provider-a", requestId }, { providerId: "provider-b", requestId }];
