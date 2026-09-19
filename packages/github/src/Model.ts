import * as Schema from "effect/Schema"
import { File } from "@mannyc1/ts-release/bundle"

const bounded = (maximum: number) =>
  Schema.String.check(
    Schema.isMaxLength(maximum),
    Schema.makeFilter((s) => s === s.normalize("NFC") && !/[\u0000\ud800-\udfff]/u.test(s)),
  )
export const text = bounded(2048).check(
  Schema.isMinLength(1),
  Schema.makeFilter((s) => s.trim() === s && !/[\u0000-\u001f\u007f]/u.test(s)),
)
export const oid = Schema.String.check(Schema.isPattern(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u))
export const nativeId = Schema.String.check(
  Schema.isPattern(/^[1-9][0-9]*$/u),
  Schema.makeFilter((s) => Number.isSafeInteger(Number(s))),
)
export const tagName = text.check(
  Schema.makeFilter(
    (s) =>
      s !== "@" &&
      !/[ ~^:?*\[\\]/u.test(s) &&
      !s.includes("@{") &&
      !s.includes("..") &&
      s
        .split("/")
        .every((p) => p && !p.startsWith(".") && !p.endsWith(".") && !p.endsWith(".lock")),
  ),
)
export class Repository extends Schema.Class<Repository>("GitHubRepository")({
  apiUrl: Schema.Literal("https://api.github.com"),
  owner: text.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9-]*$/u)),
  name: text.check(
    Schema.isPattern(/^[A-Za-z0-9_.-]+$/u),
    Schema.makeFilter((s) => s !== "." && s !== ".."),
  ),
}) {}
export class Tagger extends Schema.Class<Tagger>("GitHubTagger")({
  name: text.check(Schema.makeFilter((s) => !/[<>]/u.test(s))),
  email: text.check(Schema.isPattern(/^[^\s<>@]+@[^\s<>@]+$/u)),
  date: Schema.String.check(
    Schema.makeFilter(
      (s) =>
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/u.test(s) &&
        Number.isFinite(Date.parse(s)) &&
        new Date(s.slice(0, 19) + "Z").toISOString() === s.slice(0, 19) + ".000Z",
    ),
  ),
}) {}
const tag = { repository: Repository, tag: tagName, commit: oid, principal: text }
export class LightweightTag extends Schema.Class<LightweightTag>("GitHubLightweightTag")(tag) {}
export class AnnotatedTag extends Schema.Class<AnnotatedTag>("GitHubAnnotatedTag")({
  ...tag,
  message: bounded(128_000),
  tagger: Tagger,
}) {}
export class AnnotatedRef extends Schema.Class<AnnotatedRef>("GitHubAnnotatedRef")({
  repository: Repository,
  tag: tagName,
  annotatedTagOperation: text,
  principal: text,
}) {}
export class ManagedTag extends Schema.TaggedClass<ManagedTag>()("ManagedTag", {
  operationId: text,
}) {}
export class ExistingTag extends Schema.TaggedClass<ExistingTag>()("ExistingTag", {
  commit: oid,
}) {}
export const TagSource = Schema.Union([ManagedTag, ExistingTag])
export type TagSource = typeof TagSource.Type
export class DraftIntent extends Schema.Class<DraftIntent>("GitHubDraftIntent")({
  repository: Repository,
  tag: tagName,
  tagSource: TagSource,
  title: bounded(1024),
  body: bounded(128_000),
  prerelease: Schema.Boolean,
  principal: text,
}) {}
export class AssetIntent extends Schema.Class<AssetIntent>("GitHubAssetIntent")({
  repository: Repository,
  draftOperation: text,
  file: File,
  publicName: text.check(
    Schema.isMaxLength(255),
    Schema.makeFilter((s) => !/[\/\\]/u.test(s) && s !== "." && s !== ".."),
  ),
  mediaType: text.check(Schema.isPattern(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/u)),
  principal: text,
}) {}
export class PublishIntent extends Schema.Class<PublishIntent>("GitHubPublishIntent")({
  repository: Repository,
  draftOperation: text,
  assetOperations: Schema.Array(text),
  principal: text,
}) {}
export class AnnotatedTagFacts extends Schema.Class<AnnotatedTagFacts>("GitHubAnnotatedTagFacts")({
  objectOid: oid,
  tag: tagName,
  message: bounded(128_000),
  tagger: Tagger,
  targetOid: oid,
  targetType: Schema.Literal("commit"),
}) {}
export class RefFacts extends Schema.Class<RefFacts>("GitHubRefFacts")({
  ref: text,
  objectOid: oid,
  objectType: Schema.Literals(["commit", "tag"]),
}) {}
export class ReleaseFacts extends Schema.Class<ReleaseFacts>("GitHubReleaseFacts")({
  releaseId: nativeId,
  tag: tagName,
  title: bounded(1024),
  body: bounded(128_000),
  prerelease: Schema.Boolean,
  draft: Schema.Boolean,
  uploadUrlTemplate: text,
}) {}
export class AssetFacts extends Schema.Class<AssetFacts>("GitHubAssetFacts")({
  assetId: nativeId,
  storedName: text,
  state: Schema.Literals(["uploaded", "starter"]),
  contentType: text,
  bytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  sha256: Schema.NullOr(Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u))),
  apiUrl: text,
  downloadUrl: text,
}) {}
