export interface PreparedOperation { readonly providerId: string; readonly instanceId: string; readonly requestId: string }
export declare const providerA: { readonly instances: readonly ["provider-a-production", "provider-a-staging"] };
export declare const providerB: { readonly instances: readonly ["provider-b-primary"] };
export declare const prepareFirstParty: (requestId: string) => readonly [PreparedOperation, PreparedOperation];
