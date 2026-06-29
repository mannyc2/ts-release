import * as Schema from "effect/Schema"
import { GitTag } from "./release.js"
import { TargetId } from "./target.js"

export type * from "../types/effect-internal.js"

export class GitHubReleaseMissing extends Schema.TaggedClass<GitHubReleaseMissing>()("GitHubReleaseMissing", {
  targetId: TargetId,
  repository: Schema.String,
  tag: GitTag
}) {}

export class GitHubReleaseDraft extends Schema.TaggedClass<GitHubReleaseDraft>()("GitHubReleaseDraft", {
  targetId: TargetId,
  repository: Schema.String,
  tag: GitTag,
  title: Schema.String,
  draft: Schema.Literal(true),
  prerelease: Schema.Boolean,
  assetNames: Schema.Array(Schema.String)
}) {}

export class GitHubReleasePublished extends Schema.TaggedClass<GitHubReleasePublished>()("GitHubReleasePublished", {
  targetId: TargetId,
  repository: Schema.String,
  tag: GitTag,
  title: Schema.String,
  draft: Schema.Literal(false),
  prerelease: Schema.Boolean,
  assetNames: Schema.Array(Schema.String)
}) {}

export const GitHubReleaseRemoteState = Schema.Union([
  GitHubReleaseMissing,
  GitHubReleaseDraft,
  GitHubReleasePublished
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
