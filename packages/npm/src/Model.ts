import * as Schema from "effect/Schema"
import type * as Effect from "effect/Effect"
import { File } from "@mannyc1/ts-release/bundle"
import { isSafePath, PublicText } from "@mannyc1/ts-release/http"
import type { ReleaseError } from "@mannyc1/ts-release"
import * as Semver from "semver"

const text = PublicText(Number.MAX_SAFE_INTEGER)
export const name = text.check(
  Schema.makeFilter(
    (s) => s.length <= 214 && /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u.test(s),
  ),
)
export const version = text.check(Schema.makeFilter((s) => Semver.valid(s) === s))
export const integrity = Schema.String.check(
  Schema.makeFilter((value) => {
    if (!value.startsWith("sha512-")) return false
    const bytes = Buffer.from(value.slice(7), "base64")
    return bytes.length === 64 && `sha512-${bytes.toString("base64")}` === value
  }),
)
export const shasum = Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/u))
export const tag = text.check(
  Schema.makeFilter((s) => encodeURIComponent(s) === s && Semver.validRange(s) === null),
)
export const repository = text.check(
  Schema.makeFilter((s) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(s)),
)
export const workflow = text.check(Schema.makeFilter(isSafePath))
export const ref = text.check(
  Schema.makeFilter(
    (s) => /^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]+$/u.test(s) && !s.includes(".."),
  ),
)
export const principal = text.check(Schema.isMaxLength(512))
const decimal = text.check(Schema.makeFilter((s) => /^[1-9][0-9]*$/u.test(s)))

export class TokenAuthorization extends Schema.TaggedClass<TokenAuthorization>()(
  "TokenAuthorization",
  { principal },
) {}
export class TrustedAuthorization extends Schema.TaggedClass<TrustedAuthorization>()(
  "TrustedAuthorization",
  {
    principal,
    repository,
    workflow,
    workflowRef: ref,
    issuer: Schema.Literal("https://token.actions.githubusercontent.com"),
    audience: Schema.Literal("npm:registry.npmjs.org"),
  },
) {}
export const Authorization = Schema.Union([TokenAuthorization, TrustedAuthorization])
export type Authorization = typeof Authorization.Type
export class ProvenanceSource extends Schema.Class<ProvenanceSource>("NpmProvenanceSource")({
  format: Schema.Literal("npm-github-actions-provenance-source/v1"),
  serverUrl: Schema.Literal("https://github.com"),
  repository,
  workflow,
  workflowRef: ref,
  sourceRef: text.check(
    Schema.makeFilter((s) => /^refs\/[A-Za-z0-9._/-]+$/u.test(s) && !s.includes("..")),
  ),
  sourceCommit: text.check(Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u)),
  eventName: text,
  repositoryId: text.check(Schema.isPattern(/^(?:0|[1-9][0-9]*)$/u)),
  repositoryOwnerId: text.check(Schema.isPattern(/^(?:0|[1-9][0-9]*)$/u)),
  runnerEnvironment: text,
  runId: text.check(Schema.isPattern(/^(?:0|[1-9][0-9]*)$/u)),
  runAttempt: decimal,
  repositoryVisibility: Schema.Literal("public"),
}) {}
export class NoProvenance extends Schema.TaggedClass<NoProvenance>()("NoProvenance", {}) {}
export class GitHubActionsProvenance extends Schema.TaggedClass<GitHubActionsProvenance>()(
  "GitHubActionsProvenance",
  {
    source: ProvenanceSource,
    bundle: File,
    mediaType: Schema.Literal("application/vnd.dev.sigstore.bundle.v0.3+json"),
  },
) {}
export const Provenance = Schema.Union([NoProvenance, GitHubActionsProvenance])
export type Provenance = typeof Provenance.Type
export const registry = Schema.Literal("https://registry.npmjs.org/")
export class PublishIntent extends Schema.Class<PublishIntent>("NpmPublishIntent")({
  registry,
  name,
  version,
  tarball: File,
  integrity,
  shasum,
  initialTag: tag,
  access: Schema.Literal("public"),
  authorization: Authorization,
  provenance: Provenance,
}) {}
export class DistTagIntent extends Schema.Class<DistTagIntent>("NpmDistTagIntent")({
  registry,
  name,
  version,
  tag,
  authorization: Authorization,
}) {}
export class PrivatePackage extends Schema.TaggedClass<PrivatePackage>()("PrivatePackage", {
  name,
  version,
  tarball: File,
}) {}
export class PublicPackage extends Schema.TaggedClass<PublicPackage>()("PublicPackage", {
  publication: PublishIntent,
}) {}
export const PackageCandidate = Schema.Union([PrivatePackage, PublicPackage])
export type PackageCandidate = typeof PackageCandidate.Type
export interface AttestationRequest {
  readonly payloadType: "application/vnd.in-toto+json"
  readonly payload: Uint8Array
}
export type Attest = (
  request: AttestationRequest,
) => Effect.Effect<{ readonly bundleBytes: Uint8Array }, ReleaseError>
export type VerifyProvenance = (input: {
  readonly source: ProvenanceSource
  readonly bundleBytes: Uint8Array
}) => Effect.Effect<void, ReleaseError>
export class PackageMetadata extends Schema.Class<PackageMetadata>("NpmPackageMetadata")({
  name,
  version,
  private: Schema.Boolean,
  integrity,
  shasum,
}) {}

export const publishCodec = PublishIntent.check(
  Schema.makeFilter((intent) => {
    if (Semver.prerelease(intent.version) && intent.initialTag === "latest") return false
    const trusted = intent.authorization._tag === "TrustedAuthorization"
    if (trusted && intent.provenance._tag !== "GitHubActionsProvenance") return false
    if (intent.provenance._tag === "GitHubActionsProvenance") {
      if (intent.tarball.logicalName === intent.provenance.bundle.logicalName) return false
      if (trusted && intent.authorization._tag === "TrustedAuthorization") {
        const { source } = intent.provenance
        if (
          source.repository !== intent.authorization.repository ||
          source.workflow !== intent.authorization.workflow ||
          source.workflowRef !== intent.authorization.workflowRef
        )
          return false
      }
    }
    return true
  }),
)
