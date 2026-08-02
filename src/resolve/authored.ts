// The shape a HUMAN writes. It is the canonical config with the facts a
// repository already knows made optional, plus the two directives that say how
// to fill them. Nothing here is inferred at plan time: resolution happens at
// the application boundary and produces a canonical value before `plan` runs.
//
// The field lists are REUSED from the canonical classes, never restated — a
// hand-mirrored schema is a drift machine.
import * as Schema from "effect/Schema"
import { NonEmptyName, Version } from "../model/primitives.js"
import { CandidateConfig, CandidateProject } from "../recipes/config.js"

const optional = Schema.optionalKey

export class AuthoredProject extends Schema.Class<AuthoredProject>("AuthoredProject")({
  ...CandidateProject.fields,
  // Filled from the package manifest's name when omitted; still required if
  // nothing observes one.
  name: optional(NonEmptyName),
  // Observed or derived when omitted: version from a manifest or the tag at
  // HEAD, tag from the template, commit from the repository.
  version: optional(Version),
  tag: optional(NonEmptyName),
  // `{version}` is the only token, and it is the only one this repo will ever
  // accept: a template grammar is the rejected direction.
  tagTemplate: optional(Schema.NonEmptyString)
}) {}

export class AuthoredConfig extends Schema.Class<AuthoredConfig>("AuthoredConfig")({
  ...CandidateConfig.fields,
  project: AuthoredProject,
  versionFrom: optional(Schema.Literals(["manifest", "git-tag"]))
}) {}
