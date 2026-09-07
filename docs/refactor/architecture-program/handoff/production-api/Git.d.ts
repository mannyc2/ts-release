export type {} from "./internal/EffectTypes.js";
export { GitCas } from "./internal/ReleaseModel.js";
export { GitReceipt, makeCoreGitTransport, type GitExecution, type CoreGitOptions, } from "./internal/GitAuthority.js";
export type { GitCatalogHost as NativeHost } from "./platform/GitHost.js";
export { FileEdit, Identity, CommitInput, Intent, type RefCoordinate, type Credentials, type ObserveRef, type ObjectBuilder, prepare, update, definition, } from "./internal/GitCatalog.js";
