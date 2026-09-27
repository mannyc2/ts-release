import { Schema } from "effect"
import { ApplicationInput } from "../apps/self-release/src/Model.js"

/** Retained identity file shared by candidate preparation and runtime installation. */
export const CandidateIdentity = Schema.Struct({
  bundleSha256: ApplicationInput.fields.bundleSha256,
  planId: ApplicationInput.fields.planId,
})

/** The pinned Sigstore package's seed document, before trust-root verification. */
export const SigstoreSeeds = Schema.Struct({
  "https://tuf-repo-cdn.sigstore.dev": Schema.Struct({ "root.json": Schema.String }),
})

/** Only the metadata used to inspect this repository's package deliveries. */
export const PackageExports = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  exports: Schema.Record(
    Schema.String,
    Schema.StructWithRest(Schema.Struct({ types: Schema.String, import: Schema.String }), [
      Schema.Record(Schema.String, Schema.Unknown),
    ]),
  ),
  bin: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
})
