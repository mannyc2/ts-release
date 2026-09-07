/** No extraction to a filesystem. Bound decompression and validate complete
 * ZIP32 headers, central/local correspondence, CRC and non-overlapping data. */
export declare const readZip: (input: Uint8Array) => Map<string, Uint8Array<ArrayBufferLike>>;
export declare const readTar: (input: Uint8Array) => Map<string, Uint8Array<ArrayBufferLike>>;
