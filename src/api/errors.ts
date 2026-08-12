import * as Schema from "effect/Schema"
import { CompletePreparedReleaseRef } from "../release/prepared-ref.js"

export class ReleaseInputError
  extends Schema.TaggedErrorClass<ReleaseInputError>()("ReleaseInputError", { reason: Schema.String }) {}

/**
 * Cross-host preparation is deliberately reserved for plan 235. Recognizing
 * these two tags before strict input decoding gives callers an actionable,
 * typed refusal without publishing a partial-bundle shape prematurely.
 */
export class PreparationModeUnsupported
  extends Schema.TaggedErrorClass<PreparationModeUnsupported>()("PreparationModeUnsupported", {
    mode: Schema.Literals(["partition", "merge"]),
    owner: Schema.Literal("plan-235"),
    reason: Schema.String
  }) {}

export class ReleasePreparationError
  extends Schema.TaggedErrorClass<ReleasePreparationError>()("ReleasePreparationError", {
    cause: Schema.String
  }) {}

export class ReleaseAbortedError
  extends Schema.TaggedErrorClass<ReleaseAbortedError>()("ReleaseAbortedError", {
    prepared: Schema.optionalKey(CompletePreparedReleaseRef),
    cause: Schema.String
  }) {}

/** Product-boundary failure after a truthful total report has been emitted. */
export class ReleaseIncompleteError
  extends Schema.TaggedErrorClass<ReleaseIncompleteError>()("ReleaseIncompleteError", {
    prepared: CompletePreparedReleaseRef,
    status: Schema.Literals(["blocked", "uncertain"]),
    reason: Schema.String
  }) {}
