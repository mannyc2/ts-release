export interface FinalizedArtifact { readonly logicalName: string; readonly bytes: Uint8Array; readonly sizeDecimal: string; readonly mode: number; readonly symlinkTarget?: string }
export declare const runLibraryConsumer: (requestId: string) => Promise<readonly object[]>;
export declare const runNodeHost: typeof runLibraryConsumer;
export declare const runBunHost: typeof runLibraryConsumer;
export declare const runCli: (requestId: string) => Promise<string>;
export declare const runAction: (requestId: string) => Promise<object>;
export declare const runPackedExternal: (requestId: string) => Promise<readonly object[]>;
export declare const adoptFinalizedArtifacts: (values: readonly FinalizedArtifact[]) => readonly FinalizedArtifact[];
