import * as Effect from "effect/Effect";
import { AdoptionError, OwnedBundle } from "./ArtifactModel.js";
export declare const adoptData: <A>(body: () => A) => Effect.Effect<A, AdoptionError>;
/** Finalization owns all metadata and exposes no mutable builder. */
export declare const finalize: (artifacts: readonly (import("./ArtifactModel.js").OwnedFile | import("./ArtifactModel.js").OwnedTree)[]) => Effect.Effect<OwnedBundle, AdoptionError, never>;
