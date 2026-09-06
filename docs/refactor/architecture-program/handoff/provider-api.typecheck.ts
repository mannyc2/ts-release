/** Compile-only contract witness. These proposed exports have no runtime implementation. */
import type * as Effect from "effect/Effect"
import type * as Schema from "effect/Schema"
import type { ProviderDefinition, Operation, ReleaseError, Transport } from "./kernel-api.js"
import { Npm, Warehouse, GitHub, GitCatalog, Mcp, OpenAi, type ArtifactAccess, type File, type Tree, type HttpRead } from "./provider-api.js"
import type { ApplePreparation, ReadyToPlan } from "./adoption-api/apple-preparation.js"
declare const access: ArtifactAccess
declare const read: HttpRead
declare const file: File
declare const tree: Tree
declare const preparation: ApplePreparation
declare const ready: ReadyToPlan
const authority = new Npm.TokenAuthorization({ principal: "npm-publication" })
const publication = new Npm.PublishIntent({ registry: "https://registry.npmjs.org/", name: "@fixture/package", version: "1.0.0", tarball: file, initialTag: "next", access: "public", authorization: authority, provenance: new Npm.NoProvenance({}) })
const operation: Effect.Effect<Operation, ReleaseError> = Npm.publish(publication)
const provider: ProviderDefinition = Npm.definitions({ ...access, read })[0]!
const codec: Schema.Codec<unknown, unknown> = Npm.PublishIntent
const mcpCodecs: readonly Schema.Codec<unknown, unknown>[] = [Mcp.NpmPackage, Mcp.PyPiPackage, Mcp.OciPackage, Mcp.NugetPackage, Mcp.McpbPackage, Mcp.Stdio, Mcp.StreamableHttp, Mcp.Sse]
const warehouseCodec: Schema.Codec<unknown, unknown> = Warehouse.UploadIntent
const nativeId: string = new GitHub.ReleaseFacts({ releaseId: "9007199254740993", tag: "v1", draft: true, uploadUrlTemplate: "https://uploads.github.com/repos/fixture/repo/releases/1/assets{?name,label}" }).releaseId
const plugin: Parameters<typeof OpenAi.validatePackage>[0] = tree
const sourceTree: Tree = preparation.source
const readyContent: Parameters<typeof access.readContent>[0] = ready.bundleContent
declare const gitHost: GitCatalog.NativeHost
declare const gitIntent: GitCatalog.Intent
const transport: Transport = gitHost.transport([gitIntent])
// @ts-expect-error A file upload cannot stand in for an installable plugin tree.
const wrongPlugin: Parameters<typeof OpenAi.validatePackage>[0] = file
// @ts-expect-error npm selected scope is public npmjs publication.
const wrongAccess: ConstructorParameters<typeof Npm.PublishIntent>[0]["access"] = "restricted"
// @ts-expect-error Explicitly preserve all three native transports; websocket is outside the pin.
const wrongTransport: ConstructorParameters<typeof Mcp.Stdio>[0]["type"] = "websocket"
// @ts-expect-error Git native authority catalog must be nonempty.
gitHost.transport([])
void [operation, provider, codec, mcpCodecs, warehouseCodec, nativeId, plugin, sourceTree, readyContent, transport, wrongPlugin, wrongAccess, wrongTransport]
