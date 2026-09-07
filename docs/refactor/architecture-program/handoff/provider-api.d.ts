/** PROPOSED signatures only. Schema declarations are emitted using Effect
 * 4.0.0-rc.108; provider-api.md records donor coordinates and untested laws. */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type * as Redacted from "effect/Redacted";
import type * as Scope from "effect/Scope";
import type { Operation, ProviderDefinition, PreparedRequest, RequestFacts, ReleaseError, SendResult, Transport } from "./kernel-api.js";
import { Content, OwnedFile as File, OwnedTree as Tree, OwnedBundle as Bundle } from "./adoption-api/adoption.js";
export { Content, File, Tree, Bundle };
export type Json = Schema.Json;
export type OperationId = string;
export type Headers = readonly (readonly [string, string])[];
export interface HttpReadRequest {
    readonly method: "GET" | "HEAD";
    readonly url: string;
    readonly headers: Headers;
    readonly principal: string;
    readonly scope: string;
}
export interface HttpResponse {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: Uint8Array;
}
export type HttpRead = (request: HttpReadRequest) => Effect.Effect<HttpResponse, ReleaseError>;
export type ReadContent = (content: Content) => Effect.Effect<Uint8Array, ReleaseError>;
export type PutContent = (bytes: Uint8Array) => Effect.Effect<Content, ReleaseError>;
export interface ArtifactAccess {
    readonly bundle: Bundle;
    readonly readContent: ReadContent;
}
export interface HttpProviderDefinition extends ProviderDefinition {
    /** Exactly one imported definition must recognize the complete scope,
     * endpoint and method before credentials or a native send are requested. */
    readonly ownsRequest: (request: RequestFacts) => boolean;
    readonly decodeResponse: (request: PreparedRequest, response: HttpResponse) => Effect.Effect<SendResult, ReleaseError>;
}
export type Author<A> = (input: A, dependsOn?: readonly OperationId[]) => Effect.Effect<Operation, ReleaseError>;
export interface CredentialBinding {
    readonly endpoint: string;
    readonly principal: string;
    readonly scope: string;
}
/** Live-only secret headers. They never enter Intent, RequestFacts or journal. */
export type CredentialHeaders = Readonly<Record<string, string>>;
export interface OidcTokenRequest {
    readonly issuer: "https://token.actions.githubusercontent.com";
    readonly audience: string;
    readonly repository: string;
    readonly workflow: string;
    readonly workflowRef: string;
    readonly expectedClaims: Readonly<Record<string, string>>;
}
export type OidcTokenSource = (request: OidcTokenRequest) => Effect.Effect<Redacted.Redacted<string>, ReleaseError>;
/** Auth-only exchange: root owns HTTP mechanics, redaction and bounds;
 * each provider owns URL, body, expected status and secret response schema. */
