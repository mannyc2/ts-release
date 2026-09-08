import { type Transport } from "../Provider.js";
import type { CredentialExchange, HttpExchangeOptions } from "../Http.js";
import type { HttpRead, HttpReadOptions, HttpTransportOptions } from "../Http.js";
/** Capture definition methods once; each owner sees its own bytes. Resolving
 * credentials creates no dispatch permission. The kernel still owns fresh CAS. */
export declare const makeHttpTransport: (options: HttpTransportOptions) => Transport;
/** Observation uses the same bounded native reader and exact credential binding. */
export declare const makeHttpRead: (options: HttpReadOptions) => HttpRead;
/** Host-only live credential exchange. Response/token bytes are never journaled. */
export declare const makeCredentialExchange: (options: HttpExchangeOptions) => CredentialExchange;
