/** Compiler-derived research shape adapted to the proposed production contract.
 * Target durable formats and selected producer pin differ from the frozen research
 * bytes. No production implementation or native acceptance is claimed. */
/** Proposed research surface; this is not a published package or compatibility promise. */
export { Content, OwnedFile as File, OwnedTree as Tree, OwnedBundle as Bundle, OwnedArtifact as Artifact, AdoptionError, adoptFile, adoptTree, finalize } from "./adoption.js";
export type { ContentOwner } from "./adoption.js";
export { encodeBundle, loadBundle, restoreTree } from "./bundle-codec.js";
export { ApplePreparation, ApplicationSignature, ReadyToPlan, AppleEvidence, preparationProvider, preparationScope, submitPreparedApp, finishPreparedApp, runPreparation, validateApplePublication, reportAppleContext } from "./apple-preparation.js";
