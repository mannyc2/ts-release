export interface ExternalOperation { readonly providerId: "external-provider"; readonly instanceId: string; readonly requestId: string }
export declare const externalProvider: { readonly instances: readonly ["external-provider-primary", "external-provider-secondary"]; readonly prepare: (instanceId: string, requestId: string) => ExternalOperation };
export declare const verifyRootConsumer: (requestId: string) => Promise<number>;
