import { OwnedTree } from "./ArtifactModel.js";
/** Preserve the upstream ordered manifest preimage; canonical key sorting changes its ID. */
export declare const treeManifest: (tree: OwnedTree) => string;
