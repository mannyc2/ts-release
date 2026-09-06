/** PROPOSED signatures only. Schema declarations are emitted using Effect
 * 4.0.0-rc.108; provider-api.md records donor coordinates and untested laws. */
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type * as Redacted from "effect/Redacted"
import type * as Scope from "effect/Scope"
import type { Operation, ProviderDefinition, PreparedRequest, RequestFacts, ReleaseError, SendResult, Transport } from "./kernel-api.js"
import { Content, OwnedFile as File, OwnedTree as Tree, OwnedBundle as Bundle } from "./adoption-api/adoption.js"
export { Content, File, Tree, Bundle }
export type Json = Schema.Json
export type OperationId = string
export type Headers = readonly (readonly [string, string])[]
export interface HttpReadRequest { readonly method: "GET" | "HEAD"; readonly url: string; readonly headers: Headers; readonly principal: string; readonly scope: string }
export interface HttpResponse { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly body: Uint8Array }
export type HttpRead = (request: HttpReadRequest) => Effect.Effect<HttpResponse, ReleaseError>
export type ReadContent = (content: Content) => Effect.Effect<Uint8Array, ReleaseError>
export type PutContent = (bytes: Uint8Array) => Effect.Effect<Content, ReleaseError>
export interface ArtifactAccess { readonly bundle: Bundle; readonly readContent: ReadContent }
export interface HttpProviderDefinition extends ProviderDefinition {
  /** Exactly one imported definition must recognize the complete scope,
   * endpoint and method before credentials or a native send are requested. */
  readonly ownsRequest: (request: RequestFacts) => boolean
  readonly decodeResponse: (request: PreparedRequest, response: HttpResponse) => Effect.Effect<SendResult, ReleaseError>
}
export type Author<A> = (input: A, dependsOn?: readonly OperationId[]) => Effect.Effect<Operation, ReleaseError>
export interface CredentialBinding { readonly endpoint: string; readonly principal: string; readonly scope: string }
/** Live-only secret headers. They never enter Intent, RequestFacts or journal. */
export type CredentialHeaders = Readonly<Record<string, string>>
export interface OidcTokenRequest {
  readonly issuer: "https://token.actions.githubusercontent.com"; readonly audience: string
  readonly repository: string; readonly workflow: string; readonly workflowRef: string
  readonly expectedClaims: Readonly<Record<string, string>>
}
export type OidcTokenSource = (request: OidcTokenRequest) => Effect.Effect<Redacted.Redacted<string>, ReleaseError>
/** Auth-only exchange: root owns HTTP mechanics, redaction and bounds;
 * each provider owns URL, body, expected status and secret response schema. */
export type CredentialExchange = (request: { readonly url: string; readonly headers: CredentialHeaders; readonly body: Uint8Array }) => Effect.Effect<HttpResponse, ReleaseError>
export interface TrustedPublisherHost { readonly oidc: OidcTokenSource; readonly exchange: CredentialExchange }

