/** Match the retained native policy: no duplicate keys, unsafe integers, or
 * ambiguous strings. JSON.parse builds the value only after lexical admission. */
export declare const decodeJson: (input: string | Uint8Array) => unknown;
