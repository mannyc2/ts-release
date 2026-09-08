export type TarEntry = Readonly<{
    path: string;
    kind: "file" | "directory";
    body: Uint8Array;
}>;
export declare const registerArchivePath: (seen: Set<string>, raw: string, directory: boolean, invalid: (reason: string) => never) => string;
/** Strict bounded ustar/PAX reader over provider-decompressed bytes. */
export declare const readTarBytes: (input: Uint8Array, maximumBytes: number, allowedPaxFields: ReadonlySet<string>, invalid: (reason: string) => never) => readonly TarEntry[];
