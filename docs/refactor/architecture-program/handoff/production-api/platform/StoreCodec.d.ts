import { JournalEvent } from "../internal/ReleaseModel.js";
export declare const EVENT_BYTES = 1048576;
export declare const eventBytes: (event: JournalEvent) => Uint8Array;
export declare const readEvent: (bytes: Uint8Array) => JournalEvent;
export declare const encodeEvent: (event: JournalEvent, journalId: string) => Uint8Array;