export namespace Npm {
  export class TokenAuthorization extends Schema.TaggedClass<TokenAuthorization>()("TokenAuthorization", { principal: Schema.String }) {}
  export class TrustedAuthorization extends Schema.TaggedClass<TrustedAuthorization>()("TrustedAuthorization", {
    principal: Schema.String, repository: Schema.String, workflow: Schema.String, workflowRef: Schema.String,
    issuer: Schema.Literal("https://token.actions.githubusercontent.com"), audience: Schema.Literal("npm:registry.npmjs.org")
  }) {}
  export const Authorization = Schema.Union([TokenAuthorization, TrustedAuthorization])
  export type Authorization = typeof Authorization.Type
  export class ProvenanceSource extends Schema.Class<ProvenanceSource>("Npm.ProvenanceSource")({
    format: Schema.Literal("npm-github-actions-provenance-source/v1"), serverUrl: Schema.Literal("https://github.com"),
    repository: Schema.String, workflow: Schema.String, workflowRef: Schema.String, sourceRef: Schema.String,
    sourceCommit: Schema.String, eventName: Schema.String, repositoryId: Schema.String, repositoryOwnerId: Schema.String,
    runnerEnvironment: Schema.String, runId: Schema.String, runAttempt: Schema.String, repositoryVisibility: Schema.Literal("public")
  }) {}
  export class NoProvenance extends Schema.TaggedClass<NoProvenance>()("NoProvenance", {}) {}
  export class GitHubActionsProvenance extends Schema.TaggedClass<GitHubActionsProvenance>()("GitHubActionsProvenance", {
    source: ProvenanceSource, bundle: File, mediaType: Schema.Literal("application/vnd.dev.sigstore.bundle.v0.3+json")
  }) {}
  export const Provenance = Schema.Union([NoProvenance, GitHubActionsProvenance])
  export type Provenance = typeof Provenance.Type
  export class PublishIntent extends Schema.Class<PublishIntent>("Npm.PublishIntent")({
    registry: Schema.Literal("https://registry.npmjs.org/"), name: Schema.String, version: Schema.String,
    tarball: File, initialTag: Schema.String, access: Schema.Literal("public"), authorization: Authorization, provenance: Provenance
  }) {}
  export class DistTagIntent extends Schema.Class<DistTagIntent>("Npm.DistTagIntent")({
    registry: Schema.Literal("https://registry.npmjs.org/"), name: Schema.String, version: Schema.String,
    tag: Schema.String, authorization: Authorization
  }) {}
  export class PrivatePackage extends Schema.TaggedClass<PrivatePackage>()("PrivatePackage", { name: Schema.String, version: Schema.String, tarball: File }) {}
  export class PublicPackage extends Schema.TaggedClass<PublicPackage>()("PublicPackage", { publication: PublishIntent }) {}
  export const PackageCandidate = Schema.Union([PrivatePackage, PublicPackage])
  export type PackageCandidate = typeof PackageCandidate.Type
  export declare const publish: Author<PublishIntent>
  export declare const distTag: Author<DistTagIntent>
  /** Private candidates remain caller planning inputs; their omission is a
   * derived authoring result, never a publication operation or peer journal. */
  export declare function author(input: { readonly packages: readonly PackageCandidate[]; readonly tagMoves: readonly DistTagIntent[] }): Effect.Effect<{ readonly operations: readonly Operation[]; readonly omittedPrivate: readonly PrivatePackage[] }, ReleaseError>
  export declare function definitions(dependencies: ArtifactAccess & { readonly read: HttpRead }): readonly HttpProviderDefinition[]
  export declare function authorizeToken(input: { readonly authorization: TokenAuthorization; readonly binding: CredentialBinding; readonly token: Redacted.Redacted<string> }): Effect.Effect<CredentialHeaders, ReleaseError>
  export declare function authorizeTrusted(input: { readonly authorization: TrustedAuthorization; readonly packageName: string; readonly binding: CredentialBinding }, host: TrustedPublisherHost): Effect.Effect<CredentialHeaders, ReleaseError>
  export interface AttestationRequest { readonly payloadType: "application/vnd.in-toto+json"; readonly payload: Uint8Array }
  export type Attest = (request: AttestationRequest) => Effect.Effect<{ readonly bundleBytes: Uint8Array }, ReleaseError>
  /** npm-owned sigstore@5.0.0 adapter. Acquires explicit sigstore-audience
   * identity; pins native signing/verification options and does not inherit
   * ambient CI token providers or default write retries. See provider-api.md. */
  export declare function makeSigstoreAttester(options: {
    readonly source: ProvenanceSource; readonly oidc: OidcTokenSource
    readonly fulcioUrl: "https://fulcio.sigstore.dev"; readonly rekorUrl: "https://rekor.sigstore.dev"
    readonly tufRootPath: string; readonly tufCachePath: string; readonly timeoutMilliseconds: number
  }): Attest
  /** Explicit authorized remote preparation, before freezing the publication
   * Bundle/Plan. The caller adopts returned bytes as the separate bundle File.
   * Attest owns Sigstore signing/trust; this helper owns exact npm SLSA payload
   * construction and structural/exact-payload validation, not signature trust. */
  export declare function createProvenance(input: { readonly authorize: true; readonly name: string; readonly version: string; readonly tarball: File; readonly source: ProvenanceSource }, dependencies: ArtifactAccess & { readonly attest: Attest }): Effect.Effect<{ readonly mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json"; readonly bytes: Uint8Array }, ReleaseError>
}

export namespace Warehouse {
  export class PyPi extends Schema.TaggedClass<PyPi>()("PyPi", { uploadUrl: Schema.Literal("https://upload.pypi.org/legacy/"), simpleUrl: Schema.Literal("https://pypi.org/simple/") }) {}
  export class TestPyPi extends Schema.TaggedClass<TestPyPi>()("TestPyPi", { uploadUrl: Schema.Literal("https://test.pypi.org/legacy/"), simpleUrl: Schema.Literal("https://test.pypi.org/simple/") }) {}
  export class Compatible extends Schema.TaggedClass<Compatible>()("Compatible", { implementation: Schema.Literals(["pypiserver", "devpi-server"]), version: Schema.String, uploadUrl: Schema.String, simpleUrl: Schema.String, duplicateLaw: Schema.Literal("not-inherited") }) {}
  export const Endpoint = Schema.Union([PyPi, TestPyPi, Compatible])
  export type Endpoint = typeof Endpoint.Type
  export class TokenAuthorization extends Schema.TaggedClass<TokenAuthorization>()("TokenAuthorization", { principal: Schema.String, username: Schema.String }) {}
  export class TrustedAuthorization extends Schema.TaggedClass<TrustedAuthorization>()("TrustedAuthorization", {
    principal: Schema.String, repository: Schema.String, workflow: Schema.String, workflowRef: Schema.String,
    issuer: Schema.Literal("https://token.actions.githubusercontent.com"), audience: Schema.Literals(["pypi", "testpypi"])
  }) {}
  export const Authorization = Schema.Union([TokenAuthorization, TrustedAuthorization])
  export type Authorization = typeof Authorization.Type
  const common = { endpoint: Endpoint, project: Schema.String, version: Schema.String, metadataVersion: Schema.String, distribution: File, filename: Schema.String, authorization: Authorization }
  export class WheelUpload extends Schema.TaggedClass<WheelUpload>()("WheelUpload", { ...common, pythonTag: Schema.String }) {}
  export class SdistUpload extends Schema.TaggedClass<SdistUpload>()("SdistUpload", { ...common, pythonTag: Schema.Literal("source") }) {}
  export const UploadIntent = Schema.Union([WheelUpload, SdistUpload])
  export type UploadIntent = typeof UploadIntent.Type
  /** Native metadata is read from the exact wheel/sdist, with coordinate and
   * metadata-version correspondence; arbitrary metadata side inputs are absent. */
  export declare const upload: Author<UploadIntent>
  export declare function definitions(dependencies: ArtifactAccess & { readonly read: HttpRead }): readonly HttpProviderDefinition[]
  export declare function authorizeToken(input: { readonly authorization: TokenAuthorization; readonly endpoint: Endpoint; readonly binding: CredentialBinding; readonly token: Redacted.Redacted<string> }): Effect.Effect<CredentialHeaders, ReleaseError>
  export declare function authorizeTrusted(input: { readonly authorization: TrustedAuthorization; readonly endpoint: PyPi | TestPyPi; readonly binding: CredentialBinding }, host: TrustedPublisherHost): Effect.Effect<CredentialHeaders, ReleaseError>
}

export namespace GitHub {
  export class Repository extends Schema.Class<Repository>("GitHub.Repository")({ apiUrl: Schema.Literal("https://api.github.com"), owner: Schema.String, name: Schema.String }) {}
  export class Tagger extends Schema.Class<Tagger>("GitHub.Tagger")({ name: Schema.String, email: Schema.String, date: Schema.String }) {}
  const target = { repository: Repository, tag: Schema.String, commit: Schema.String, principal: Schema.String }
  export class LightweightTag extends Schema.Class<LightweightTag>("GitHub.LightweightTag")({ ...target }) {}
  export class AnnotatedTag extends Schema.Class<AnnotatedTag>("GitHub.AnnotatedTag")({ ...target, message: Schema.String, tagger: Tagger }) {}
  export class AnnotatedRef extends Schema.Class<AnnotatedRef>("GitHub.AnnotatedRef")({ repository: Repository, tag: Schema.String, annotatedTagOperation: Schema.String, principal: Schema.String }) {}
  export class ManagedTag extends Schema.TaggedClass<ManagedTag>()("ManagedTag", { operationId: Schema.String }) {}
  export class ExistingTag extends Schema.TaggedClass<ExistingTag>()("ExistingTag", { commit: Schema.String }) {}
  export const TagSource = Schema.Union([ManagedTag, ExistingTag])
  export type TagSource = typeof TagSource.Type
  export class DraftIntent extends Schema.Class<DraftIntent>("GitHub.DraftIntent")({ repository: Repository, tag: Schema.String, tagSource: TagSource, title: Schema.String, body: Schema.String, prerelease: Schema.Boolean, principal: Schema.String }) {}
  export class AssetIntent extends Schema.Class<AssetIntent>("GitHub.AssetIntent")({ repository: Repository, draftOperation: Schema.String, file: File, publicName: Schema.String, mediaType: Schema.String, principal: Schema.String }) {}
  export class PublishIntent extends Schema.Class<PublishIntent>("GitHub.PublishIntent")({ repository: Repository, draftOperation: Schema.String, assetOperations: Schema.Array(Schema.String), principal: Schema.String }) {}
  export class AnnotatedTagFacts extends Schema.Class<AnnotatedTagFacts>("GitHub.AnnotatedTagFacts")({ objectOid: Schema.String, tag: Schema.String, message: Schema.String, tagger: Tagger, targetOid: Schema.String, targetType: Schema.Literal("commit") }) {}
  export class RefFacts extends Schema.Class<RefFacts>("GitHub.RefFacts")({ ref: Schema.String, objectOid: Schema.String, objectType: Schema.Literals(["commit", "tag"]) }) {}
  export class ReleaseFacts extends Schema.Class<ReleaseFacts>("GitHub.ReleaseFacts")({ releaseId: Schema.String, tag: Schema.String, draft: Schema.Boolean, uploadUrlTemplate: Schema.String }) {}
  export class AssetFacts extends Schema.Class<AssetFacts>("GitHub.AssetFacts")({ assetId: Schema.String, storedName: Schema.String, state: Schema.Literals(["uploaded", "starter"]), contentType: Schema.String, bytes: Schema.String, sha256: Schema.NullOr(Schema.String), apiUrl: Schema.String, downloadUrl: Schema.String }) {}
  export declare const lightweightTag: Author<LightweightTag>
  export declare const annotatedTag: Author<AnnotatedTag>
  /** Derives dependency on exactly the object-producing operation. */
  export declare const annotatedRef: Author<AnnotatedRef>
  export declare const draft: Author<DraftIntent>
  export declare const uploadAsset: Author<AssetIntent>
  export declare const publish: Author<PublishIntent>
  export declare function definitions(dependencies: ArtifactAccess & { readonly read: HttpRead }): readonly HttpProviderDefinition[]
  export declare function authorizeToken(input: { readonly repository: Repository; readonly binding: CredentialBinding; readonly token: Redacted.Redacted<string> }): Effect.Effect<CredentialHeaders, ReleaseError>
}

export namespace Homebrew {
  export class Download extends Schema.Class<Download>("Homebrew.Download")({ url: Schema.String, file: File }) {}
  export class Formula extends Schema.Class<Formula>("Homebrew.Formula")({
    className: Schema.String, description: Schema.String, homepage: Schema.String, license: Schema.String, version: Schema.String,
    executable: Schema.String, archives: Schema.Struct({ "darwin-x64": Download, "darwin-arm64": Download, "linux-x64": Download, "linux-arm64": Download })
  }) {}
  export declare function render(input: Formula, bundle: Bundle): Effect.Effect<Uint8Array, ReleaseError>
}
export namespace Scoop {
  export class Download extends Schema.Class<Download>("Scoop.Download")({ url: Schema.String, file: File }) {}
  export class Manifest extends Schema.Class<Manifest>("Scoop.Manifest")({ version: Schema.String, executable: Schema.String, archives: Schema.Struct({ "windows-x64": Download, "windows-arm64": Download }) }) {}
  export declare function render(input: Manifest, bundle: Bundle): Effect.Effect<Uint8Array, ReleaseError>
}

/** Root-owned conditional Git mechanism. Catalog providers only render bytes. */
export namespace GitCatalog {
  export class FileEdit extends Schema.Class<FileEdit>("GitCatalog.FileEdit")({ path: Schema.String, mode: Schema.Literals(["100644", "100755"]), content: Content }) {}
  export class Identity extends Schema.Class<Identity>("GitCatalog.Identity")({ name: Schema.String, email: Schema.String, timestamp: Schema.String, timezone: Schema.String }) {}
  export class CommitInput extends Schema.Class<CommitInput>("GitCatalog.CommitInput")({
    remote: Schema.String, ref: Schema.String, expectedOld: Schema.String, baseObjects: Content, files: Schema.Array(FileEdit), message: Schema.String,
    author: Identity, committer: Identity, principal: Schema.String, scope: Schema.String
  }) {}
  export class Intent extends Schema.Class<Intent>("GitCatalog.Intent")({
    remote: Schema.String, ref: Schema.String, expectedOld: Schema.String, desiredNew: Schema.String,
    objectFormat: Schema.Literals(["sha1", "sha256"]), objectSet: Content, files: Schema.Array(FileEdit), principal: Schema.String, scope: Schema.String
  }) {}
  export interface ObjectBuilder {
    /** Reuse retained core-git-object-set/v1 canonical JSON: type+base64 bytes,
     * not a newly invented native .pack format. Validate baseObjects against
     * expectedOld; create exactly one desired commit and changed tree/blobs. */
    readonly construct: (input: CommitInput, read: ReadContent) => Effect.Effect<{ readonly desiredNew: string; readonly objectFormat: "sha1" | "sha256"; readonly objectSetBytes: Uint8Array }, ReleaseError>
  }
  export type RefCoordinate = Pick<Intent, "remote" | "ref" | "principal" | "scope">
  export type ObserveRef = (input: RefCoordinate) => Effect.Effect<{ readonly oid: string | null }, ReleaseError>
  export declare function prepare(input: CommitInput, dependencies: { readonly objects: ObjectBuilder; readonly readContent: ReadContent; readonly putContent: PutContent }): Effect.Effect<Intent, ReleaseError>
  export declare const update: Author<Intent>
  export declare function definition(dependencies: { readonly readContent: ReadContent; readonly observeRef: ObserveRef }): ProviderDefinition
  export type Credentials = { readonly _tag: "Anonymous" } | { readonly _tag: "Bearer"; readonly token: Redacted.Redacted<string> } | { readonly _tag: "Basic"; readonly username: string; readonly password: Redacted.Redacted<string> }
  export interface NativeHost {
    readonly objects: ObjectBuilder
    readonly captureBase: (input: RefCoordinate & { readonly expectedOld: string }) => Effect.Effect<Uint8Array, ReleaseError>
    readonly observeRef: ObserveRef
    /** Captures exact durable inputs in the existing protected core authority
     * table. Request body remains empty. Each execute closure resolves owned
     * objectSet content, checks native graph/paths and the complete lease argv
     * in its private repository before the one conditional native push. */
    readonly transport: (intents: readonly [Intent, ...Intent[]], otherwise?: Transport) => Transport
  }
  export declare function nativeHost(options: { readonly gitExecutable: string; readonly temporaryRoot: string; readonly timeoutMilliseconds: number; readonly maximumOutputBytes: number; readonly readContent: ReadContent; readonly credentials: (input: RefCoordinate) => Effect.Effect<Credentials, ReleaseError> }): Effect.Effect<NativeHost, ReleaseError, Scope.Scope>
}

export namespace Mcp {
  export const schemaUrl = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json" as const
  const inputFields = { description: Schema.optionalKey(Schema.String), isRequired: Schema.optionalKey(Schema.Boolean), format: Schema.optionalKey(Schema.Literals(["string", "number", "boolean", "filepath"])), value: Schema.optionalKey(Schema.String), isSecret: Schema.optionalKey(Schema.Boolean), default: Schema.optionalKey(Schema.String), placeholder: Schema.optionalKey(Schema.String), choices: Schema.optionalKey(Schema.Array(Schema.String)) }
  export class Input extends Schema.Class<Input>("Mcp.Input")({ ...inputFields }) {}
  const variables = Schema.optionalKey(Schema.Record(Schema.String, Input))
  export class NamedInput extends Schema.Class<NamedInput>("Mcp.NamedInput")({ ...inputFields, name: Schema.String, variables }) {}
  export class PositionalArgument extends Schema.Class<PositionalArgument>("Mcp.PositionalArgument")({ ...inputFields, type: Schema.Literal("positional"), variables, valueHint: Schema.optionalKey(Schema.String), isRepeated: Schema.optionalKey(Schema.Boolean) }) {}
  export class NamedArgument extends Schema.Class<NamedArgument>("Mcp.NamedArgument")({ ...inputFields, type: Schema.Literal("named"), name: Schema.String, variables, isRepeated: Schema.optionalKey(Schema.Boolean) }) {}
  export const Argument = Schema.Union([PositionalArgument, NamedArgument])
  export type Argument = typeof Argument.Type
  export class Stdio extends Schema.Class<Stdio>("Mcp.Stdio")({ type: Schema.Literal("stdio") }) {}
  export class StreamableHttp extends Schema.Class<StreamableHttp>("Mcp.StreamableHttp")({ type: Schema.Literal("streamable-http"), url: Schema.String, headers: Schema.optionalKey(Schema.Array(NamedInput)) }) {}
  export class Sse extends Schema.Class<Sse>("Mcp.Sse")({ type: Schema.Literal("sse"), url: Schema.String, headers: Schema.optionalKey(Schema.Array(NamedInput)) }) {}
  export const Transport = Schema.Union([Stdio, StreamableHttp, Sse])
  export type Transport = typeof Transport.Type
  export class RemoteHttp extends Schema.Class<RemoteHttp>("Mcp.RemoteHttp")({ type: Schema.Literal("streamable-http"), url: Schema.String, headers: Schema.optionalKey(Schema.Array(NamedInput)), variables }) {}
  export class RemoteSse extends Schema.Class<RemoteSse>("Mcp.RemoteSse")({ type: Schema.Literal("sse"), url: Schema.String, headers: Schema.optionalKey(Schema.Array(NamedInput)), variables }) {}
  export const Remote = Schema.Union([RemoteHttp, RemoteSse])
  export type Remote = typeof Remote.Type
  const execution = { runtimeHint: Schema.optionalKey(Schema.String), transport: Transport, runtimeArguments: Schema.optionalKey(Schema.Array(Argument)), packageArguments: Schema.optionalKey(Schema.Array(Argument)), environmentVariables: Schema.optionalKey(Schema.Array(NamedInput)) }
  export class NpmPackage extends Schema.Class<NpmPackage>("Mcp.NpmPackage")({ registryType: Schema.Literal("npm"), registryBaseUrl: Schema.Literal("https://registry.npmjs.org"), identifier: Schema.String, version: Schema.String, ...execution }) {}
  export class PyPiPackage extends Schema.Class<PyPiPackage>("Mcp.PyPiPackage")({ registryType: Schema.Literal("pypi"), registryBaseUrl: Schema.Literal("https://pypi.org"), identifier: Schema.String, version: Schema.String, ...execution }) {}
  export class NugetPackage extends Schema.Class<NugetPackage>("Mcp.NugetPackage")({ registryType: Schema.Literal("nuget"), registryBaseUrl: Schema.Literal("https://api.nuget.org/v3/index.json"), identifier: Schema.String, version: Schema.String, ...execution }) {}
  export class OciPackage extends Schema.Class<OciPackage>("Mcp.OciPackage")({ registryType: Schema.Literal("oci"), identifier: Schema.String, ...execution }) {}
  export class McpbPackage extends Schema.Class<McpbPackage>("Mcp.McpbPackage")({ registryType: Schema.Literal("mcpb"), identifier: Schema.String, version: Schema.optionalKey(Schema.String), fileSha256: Schema.String, ...execution }) {}
  export const Package = Schema.Union([NpmPackage, PyPiPackage, NugetPackage, OciPackage, McpbPackage])
  export type Package = typeof Package.Type
  export class Repository extends Schema.Class<Repository>("Mcp.Repository")({ url: Schema.String, source: Schema.String, id: Schema.optionalKey(Schema.String), subfolder: Schema.optionalKey(Schema.String) }) {}
  export class Icon extends Schema.Class<Icon>("Mcp.Icon")({ src: Schema.String, mimeType: Schema.optionalKey(Schema.Literals(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"])), sizes: Schema.optionalKey(Schema.Array(Schema.String)), theme: Schema.optionalKey(Schema.Literals(["light", "dark"])) }) {}
  export class Manifest extends Schema.Class<Manifest>("Mcp.Manifest")({
    $schema: Schema.Literal(schemaUrl), name: Schema.String, description: Schema.String, version: Schema.String,
    title: Schema.optionalKey(Schema.String), repository: Schema.optionalKey(Repository), websiteUrl: Schema.optionalKey(Schema.String), icons: Schema.optionalKey(Schema.Array(Icon)),
    packages: Schema.optionalKey(Schema.NonEmptyArray(Package)), remotes: Schema.optionalKey(Schema.NonEmptyArray(Remote)),
    _meta: Schema.optionalKey(Schema.Struct({ "io.modelcontextprotocol.registry/publisher-provided": Schema.Record(Schema.String, Schema.Json) }))
  }) {}
  export class TokenAuthorization extends Schema.TaggedClass<TokenAuthorization>()("TokenAuthorization", { principal: Schema.String, namespace: Schema.String }) {}
  export class OidcAuthorization extends Schema.TaggedClass<OidcAuthorization>()("OidcAuthorization", { principal: Schema.String, issuer: Schema.Literal("https://token.actions.githubusercontent.com"), audience: Schema.String, repository: Schema.String, workflow: Schema.String, workflowRef: Schema.String }) {}
  export const Authorization = Schema.Union([TokenAuthorization, OidcAuthorization])
  export type Authorization = typeof Authorization.Type
  export class PublishIntent extends Schema.Class<PublishIntent>("Mcp.PublishIntent")({ registry: Schema.Literals(["https://registry.modelcontextprotocol.io", "https://staging.registry.modelcontextprotocol.io"]), manifest: Manifest, authorization: Authorization }) {}
  /** Performs all pinned schema + official registry cross-field restrictions;
   * declaration field types alone do not encode those refinements. */
  export declare function validate(input: unknown): Effect.Effect<Manifest, ReleaseError>
  export declare function render(input: Manifest): Effect.Effect<Uint8Array, ReleaseError>
  export declare const publish: Author<PublishIntent>
  export declare function definitions(dependencies: { readonly read: HttpRead }): readonly HttpProviderDefinition[]
  export declare function authorizeToken(input: { readonly authorization: TokenAuthorization; readonly binding: CredentialBinding; readonly token: Redacted.Redacted<string> }): Effect.Effect<CredentialHeaders, ReleaseError>
  export declare function authorizeOidc(input: { readonly authorization: OidcAuthorization; readonly binding: CredentialBinding }, host: TrustedPublisherHost): Effect.Effect<CredentialHeaders, ReleaseError>
}

export namespace OpenAi {
  export class SkillFile extends Schema.Class<SkillFile>("OpenAi.SkillFile")({ path: Schema.String, content: Content, mode: Schema.Literals([0o644, 0o755]) }) {}
  export class Skill extends Schema.Class<Skill>("OpenAi.Skill")({ name: Schema.String, description: Schema.String, instructions: Schema.String, files: Schema.Array(SkillFile) }) {}
  export class Manifest extends Schema.Class<Manifest>("OpenAi.Manifest")({ name: Schema.String, version: Schema.String, description: Schema.String, skills: Schema.Literal("./skills/") }) {}
  export class PluginInput extends Schema.Class<PluginInput>("OpenAi.PluginInput")({ manifest: Manifest, skill: Skill }) {}
  /** File plan is transient renderer output. Native tree materialization and
   * mode/path finalization remain effect-build + root adoption responsibilities. */
  export interface RenderedFile { readonly path: string; readonly bytes: Uint8Array; readonly mode: 0o644 | 0o755 }
  export declare function files(input: PluginInput, readContent: ReadContent): Effect.Effect<readonly RenderedFile[], ReleaseError>
  /** Verifies one actual owned Tree: exact manifest + one SKILL.md tree,
   * supporting files, absence of hooks/apps/MCP configuration and path escapes. */
  export declare function validatePackage(tree: Tree, readContent: ReadContent): Effect.Effect<Tree, ReleaseError>
  export class MarketplaceEntry extends Schema.Class<MarketplaceEntry>("OpenAi.MarketplaceEntry")({
    name: Schema.String, source: Schema.Struct({ source: Schema.Literal("local"), path: Schema.String }),
    policy: Schema.Struct({ installation: Schema.Literals(["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"]), authentication: Schema.Literals(["ON_INSTALL", "ON_FIRST_USE"]) }), category: Schema.String
  }) {}
  export class Marketplace extends Schema.Class<Marketplace>("OpenAi.Marketplace")({ name: Schema.String, interface: Schema.Struct({ displayName: Schema.String }), plugins: Schema.Array(MarketplaceEntry) }) {}
  export declare function marketplace(input: { readonly plugin: Tree; readonly existing: Marketplace | null; readonly marketplaceName: string; readonly displayName: string; readonly sourcePath: string; readonly category: string }, readContent: ReadContent): Effect.Effect<{ readonly path: ".agents/plugins/marketplace.json"; readonly document: Marketplace; readonly bytes: Uint8Array }, ReleaseError>
  export class Listing extends Schema.Class<Listing>("OpenAi.Listing")({ displayName: Schema.String, shortDescription: Schema.String, longDescription: Schema.String, developerName: Schema.String, category: Schema.String, websiteUrl: Schema.String, supportUrl: Schema.String, privacyPolicyUrl: Schema.String, termsOfServiceUrl: Schema.String, logo: File }) {}
  export class PositiveTest extends Schema.Class<PositiveTest>("OpenAi.PositiveTest")({ id: Schema.String, prompt: Schema.String, expectedBehavior: Schema.String, expectedResultShape: Schema.String, fixture: Schema.String }) {}
  export class NegativeTest extends Schema.Class<NegativeTest>("OpenAi.NegativeTest")({ id: Schema.String, prompt: Schema.String, expectedBehavior: Schema.String, reason: Schema.String }) {}
  export class Attestations extends Schema.Class<Attestations>("OpenAi.Attestations")({ developerIdentityVerified: Schema.Literal(true), intellectualPropertyRightsConfirmed: Schema.Literal(true), listingAndTestsAccurate: Schema.Literal(true), privacyAndTermsPublished: Schema.Literal(true), pluginPoliciesReviewed: Schema.Literal(true), humanPortalReviewAndPublicationRequired: Schema.Literal(true) }) {}
  export class Submission extends Schema.Class<Submission>("OpenAi.Submission")({
    plugin: Tree, marketplace: Marketplace, listing: Listing, starterPrompts: Schema.Array(Schema.String), positiveTests: Schema.Tuple([PositiveTest, PositiveTest, PositiveTest, PositiveTest, PositiveTest]), negativeTests: Schema.Tuple([NegativeTest, NegativeTest, NegativeTest]), releaseNotes: Schema.String, attestations: Attestations
  }) {}
  export declare function submission(input: Submission, access: ArtifactAccess): Effect.Effect<{ readonly status: "validated-handoff-human-submission-required"; readonly bytes: Uint8Array }, ReleaseError>
}
