import * as Schema from "effect/Schema"

export class CandidateNightly extends Schema.Class<CandidateNightly>("CandidateNightly")({
  replace: Schema.Literal(true),
  tag: Schema.NonEmptyString
}) {}
export type NightlyDecision = "replace" | "create" | "manual"
export const nightlyDecision = (
  policy: CandidateNightly,
  remote: "present" | "absent" | "unknown"
): NightlyDecision => remote === "unknown" ? "manual"
  : remote === "present" && policy.replace ? "replace" : "create"
