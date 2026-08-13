// The shape a HUMAN writes. It is the canonical config with the facts a
// repository already knows made optional, plus the two directives that say how
// to fill them. Nothing here is inferred at plan time: resolution happens at
// the application boundary and produces a canonical value before `plan` runs.
//
// The field lists are REUSED from the canonical classes, never restated — a
// hand-mirrored schema is a drift machine.
import * as Schema from "effect/Schema"
import { NonEmptyName, Version } from "../model/primitives.js"
import {
  CandidateConfig,
  CandidatePublish,
  CandidateProject,
  NpmAccess,
  NpmAuthentication,
  NpmProvenancePolicy
} from "../recipes/config.js"

const optional = Schema.optionalKey

export class AuthoredProject extends Schema.Class<AuthoredProject>("AuthoredProject")({
  ...CandidateProject.fields,
  // Filled from the package manifest's name when omitted; still required if
  // nothing observes one.
  name: optional(NonEmptyName),
  // Observed or derived when omitted: version from a manifest or the tag at
  // HEAD, and tag from the template. Source commit is always observed; a
  // human-authored commit expectation would only validate and then disappear.
  version: optional(Version),
  tag: optional(NonEmptyName),
  // `{version}` is the only token, and it is the only one this repo will ever
  // accept: a template grammar is the rejected direction.
  tagTemplate: optional(Schema.NonEmptyString)
}) {}

/** Human-authored npm policy. Resolution fills only documented deterministic defaults. */
export class AuthoredNpmPublish extends Schema.Class<AuthoredNpmPublish>("AuthoredNpmPublish")({
  registry: optional(Schema.NonEmptyString),
  distTag: optional(Schema.NonEmptyString),
  access: optional(NpmAccess),
  authentication: NpmAuthentication,
  provenance: optional(NpmProvenancePolicy)
}) {}

export class AuthoredPublish extends Schema.Class<AuthoredPublish>("AuthoredPublish")({
  ...CandidatePublish.fields,
  npm: optional(AuthoredNpmPublish)
}) {}

export class AuthoredConfig extends Schema.Class<AuthoredConfig>("AuthoredConfig")({
  ...CandidateConfig.fields,
  project: AuthoredProject,
  publish: optional(AuthoredPublish),
  versionFrom: optional(Schema.Literals(["manifest", "git-tag"]))
}) {}
