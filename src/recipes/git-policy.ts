import * as Schema from "effect/Schema"

export class GitPlanningFacts extends Schema.Class<GitPlanningFacts>("GitPlanningFacts")({
  head: Schema.NonEmptyString,
  tags: Schema.Array(Schema.NonEmptyString)
}) {}
export class CandidateGitPolicy extends Schema.Class<CandidateGitPolicy>("CandidateGitPolicy")({
  tagPrefix: Schema.optionalKey(Schema.String),
  tagSort: Schema.optionalKey(Schema.Literal("smart-semver")),
  include: Schema.optionalKey(Schema.Array(Schema.NonEmptyString)),
  exclude: Schema.optionalKey(Schema.Array(Schema.NonEmptyString))
}) {}
const matches = (pattern: string, value: string): boolean => {
  const [prefix, suffix] = pattern.split("*", 2)
  return value.startsWith(prefix!) && (suffix === undefined || value.endsWith(suffix))
}
const version = (tag: string, prefix: string): readonly [number, number, number, string] => {
  const [core, prerelease = ""] = tag.slice(prefix.length).split("-", 2)
  const [major = 0, minor = 0, patch = 0] = core!.split(".").map(Number)
  return [major, minor, patch, prerelease]
}
export const selectTags = (facts: GitPlanningFacts, policy: CandidateGitPolicy): ReadonlyArray<string> =>
  facts.tags.filter((tag) =>
    (policy.include?.some((pattern) => matches(pattern, tag)) ?? true) &&
    !(policy.exclude?.some((pattern) => matches(pattern, tag)) ?? false))
    .sort((left, right) => {
      const a = version(left, policy.tagPrefix ?? "")
      const b = version(right, policy.tagPrefix ?? "")
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] ||
        (a[3] === b[3] ? 0 : a[3] === "" ? 1 : b[3] === "" ? -1 : a[3].localeCompare(b[3]))
    })