export type CredentialExchange = (request: {
    readonly url: string;
    readonly headers: CredentialHeaders;
    readonly body: Uint8Array;
}) => Effect.Effect<HttpResponse, ReleaseError>;
export interface TrustedPublisherHost {
    readonly oidc: OidcTokenSource;
    readonly exchange: CredentialExchange;
}
/** Implemented npm API: emitted from actual production owners. */
export * as Npm from "./production-api/npm/index.js";
/** Implemented PyPI API: emitted from actual production owners. */
export * as Warehouse from "./production-api/pypi/index.js";
export declare namespace GitHub {
    const Repository_base: Schema.Class<Repository, Schema.Struct<{
        readonly apiUrl: Schema.Literal<"https://api.github.com">;
        readonly owner: Schema.String;
        readonly name: Schema.String;
    }>, {}>;
    export class Repository extends Repository_base {
    }
    const Tagger_base: Schema.Class<Tagger, Schema.Struct<{
        readonly name: Schema.String;
        readonly email: Schema.String;
        readonly date: Schema.String;
    }>, {}>;
    export class Tagger extends Tagger_base {
    }
    const LightweightTag_base: Schema.Class<LightweightTag, Schema.Struct<{
        readonly repository: typeof Repository;
        readonly tag: Schema.String;
        readonly commit: Schema.String;
        readonly principal: Schema.String;
    }>, {}>;
    export class LightweightTag extends LightweightTag_base {
    }
    const AnnotatedTag_base: Schema.Class<AnnotatedTag, Schema.Struct<{
        readonly message: Schema.String;
        readonly tagger: typeof Tagger;
        readonly repository: typeof Repository;
        readonly tag: Schema.String;
        readonly commit: Schema.String;
        readonly principal: Schema.String;
    }>, {}>;
    export class AnnotatedTag extends AnnotatedTag_base {
    }
    const AnnotatedRef_base: Schema.Class<AnnotatedRef, Schema.Struct<{
        readonly repository: typeof Repository;
        readonly tag: Schema.String;
        readonly annotatedTagOperation: Schema.String;
        readonly principal: Schema.String;
    }>, {}>;
    export class AnnotatedRef extends AnnotatedRef_base {
    }
    const ManagedTag_base: Schema.Class<ManagedTag, Schema.TaggedStruct<"ManagedTag", {
        readonly operationId: Schema.String;
    }>, {}>;
    export class ManagedTag extends ManagedTag_base {
    }
    const ExistingTag_base: Schema.Class<ExistingTag, Schema.TaggedStruct<"ExistingTag", {
        readonly commit: Schema.String;
    }>, {}>;
    export class ExistingTag extends ExistingTag_base {
    }
    export const TagSource: Schema.Union<readonly [typeof ManagedTag, typeof ExistingTag]>;
    export type TagSource = typeof TagSource.Type;
    const DraftIntent_base: Schema.Class<DraftIntent, Schema.Struct<{
        readonly repository: typeof Repository;
        readonly tag: Schema.String;
        readonly tagSource: Schema.Union<readonly [typeof ManagedTag, typeof ExistingTag]>;
        readonly title: Schema.String;
        readonly body: Schema.String;
        readonly prerelease: Schema.Boolean;
        readonly principal: Schema.String;
    }>, {}>;
    export class DraftIntent extends DraftIntent_base {
    }
    const AssetIntent_base: Schema.Class<AssetIntent, Schema.Struct<{
        readonly repository: typeof Repository;
        readonly draftOperation: Schema.String;
        readonly file: typeof File;
        readonly publicName: Schema.String;
        readonly mediaType: Schema.String;
        readonly principal: Schema.String;
    }>, {}>;
    export class AssetIntent extends AssetIntent_base {
    }
    const PublishIntent_base_1: Schema.Class<PublishIntent, Schema.Struct<{
        readonly repository: typeof Repository;
        readonly draftOperation: Schema.String;
        readonly assetOperations: Schema.$Array<Schema.String>;
        readonly principal: Schema.String;
    }>, {}>;
    export class PublishIntent extends PublishIntent_base_1 {
    }
    const AnnotatedTagFacts_base: Schema.Class<AnnotatedTagFacts, Schema.Struct<{
        readonly objectOid: Schema.String;
        readonly tag: Schema.String;
        readonly message: Schema.String;
        readonly tagger: typeof Tagger;
        readonly targetOid: Schema.String;
        readonly targetType: Schema.Literal<"commit">;
    }>, {}>;
    export class AnnotatedTagFacts extends AnnotatedTagFacts_base {
    }
    const RefFacts_base: Schema.Class<RefFacts, Schema.Struct<{
        readonly ref: Schema.String;
        readonly objectOid: Schema.String;
        readonly objectType: Schema.Literals<readonly ["commit", "tag"]>;
    }>, {}>;
    export class RefFacts extends RefFacts_base {
    }
    const ReleaseFacts_base: Schema.Class<ReleaseFacts, Schema.Struct<{
        readonly releaseId: Schema.String;
        readonly tag: Schema.String;
        readonly draft: Schema.Boolean;
        readonly uploadUrlTemplate: Schema.String;
    }>, {}>;
    export class ReleaseFacts extends ReleaseFacts_base {
    }
    const AssetFacts_base: Schema.Class<AssetFacts, Schema.Struct<{
        readonly assetId: Schema.String;
        readonly storedName: Schema.String;
        readonly state: Schema.Literals<readonly ["uploaded", "starter"]>;
        readonly contentType: Schema.String;
        readonly bytes: Schema.String;
        readonly sha256: Schema.NullOr<Schema.String>;
        readonly apiUrl: Schema.String;
        readonly downloadUrl: Schema.String;
    }>, {}>;
    export class AssetFacts extends AssetFacts_base {
    }
    export const lightweightTag: Author<LightweightTag>;
    export const annotatedTag: Author<AnnotatedTag>;
    /** Derives dependency on exactly the object-producing operation. */
    export const annotatedRef: Author<AnnotatedRef>;
    export const draft: Author<DraftIntent>;
    export const uploadAsset: Author<AssetIntent>;
    export const publish: Author<PublishIntent>;
    export function definitions(dependencies: ArtifactAccess & {
        readonly read: HttpRead;
    }): readonly HttpProviderDefinition[];
    export function authorizeToken(input: {
        readonly repository: Repository;
        readonly binding: CredentialBinding;
        readonly token: Redacted.Redacted<string>;
    }): Effect.Effect<CredentialHeaders, ReleaseError>;
    export {};
}
export declare namespace Homebrew {
    const Download_base: Schema.Class<Download, Schema.Struct<{
        readonly url: Schema.String;
        readonly file: typeof File;
    }>, {}>;
    export class Download extends Download_base {
    }
    const Formula_base: Schema.Class<Formula, Schema.Struct<{
        readonly className: Schema.String;
        readonly description: Schema.String;
        readonly homepage: Schema.String;
        readonly license: Schema.String;
        readonly version: Schema.String;
        readonly executable: Schema.String;
        readonly archives: Schema.Struct<{
            readonly "darwin-x64": typeof Download;
            readonly "darwin-arm64": typeof Download;
            readonly "linux-x64": typeof Download;
            readonly "linux-arm64": typeof Download;
        }>;
    }>, {}>;
    export class Formula extends Formula_base {
    }
    export function render(input: Formula, bundle: Bundle): Effect.Effect<Uint8Array, ReleaseError>;
    export {};
}
export declare namespace Scoop {
    const Download_base_1: Schema.Class<Download, Schema.Struct<{
        readonly url: Schema.String;
        readonly file: typeof File;
    }>, {}>;
    export class Download extends Download_base_1 {
    }
    const Manifest_base: Schema.Class<Manifest, Schema.Struct<{
        readonly version: Schema.String;
        readonly executable: Schema.String;
        readonly archives: Schema.Struct<{
            readonly "windows-x64": typeof Download;
            readonly "windows-arm64": typeof Download;
        }>;
    }>, {}>;
    export class Manifest extends Manifest_base {
    }
    export function render(input: Manifest, bundle: Bundle): Effect.Effect<Uint8Array, ReleaseError>;
    export {};
}
/** Root-owned conditional Git mechanism. Catalog providers only render bytes. */
export declare namespace GitCatalog {
    const FileEdit_base: Schema.Class<FileEdit, Schema.Struct<{
        readonly path: Schema.String;
        readonly mode: Schema.Literals<readonly ["100644", "100755"]>;
        readonly content: typeof Content;
    }>, {}>;
    export class FileEdit extends FileEdit_base {
    }
    const Identity_base: Schema.Class<Identity, Schema.Struct<{
        readonly name: Schema.String;
        readonly email: Schema.String;
        readonly timestamp: Schema.String;
        readonly timezone: Schema.String;
    }>, {}>;
    export class Identity extends Identity_base {
    }
    const CommitInput_base: Schema.Class<CommitInput, Schema.Struct<{
        readonly remote: Schema.String;
        readonly ref: Schema.String;
        readonly expectedOld: Schema.String;
        readonly baseObjects: typeof Content;
        readonly files: Schema.$Array<typeof FileEdit>;
        readonly message: Schema.String;
        readonly author: typeof Identity;
        readonly committer: typeof Identity;
        readonly principal: Schema.String;
        readonly scope: Schema.String;
    }>, {}>;
    export class CommitInput extends CommitInput_base {
    }
    const Intent_base: Schema.Class<Intent, Schema.Struct<{
        readonly remote: Schema.String;
        readonly ref: Schema.String;
        readonly expectedOld: Schema.String;
        readonly desiredNew: Schema.String;
        readonly objectFormat: Schema.Literals<readonly ["sha1", "sha256"]>;
        readonly objectSet: typeof Content;
        readonly files: Schema.$Array<typeof FileEdit>;
        readonly principal: Schema.String;
        readonly scope: Schema.String;
    }>, {}>;
    export class Intent extends Intent_base {
    }
    export interface ObjectBuilder {
        /** Reuse retained core-git-object-set/v1 canonical JSON: type+base64 bytes,
         * not a newly invented native .pack format. Validate baseObjects against
         * expectedOld; create exactly one desired commit and changed tree/blobs. */
        readonly construct: (input: CommitInput, read: ReadContent) => Effect.Effect<{
            readonly desiredNew: string;
            readonly objectFormat: "sha1" | "sha256";
            readonly objectSetBytes: Uint8Array;
        }, ReleaseError>;
    }
    export type RefCoordinate = Pick<Intent, "remote" | "ref" | "principal" | "scope">;
    export type ObserveRef = (input: RefCoordinate) => Effect.Effect<{
        readonly oid: string | null;
    }, ReleaseError>;
    export function prepare(input: CommitInput, dependencies: {
        readonly objects: ObjectBuilder;
        readonly readContent: ReadContent;
        readonly putContent: PutContent;
    }): Effect.Effect<Intent, ReleaseError>;
    export const update: Author<Intent>;
    export function definition(dependencies: {
        readonly readContent: ReadContent;
        readonly observeRef: ObserveRef;
    }): ProviderDefinition;
    export type Credentials = {
        readonly _tag: "Anonymous";
    } | {
        readonly _tag: "Bearer";
        readonly token: Redacted.Redacted<string>;
    } | {
        readonly _tag: "Basic";
        readonly username: string;
        readonly password: Redacted.Redacted<string>;
    };
    export interface NativeHost {
        readonly objects: ObjectBuilder;
        readonly captureBase: (input: RefCoordinate & {
            readonly expectedOld: string;
        }) => Effect.Effect<Uint8Array, ReleaseError>;
        readonly observeRef: ObserveRef;
        /** Captures exact durable inputs in the existing protected core authority
         * table. Request body remains empty. Each execute closure resolves owned
         * objectSet content, checks native graph/paths and the complete lease argv
         * in its private repository before the one conditional native push. */
        readonly transport: (intents: readonly [Intent, ...Intent[]], otherwise?: Transport) => Transport;
    }
    export function nativeHost(options: {
        readonly gitExecutable: string;
        readonly temporaryRoot: string;
        readonly timeoutMilliseconds: number;
        readonly maximumOutputBytes: number;
        readonly readContent: ReadContent;
        readonly credentials: (input: RefCoordinate) => Effect.Effect<Credentials, ReleaseError>;
    }): Effect.Effect<NativeHost, ReleaseError, Scope.Scope>;
    export {};
}
export declare namespace Mcp {
    export const schemaUrl: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
    const Input_base: Schema.Class<Input, Schema.Struct<{
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, {}>;
    export class Input extends Input_base {
    }
    const NamedInput_base: Schema.Class<NamedInput, Schema.Struct<{
        readonly name: Schema.String;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, {}>;
    export class NamedInput extends NamedInput_base {
    }
    const PositionalArgument_base: Schema.Class<PositionalArgument, Schema.Struct<{
        readonly type: Schema.Literal<"positional">;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly valueHint: Schema.optionalKey<Schema.String>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, {}>;
    export class PositionalArgument extends PositionalArgument_base {
    }
    const NamedArgument_base: Schema.Class<NamedArgument, Schema.Struct<{
        readonly type: Schema.Literal<"named">;
        readonly name: Schema.String;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
        readonly isRepeated: Schema.optionalKey<Schema.Boolean>;
        readonly description: Schema.optionalKey<Schema.String>;
        readonly isRequired: Schema.optionalKey<Schema.Boolean>;
        readonly format: Schema.optionalKey<Schema.Literals<readonly ["string", "number", "boolean", "filepath"]>>;
        readonly value: Schema.optionalKey<Schema.String>;
        readonly isSecret: Schema.optionalKey<Schema.Boolean>;
        readonly default: Schema.optionalKey<Schema.String>;
        readonly placeholder: Schema.optionalKey<Schema.String>;
        readonly choices: Schema.optionalKey<Schema.$Array<Schema.String>>;
    }>, {}>;
    export class NamedArgument extends NamedArgument_base {
    }
    export const Argument: Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>;
    export type Argument = typeof Argument.Type;
    const Stdio_base: Schema.Class<Stdio, Schema.Struct<{
        readonly type: Schema.Literal<"stdio">;
    }>, {}>;
    export class Stdio extends Stdio_base {
    }
    const StreamableHttp_base: Schema.Class<StreamableHttp, Schema.Struct<{
        readonly type: Schema.Literal<"streamable-http">;
        readonly url: Schema.String;
        readonly headers: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    }>, {}>;
    export class StreamableHttp extends StreamableHttp_base {
    }
    const Sse_base: Schema.Class<Sse, Schema.Struct<{
        readonly type: Schema.Literal<"sse">;
        readonly url: Schema.String;
        readonly headers: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
    }>, {}>;
    export class Sse extends Sse_base {
    }
    export const Transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
    export type Transport = typeof Transport.Type;
    const RemoteHttp_base: Schema.Class<RemoteHttp, Schema.Struct<{
        readonly type: Schema.Literal<"streamable-http">;
        readonly url: Schema.String;
        readonly headers: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
    }>, {}>;
    export class RemoteHttp extends RemoteHttp_base {
    }
    const RemoteSse_base: Schema.Class<RemoteSse, Schema.Struct<{
        readonly type: Schema.Literal<"sse">;
        readonly url: Schema.String;
        readonly headers: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
        readonly variables: Schema.optionalKey<Schema.$Record<Schema.String, typeof Input>>;
    }>, {}>;
    export class RemoteSse extends RemoteSse_base {
    }
    export const Remote: Schema.Union<readonly [typeof RemoteHttp, typeof RemoteSse]>;
    export type Remote = typeof Remote.Type;
    const NpmPackage_base: Schema.Class<NpmPackage, Schema.Struct<{
        readonly runtimeHint: Schema.optionalKey<Schema.String>;
        readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
        readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
        readonly registryType: Schema.Literal<"npm">;
        readonly registryBaseUrl: Schema.Literal<"https://registry.npmjs.org">;
        readonly identifier: Schema.String;
        readonly version: Schema.String;
    }>, {}>;
    export class NpmPackage extends NpmPackage_base {
    }
    const PyPiPackage_base: Schema.Class<PyPiPackage, Schema.Struct<{
        readonly runtimeHint: Schema.optionalKey<Schema.String>;
        readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
        readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
        readonly registryType: Schema.Literal<"pypi">;
        readonly registryBaseUrl: Schema.Literal<"https://pypi.org">;
        readonly identifier: Schema.String;
        readonly version: Schema.String;
    }>, {}>;
    export class PyPiPackage extends PyPiPackage_base {
    }
    const NugetPackage_base: Schema.Class<NugetPackage, Schema.Struct<{
        readonly runtimeHint: Schema.optionalKey<Schema.String>;
        readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
        readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
        readonly registryType: Schema.Literal<"nuget">;
        readonly registryBaseUrl: Schema.Literal<"https://api.nuget.org/v3/index.json">;
        readonly identifier: Schema.String;
        readonly version: Schema.String;
    }>, {}>;
    export class NugetPackage extends NugetPackage_base {
    }
    const OciPackage_base: Schema.Class<OciPackage, Schema.Struct<{
        readonly runtimeHint: Schema.optionalKey<Schema.String>;
        readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
        readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
        readonly registryType: Schema.Literal<"oci">;
        readonly identifier: Schema.String;
    }>, {}>;
    export class OciPackage extends OciPackage_base {
    }
    const McpbPackage_base: Schema.Class<McpbPackage, Schema.Struct<{
        readonly runtimeHint: Schema.optionalKey<Schema.String>;
        readonly transport: Schema.Union<readonly [typeof Stdio, typeof StreamableHttp, typeof Sse]>;
        readonly runtimeArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly packageArguments: Schema.optionalKey<Schema.$Array<Schema.Union<readonly [typeof PositionalArgument, typeof NamedArgument]>>>;
        readonly environmentVariables: Schema.optionalKey<Schema.$Array<typeof NamedInput>>;
        readonly registryType: Schema.Literal<"mcpb">;
        readonly identifier: Schema.String;
        readonly version: Schema.optionalKey<Schema.String>;
        readonly fileSha256: Schema.String;
    }>, {}>;
    export class McpbPackage extends McpbPackage_base {
    }
    export const Package: Schema.Union<readonly [typeof NpmPackage, typeof PyPiPackage, typeof NugetPackage, typeof OciPackage, typeof McpbPackage]>;
    export type Package = typeof Package.Type;
    const Repository_base_1: Schema.Class<Repository, Schema.Struct<{
        readonly url: Schema.String;
        readonly source: Schema.String;
        readonly id: Schema.optionalKey<Schema.String>;
        readonly subfolder: Schema.optionalKey<Schema.String>;
    }>, {}>;
    export class Repository extends Repository_base_1 {
    }
    const Icon_base: Schema.Class<Icon, Schema.Struct<{
        readonly src: Schema.String;
        readonly mimeType: Schema.optionalKey<Schema.Literals<readonly ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]>>;
        readonly sizes: Schema.optionalKey<Schema.$Array<Schema.String>>;
        readonly theme: Schema.optionalKey<Schema.Literals<readonly ["light", "dark"]>>;
    }>, {}>;
    export class Icon extends Icon_base {
    }
    const Manifest_base_1: Schema.Class<Manifest, Schema.Struct<{
        readonly $schema: Schema.Literal<"https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json">;
        readonly name: Schema.String;
        readonly description: Schema.String;
        readonly version: Schema.String;
        readonly title: Schema.optionalKey<Schema.String>;
        readonly repository: Schema.optionalKey<typeof Repository>;
        readonly websiteUrl: Schema.optionalKey<Schema.String>;
        readonly icons: Schema.optionalKey<Schema.$Array<typeof Icon>>;
        readonly packages: Schema.optionalKey<Schema.NonEmptyArray<Schema.Union<readonly [typeof NpmPackage, typeof PyPiPackage, typeof NugetPackage, typeof OciPackage, typeof McpbPackage]>>>;
        readonly remotes: Schema.optionalKey<Schema.NonEmptyArray<Schema.Union<readonly [typeof RemoteHttp, typeof RemoteSse]>>>;
        readonly _meta: Schema.optionalKey<Schema.Struct<{
            readonly "io.modelcontextprotocol.registry/publisher-provided": Schema.$Record<Schema.String, Schema.Codec<Schema.Json, Schema.Json, never, never>>;
        }>>;
    }>, {}>;
    export class Manifest extends Manifest_base_1 {
    }
    const TokenAuthorization_base_2: Schema.Class<TokenAuthorization, Schema.TaggedStruct<"TokenAuthorization", {
        readonly principal: Schema.String;
        readonly namespace: Schema.String;
    }>, {}>;
    export class TokenAuthorization extends TokenAuthorization_base_2 {
    }
    const OidcAuthorization_base: Schema.Class<OidcAuthorization, Schema.TaggedStruct<"OidcAuthorization", {
        readonly principal: Schema.String;
        readonly issuer: Schema.Literal<"https://token.actions.githubusercontent.com">;
        readonly audience: Schema.String;
        readonly repository: Schema.String;
        readonly workflow: Schema.String;
        readonly workflowRef: Schema.String;
    }>, {}>;
    export class OidcAuthorization extends OidcAuthorization_base {
    }
    export const Authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof OidcAuthorization]>;
    export type Authorization = typeof Authorization.Type;
    const PublishIntent_base_2: Schema.Class<PublishIntent, Schema.Struct<{
        readonly registry: Schema.Literals<readonly ["https://registry.modelcontextprotocol.io", "https://staging.registry.modelcontextprotocol.io"]>;
        readonly manifest: typeof Manifest;
        readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof OidcAuthorization]>;
    }>, {}>;
    export class PublishIntent extends PublishIntent_base_2 {
    }
    /** Performs all pinned schema + official registry cross-field restrictions;
     * declaration field types alone do not encode those refinements. */
    export function validate(input: unknown): Effect.Effect<Manifest, ReleaseError>;
    export function render(input: Manifest): Effect.Effect<Uint8Array, ReleaseError>;
    export const publish: Author<PublishIntent>;
    export function definitions(dependencies: {
        readonly read: HttpRead;
    }): readonly HttpProviderDefinition[];
    export function authorizeToken(input: {
        readonly authorization: TokenAuthorization;
        readonly binding: CredentialBinding;
        readonly token: Redacted.Redacted<string>;
    }): Effect.Effect<CredentialHeaders, ReleaseError>;
    export function authorizeOidc(input: {
        readonly authorization: OidcAuthorization;
        readonly binding: CredentialBinding;
    }, host: TrustedPublisherHost): Effect.Effect<CredentialHeaders, ReleaseError>;
    export {};
}
export declare namespace OpenAi {
    const SkillFile_base: Schema.Class<SkillFile, Schema.Struct<{
        readonly path: Schema.String;
        readonly content: typeof Content;
        readonly mode: Schema.Literals<readonly [420, 493]>;
    }>, {}>;
    export class SkillFile extends SkillFile_base {
    }
    const Skill_base: Schema.Class<Skill, Schema.Struct<{
        readonly name: Schema.String;
        readonly description: Schema.String;
        readonly instructions: Schema.String;
        readonly files: Schema.$Array<typeof SkillFile>;
    }>, {}>;
    export class Skill extends Skill_base {
    }
    const Manifest_base_2: Schema.Class<Manifest, Schema.Struct<{
        readonly name: Schema.String;
        readonly version: Schema.String;
        readonly description: Schema.String;
        readonly skills: Schema.Literal<"./skills/">;
    }>, {}>;
    export class Manifest extends Manifest_base_2 {
    }
    const PluginInput_base: Schema.Class<PluginInput, Schema.Struct<{
        readonly manifest: typeof Manifest;
        readonly skill: typeof Skill;
    }>, {}>;
    export class PluginInput extends PluginInput_base {
    }
    /** File plan is transient renderer output. Native tree materialization and
     * mode/path finalization remain effect-build + root adoption responsibilities. */
    export interface RenderedFile {
        readonly path: string;
        readonly bytes: Uint8Array;
        readonly mode: 0o644 | 0o755;
    }
    export function files(input: PluginInput, readContent: ReadContent): Effect.Effect<readonly RenderedFile[], ReleaseError>;
    /** Verifies one actual owned Tree: exact manifest + one SKILL.md tree,
     * supporting files, absence of hooks/apps/MCP configuration and path escapes. */
    export function validatePackage(tree: Tree, readContent: ReadContent): Effect.Effect<Tree, ReleaseError>;
    const MarketplaceEntry_base: Schema.Class<MarketplaceEntry, Schema.Struct<{
        readonly name: Schema.String;
        readonly source: Schema.Struct<{
            readonly source: Schema.Literal<"local">;
            readonly path: Schema.String;
        }>;
        readonly policy: Schema.Struct<{
            readonly installation: Schema.Literals<readonly ["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"]>;
            readonly authentication: Schema.Literals<readonly ["ON_INSTALL", "ON_FIRST_USE"]>;
        }>;
        readonly category: Schema.String;
    }>, {}>;
    export class MarketplaceEntry extends MarketplaceEntry_base {
    }
    const Marketplace_base: Schema.Class<Marketplace, Schema.Struct<{
        readonly name: Schema.String;
        readonly interface: Schema.Struct<{
            readonly displayName: Schema.String;
        }>;
        readonly plugins: Schema.$Array<typeof MarketplaceEntry>;
    }>, {}>;
    export class Marketplace extends Marketplace_base {
    }
    export function marketplace(input: {
        readonly plugin: Tree;
        readonly existing: Marketplace | null;
        readonly marketplaceName: string;
        readonly displayName: string;
        readonly sourcePath: string;
        readonly category: string;
    }, readContent: ReadContent): Effect.Effect<{
        readonly path: ".agents/plugins/marketplace.json";
        readonly document: Marketplace;
        readonly bytes: Uint8Array;
    }, ReleaseError>;
    const Listing_base: Schema.Class<Listing, Schema.Struct<{
        readonly displayName: Schema.String;
        readonly shortDescription: Schema.String;
        readonly longDescription: Schema.String;
        readonly developerName: Schema.String;
        readonly category: Schema.String;
        readonly websiteUrl: Schema.String;
        readonly supportUrl: Schema.String;
        readonly privacyPolicyUrl: Schema.String;
        readonly termsOfServiceUrl: Schema.String;
        readonly logo: typeof File;
    }>, {}>;
    export class Listing extends Listing_base {
    }
    const PositiveTest_base: Schema.Class<PositiveTest, Schema.Struct<{
        readonly id: Schema.String;
        readonly prompt: Schema.String;
        readonly expectedBehavior: Schema.String;
        readonly expectedResultShape: Schema.String;
        readonly fixture: Schema.String;
    }>, {}>;
    export class PositiveTest extends PositiveTest_base {
    }
    const NegativeTest_base: Schema.Class<NegativeTest, Schema.Struct<{
        readonly id: Schema.String;
        readonly prompt: Schema.String;
        readonly expectedBehavior: Schema.String;
        readonly reason: Schema.String;
    }>, {}>;
    export class NegativeTest extends NegativeTest_base {
    }
    const Attestations_base: Schema.Class<Attestations, Schema.Struct<{
        readonly developerIdentityVerified: Schema.Literal<true>;
        readonly intellectualPropertyRightsConfirmed: Schema.Literal<true>;
        readonly listingAndTestsAccurate: Schema.Literal<true>;
        readonly privacyAndTermsPublished: Schema.Literal<true>;
        readonly pluginPoliciesReviewed: Schema.Literal<true>;
        readonly humanPortalReviewAndPublicationRequired: Schema.Literal<true>;
    }>, {}>;
    export class Attestations extends Attestations_base {
    }
    const Submission_base: Schema.Class<Submission, Schema.Struct<{
        readonly plugin: typeof Tree;
        readonly marketplace: typeof Marketplace;
        readonly listing: typeof Listing;
        readonly starterPrompts: Schema.$Array<Schema.String>;
        readonly positiveTests: Schema.Tuple<readonly [typeof PositiveTest, typeof PositiveTest, typeof PositiveTest, typeof PositiveTest, typeof PositiveTest]>;
        readonly negativeTests: Schema.Tuple<readonly [typeof NegativeTest, typeof NegativeTest, typeof NegativeTest]>;
        readonly releaseNotes: Schema.String;
        readonly attestations: typeof Attestations;
    }>, {}>;
    export class Submission extends Submission_base {
    }
    export function submission(input: Submission, access: ArtifactAccess): Effect.Effect<{
        readonly status: "validated-handoff-human-submission-required";
        readonly bytes: Uint8Array;
    }, ReleaseError>;
    export {};
}
