import type { ContentOwner } from "../internal/Content.js";
/** Explicit native Node capability for bounded enumeration, including in Bun
 * applications. No ambient PATH lookup or Bun readdir fallback. Cancellation
 * kills and awaits the child. Native cursor prefetch is bounded by Node/libuv. */
export declare const nodeDirectoryReader: (nodeExecutable: string) => ContentOwner["readDirectoryBounded"];
