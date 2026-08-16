import { Schema } from "effect"

// Harness-only boundary value. Core contains no provider names, registry, or
// extension admission mechanism.
export class Artifact extends Schema.Class<Artifact>("ResearchArtifact")({
  id: Schema.NonEmptyString,
  logicalName: Schema.NonEmptyString,
  bytes: Schema.Uint8ArrayFromSelf
}) {}
