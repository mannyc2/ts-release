import * as Schema from "effect/Schema"
import { TargetId } from "./target.js"

export type * from "../types/effect-internal.js"

export const NpmRemoteState = Schema.Literals(["missing", "published"])
export type NpmRemoteState = typeof NpmRemoteState.Type

export const GitHubReleaseAvailability = Schema.Literals(["missing", "draft", "published"])
export type GitHubReleaseAvailability = typeof GitHubReleaseAvailability.Type

export const ReleaseEligibilityStatus = Schema.Literals(["ready", "complete", "partial", "skipped"])
export type ReleaseEligibilityStatus = typeof ReleaseEligibilityStatus.Type

export class ReleaseEligibilityInput extends Schema.Class<ReleaseEligibilityInput>("ReleaseEligibilityInput")({
  packageName: Schema.String,
  packageVersion: Schema.String,
  expectedGithubDraft: Schema.Boolean,
  npm: NpmRemoteState,
  github: GitHubReleaseAvailability
}) {}

export class ReleaseEligibilityDecision extends Schema.Class<ReleaseEligibilityDecision>(
  "ReleaseEligibilityDecision"
)({
  shouldRelease: Schema.Boolean,
  status: ReleaseEligibilityStatus,
  reason: Schema.String,
  strategy: Schema.optionalKey(Schema.String),
  packageName: Schema.optionalKey(Schema.String),
  packageVersion: Schema.optionalKey(Schema.String),
  githubTag: Schema.optionalKey(Schema.String),
  source: Schema.optionalKey(Schema.String)
}) {}

export class GitHubReleaseMissing extends Schema.TaggedClass<GitHubReleaseMissing>()("GitHubReleaseMissing", {
  targetId: TargetId,
  repository: Schema.String,
  tag: Schema.String
}) {}

export class GitHubReleaseDraft extends Schema.TaggedClass<GitHubReleaseDraft>()("GitHubReleaseDraft", {
  targetId: TargetId,
  repository: Schema.String,
  tag: Schema.String,
  title: Schema.String,
  draft: Schema.Literal(true),
  prerelease: Schema.Boolean,
  assetNames: Schema.Array(Schema.String)
}) {}

export class GitHubReleasePublished extends Schema.TaggedClass<GitHubReleasePublished>()("GitHubReleasePublished", {
  targetId: TargetId,
  repository: Schema.String,
  tag: Schema.String,
  title: Schema.String,
  draft: Schema.Literal(false),
  prerelease: Schema.Boolean,
  assetNames: Schema.Array(Schema.String)
}) {}

export class GitHubReleaseMismatch extends Schema.TaggedClass<GitHubReleaseMismatch>()("GitHubReleaseMismatch", {
  targetId: TargetId,
  repository: Schema.String,
  tag: Schema.String,
  reasons: Schema.Array(Schema.String)
}) {}

export const GitHubReleaseRemoteState = Schema.Union([
  GitHubReleaseMissing,
  GitHubReleaseDraft,
  GitHubReleasePublished,
  GitHubReleaseMismatch
])
export type GitHubReleaseRemoteState = typeof GitHubReleaseRemoteState.Type

export class GitHubReconcileSkip extends Schema.TaggedClass<GitHubReconcileSkip>()("GitHubReconcileSkip", {
  targetId: TargetId,
  reason: Schema.String
}) {}

export class GitHubReconcileCreateRelease extends Schema.TaggedClass<GitHubReconcileCreateRelease>()(
  "GitHubReconcileCreateRelease",
  {
    targetId: TargetId,
    reason: Schema.String
  }
) {}

export class GitHubReconcilePublishDraft extends Schema.TaggedClass<GitHubReconcilePublishDraft>()(
  "GitHubReconcilePublishDraft",
  {
    targetId: TargetId,
    reason: Schema.String
  }
) {}

export class GitHubReconcileBlock extends Schema.TaggedClass<GitHubReconcileBlock>()("GitHubReconcileBlock", {
  targetId: TargetId,
  reasons: Schema.Array(Schema.String)
}) {}

export const GitHubReleaseReconciliationDecision = Schema.Union([
  GitHubReconcileSkip,
  GitHubReconcileCreateRelease,
  GitHubReconcilePublishDraft,
  GitHubReconcileBlock
])
export type GitHubReleaseReconciliationDecision = typeof GitHubReleaseReconciliationDecision.Type
