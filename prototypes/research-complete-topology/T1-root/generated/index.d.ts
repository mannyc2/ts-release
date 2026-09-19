export declare const runLibraryConsumer: (requestId: string) => Promise<readonly unknown[]>;
export declare const runNodeHost: typeof runLibraryConsumer;
export declare const runBunHost: typeof runLibraryConsumer;
export declare const runCli: (requestId: string) => Promise<string>;
export declare const runAction: (requestId: string) => Promise<object>;
export declare const runPackedExternal: (requestId: string) => Promise<readonly unknown[]>;
export declare const adoptFinalizedArtifacts: (artifacts: readonly object[]) => readonly object[];
export declare class ProviderA {}
export declare class ProviderB {}
export declare const releaseVersion: "0.0.0-trial";
