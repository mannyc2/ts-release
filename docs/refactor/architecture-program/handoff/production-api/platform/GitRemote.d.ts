import * as Effect from "effect/Effect";
import { type RefCoordinate } from "../internal/GitCatalog.js";
import { type GitCommand, type GitEnvironment } from "./GitProcess.js";
export declare const remoteRef: (run: GitCommand, coordinate: RefCoordinate, environment: GitEnvironment) => Effect.Effect<string | null, import("../internal/Error.js").ReleaseError, never>;
export declare const fetchRef: (run: GitCommand, coordinate: RefCoordinate, environment: GitEnvironment) => Effect.Effect<string, import("../internal/Error.js").ReleaseError, never>;
