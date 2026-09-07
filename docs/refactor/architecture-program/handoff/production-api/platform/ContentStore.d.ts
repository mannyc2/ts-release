import type { ContentOwner } from "../internal/Content.js";
/** Immutable content names, exclusive temporary files and exact read-back on EEXIST. */
export declare const fileContentOwner: (directory: string, readDirectoryBounded?: ContentOwner["readDirectoryBounded"]) => ContentOwner;
