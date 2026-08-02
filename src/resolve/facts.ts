// What the world can tell us about a release, observed by an app and passed in
// as a value. The library never looks: no git, no filesystem, no environment —
// observation is the imperative shell's job, resolution is pure.
import * as Schema from "effect/Schema"
import { NonEmptyName, Version } from "../model/primitives.js"

const optional = Schema.optionalKey

export class ObservedFacts extends Schema.Class<ObservedFacts>("ObservedFacts")({
  commit: optional(NonEmptyName),
  manifestName: optional(Schema.NonEmptyString),
  manifestVersion: optional(Version),
  // The version carried by the single release-shaped tag at HEAD. Ambiguity is
  // resolved by the observer: several candidate tags means NO fact, so the
  // resolver refuses instead of picking one.
  headTagVersion: optional(Version)
}) {}
