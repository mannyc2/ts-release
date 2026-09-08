import { Effect, Schema } from "effect"
import { canonical, containsSecret, decodeJson, isPublicText } from "@mannyc1/ts-release/http"
import { PublicText } from "@mannyc1/ts-release/http"
import { isSafePath, makeDataBoundary, publicUrl } from "@mannyc1/ts-release/http"

export { canonical }

export const schemaUrl =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json" as const

const valid = <A>(predicate: (value: A) => boolean, message = "MCP value is invalid") =>
  Schema.makeFilter((value: A) => (predicate(value) ? undefined : message))
const Text100 = PublicText(100)
const Text255 = PublicText(255)
const InputText = PublicText(4096, true)
const ExactVersion = Text255.check(
  valid(
    (value: string) =>
      value !== "latest" &&
      !/[<>=~^*|,\s]/u.test(value) &&
      !/(?:^|[._-])[xX](?:$|[._-])/u.test(value),
    "MCP package versions must be exact",
  ),
)
const SafePath = Schema.String.check(valid(isSafePath))
const httpsUrl = (value: string, httpsOnly = true): boolean =>
  isPublicText(value, 4096) &&
  publicUrl(value, httpsOnly ? ["https:"] : ["https:", "http:"]) !== null
const HttpsUrl = Schema.String.check(valid((value: string) => httpsUrl(value)))
const TemplateUrl = Schema.String.check(
  valid((value: string) => {
    if (!isPublicText(value, 4096) || /\s/u.test(value)) return false
    return /^https?:\/\//u.test(value)
      ? httpsUrl(value.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/gu, "x"), false)
      : /^\{[A-Za-z_][A-Za-z0-9_]*\}[^\s]*$/u.test(value)
  }),
)
const unique = <A>(values: readonly A[], key: (value: A) => string): boolean =>
  new Set(values.map(key)).size === values.length

const inputFields = {
  description: Schema.optionalKey(InputText),
  isRequired: Schema.optionalKey(Schema.Boolean),
  format: Schema.optionalKey(Schema.Literals(["string", "number", "boolean", "filepath"])),
  value: Schema.optionalKey(InputText),
  isSecret: Schema.optionalKey(Schema.Boolean),
  default: Schema.optionalKey(InputText),
  placeholder: Schema.optionalKey(InputText),
  choices: Schema.optionalKey(
    Schema.Array(InputText).check(valid((values) => unique(values, String))),
  ),
} as const

export class Input extends Schema.Class<Input>("Mcp.Input")({ ...inputFields }) {}
const validInput = valid(
  (value: Input) =>
    value.isSecret !== true || (value.value === undefined && value.default === undefined),
  "Secret MCP inputs cannot embed values or defaults",
)
const InputCodec = Input.check(validInput)
const VariableName = Schema.String.check(
  valid((value: string) => /^[A-Za-z_][A-Za-z0-9_]{0,254}$/u.test(value)),
)
const variables = Schema.optionalKey(Schema.Record(VariableName, InputCodec))
export class NamedInput extends Input.extend<NamedInput>("Mcp.NamedInput")({
  name: Text255,
  variables,
}) {}
const NamedInputs = Schema.Array(NamedInput.check(validInput)).check(
  valid((values: readonly NamedInput[]) => unique(values, ({ name }) => name)),
)
export class PositionalArgument extends Input.extend<PositionalArgument>("Mcp.PositionalArgument")({
  type: Schema.Literal("positional"),
  variables,
  valueHint: Schema.optionalKey(Text255),
  isRepeated: Schema.optionalKey(Schema.Boolean),
}) {}
export class NamedArgument extends Input.extend<NamedArgument>("Mcp.NamedArgument")({
  type: Schema.Literal("named"),
  name: Text255,
  variables,
  isRepeated: Schema.optionalKey(Schema.Boolean),
}) {}
const PositionalCodec = PositionalArgument.check(validInput).check(
  valid(
    (value: PositionalArgument) => value.value !== undefined || value.valueHint !== undefined,
    "MCP positional argument needs value or valueHint",
  ),
)
export type Argument = PositionalArgument | NamedArgument
export const Argument: Schema.Codec<Argument, unknown> = Schema.Union([PositionalCodec, NamedArgument.check(validInput)])

export class Stdio extends Schema.Class<Stdio>("Mcp.Stdio")({ type: Schema.Literal("stdio") }) {}
const networkTransport = {
  url: TemplateUrl,
  headers: Schema.optionalKey(NamedInputs),
}
export class StreamableHttp extends Schema.Class<StreamableHttp>("Mcp.StreamableHttp")({
  type: Schema.Literal("streamable-http"),
  ...networkTransport,
}) {}
export class Sse extends Schema.Class<Sse>("Mcp.Sse")({
  type: Schema.Literal("sse"),
  ...networkTransport,
}) {}
export type Transport = Stdio | StreamableHttp | Sse
export const Transport: Schema.Codec<Transport, unknown> = Schema.Union([Stdio, StreamableHttp, Sse])

export class RemoteHttp extends StreamableHttp.extend<RemoteHttp>("Mcp.RemoteHttp")({
  variables,
}) {}
export class RemoteSse extends Sse.extend<RemoteSse>("Mcp.RemoteSse")({
  variables,
}) {}
export type Remote = RemoteHttp | RemoteSse
export const Remote: Schema.Codec<Remote, unknown> = Schema.Union([RemoteHttp, RemoteSse])

const execution = {
  runtimeHint: Schema.optionalKey(Text255),
  transport: Transport,
  runtimeArguments: Schema.optionalKey(Schema.Array(Argument)),
  packageArguments: Schema.optionalKey(Schema.Array(Argument)),
  environmentVariables: Schema.optionalKey(NamedInputs),
} as const
const executable = valid(
  (value: { readonly runtimeHint?: string; readonly runtimeArguments?: readonly unknown[] }) =>
    !value.runtimeArguments?.length || value.runtimeHint !== undefined,
  "MCP runtime arguments need runtimeHint",
)
const NpmIdentifier = PublicText(214).check(
  valid((value: string) => /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u.test(value)),
)
const PyPiIdentifier = Text255.check(
  valid((value: string) => /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/u.test(value)),
)
const NugetIdentifier = PublicText(100).check(
  valid((value: string) => /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/u.test(value)),
)
const ociIdentifier = (value: string): boolean => {
  const digest = /@sha256:[a-f0-9]{64}$/u.test(value),
    slash = value.lastIndexOf("/"),
    colon = value.lastIndexOf(":"),
    tag = colon > slash ? value.slice(colon + 1) : "",
    coordinate = digest ? value.slice(0, value.indexOf("@sha256:")) : value.slice(0, colon),
    [host, ...path] = coordinate.split("/")
  return (
    (digest || (/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/u.test(tag) && tag !== "latest")) &&
    Boolean(
      host === "docker.io" ||
      host === "ghcr.io" ||
      host === "quay.io" ||
      host === "mcr.microsoft.com" ||
      host?.endsWith(".pkg.dev") ||
      host?.endsWith(".azurecr.io"),
    ) &&
    path.length > 0 &&
    path.every((part) => /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(part))
  )
}
const OciIdentifier = Schema.String.check(valid(ociIdentifier))
const McpbIdentifier = HttpsUrl.check(
  valid((value: string) => {
    const url = new URL(value)
    return (
      !url.search &&
      (url.hostname === "github.com"
        ? /^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+$/u.test(url.pathname)
        : url.hostname === "gitlab.com" &&
          /^\/(?:[^/]+\/)+-\/releases\/[^/]+\/downloads\/[^/]+$/u.test(url.pathname))
    )
  }),
)
const packaged = (identifier: Schema.Codec<string, string>) => ({ identifier, ...execution })
const versioned = (identifier: Schema.Codec<string, string>) => ({
  version: ExactVersion,
  ...packaged(identifier),
})
export class NpmPackage extends Schema.Class<NpmPackage>("Mcp.NpmPackage")({
  registryType: Schema.Literal("npm"),
  registryBaseUrl: Schema.Literal("https://registry.npmjs.org"),
  ...versioned(NpmIdentifier),
}) {}
export class PyPiPackage extends Schema.Class<PyPiPackage>("Mcp.PyPiPackage")({
  registryType: Schema.Literal("pypi"),
  registryBaseUrl: Schema.Literal("https://pypi.org"),
  ...versioned(PyPiIdentifier),
}) {}
export class NugetPackage extends Schema.Class<NugetPackage>("Mcp.NugetPackage")({
  registryType: Schema.Literal("nuget"),
  registryBaseUrl: Schema.Literal("https://api.nuget.org/v3/index.json"),
  ...versioned(NugetIdentifier),
}) {}
export class OciPackage extends Schema.Class<OciPackage>("Mcp.OciPackage")({
  registryType: Schema.Literal("oci"),
  ...packaged(OciIdentifier),
}) {}
export class McpbPackage extends Schema.Class<McpbPackage>("Mcp.McpbPackage")({
  registryType: Schema.Literal("mcpb"),
  ...packaged(McpbIdentifier),
  version: Schema.optionalKey(ExactVersion),
  fileSha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u)),
}) {}
export type Package = NpmPackage | PyPiPackage | OciPackage | NugetPackage | McpbPackage
export const Package: Schema.Codec<Package, unknown> = Schema.Union([
  NpmPackage.check(executable),
  PyPiPackage.check(executable),
  OciPackage.check(executable),
  NugetPackage.check(executable),
  McpbPackage.check(executable),
])

export class Repository extends Schema.Class<Repository>("Mcp.Repository")({
  url: HttpsUrl,
  source: Text255,
  id: Schema.optionalKey(Text255),
  subfolder: Schema.optionalKey(SafePath),
}) {}
export class Icon extends Schema.Class<Icon>("Mcp.Icon")({
  src: HttpsUrl.check(valid((value: string) => value.length <= 255)),
  mimeType: Schema.optionalKey(
    Schema.Literals(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]),
  ),
  sizes: Schema.optionalKey(
    Schema.Array(Schema.String.check(Schema.isPattern(/^(?:[1-9][0-9]*x[1-9][0-9]*|any)$/u))),
  ),
  theme: Schema.optionalKey(Schema.Literals(["light", "dark"])),
}) {}
export class Manifest extends Schema.Class<Manifest>("Mcp.Manifest")({
  $schema: Schema.Literal(schemaUrl),
  name: PublicText(200).check(
    valid((value: string) =>
      /^[a-z0-9]+(?:[.-][a-z0-9]+)+\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(value),
    ),
  ),
  description: Text100,
  version: ExactVersion,
  title: Schema.optionalKey(Text100),
  repository: Schema.optionalKey(Repository),
  websiteUrl: Schema.optionalKey(HttpsUrl),
  icons: Schema.optionalKey(Schema.Array(Icon)),
  packages: Schema.optionalKey(
    Schema.NonEmptyArray(Package).check(
      valid((values: readonly Package[]) =>
        unique(
          values,
          (value) =>
            `${value.registryType}\0${value.identifier}\0${"version" in value ? (value.version ?? "") : ""}`,
        ),
      ),
    ),
  ),
  remotes: Schema.optionalKey(
    Schema.NonEmptyArray(Remote).check(
      valid((values: readonly Remote[]) =>
        unique(values, (value) => `${value.type}\0${value.url}`),
      ),
    ),
  ),
  _meta: Schema.optionalKey(
    Schema.Struct({
      "io.modelcontextprotocol.registry/publisher-provided": Schema.Record(
        Schema.String,
        Schema.Json,
      ),
    }),
  ),
}) {}

const manifestIssue = (manifest: Manifest): string | undefined => {
  if (!manifest.packages && !manifest.remotes)
    return "MCP manifest needs at least one package or remote"
  const metadata = manifest._meta?.["io.modelcontextprotocol.registry/publisher-provided"]
  if (metadata && new TextEncoder().encode(canonical(metadata)).length > 4096)
    return "MCP publisher metadata exceeds 4096 bytes"
  return containsSecret(canonical(manifest)) ? "MCP data contains token-shaped text" : undefined
}
export const ManifestCodec: Schema.Codec<Manifest, unknown> = Manifest.check(Schema.makeFilter(manifestIssue))

const Namespace = Schema.String.check(
  valid((value: string) => /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/u.test(value)),
)
const GitHubRepository = Schema.String.check(
  valid((value: string) =>
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u.test(value),
  ),
)
const WorkflowRef = Schema.String.check(
  valid(
    (value) => /^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]+$/u.test(value) && !value.includes(".."),
  ),
)
export class TokenAuthorization extends Schema.TaggedClass<TokenAuthorization>()(
  "TokenAuthorization",
  { principal: PublicText(512), namespace: Namespace },
) {}
export class OidcAuthorization extends Schema.TaggedClass<OidcAuthorization>()(
  "OidcAuthorization",
  {
    principal: PublicText(512),
    issuer: Schema.Literal("https://token.actions.githubusercontent.com"),
    audience: HttpsUrl,
    repository: GitHubRepository,
    workflow: SafePath,
    workflowRef: WorkflowRef,
  },
) {}
export type Authorization = TokenAuthorization | OidcAuthorization
export const Authorization: Schema.Codec<Authorization, unknown> = Schema.Union([TokenAuthorization, OidcAuthorization])
export class PublishIntent extends Schema.Class<PublishIntent>("Mcp.PublishIntent")({
  registry: Schema.Literals([
    "https://registry.modelcontextprotocol.io",
    "https://staging.registry.modelcontextprotocol.io",
  ]),
  manifest: ManifestCodec,
  authorization: Authorization,
}) {}
const intentIssue = (intent: PublishIntent): string | undefined => {
  const namespace = intent.manifest.name.split("/")[0]!
  if (intent.authorization._tag === "TokenAuthorization")
    return intent.authorization.namespace === namespace
      ? undefined
      : "MCP token namespace does not own the server"
  const owner = intent.authorization.repository.split("/")[0]
  return intent.authorization.audience === intent.registry && namespace === `io.github.${owner}`
    ? undefined
    : "MCP OIDC repository does not own the server"
}
export const PublishIntentCodec: Schema.Codec<PublishIntent, unknown> = PublishIntent.check(
  Schema.makeFilter(intentIssue),
)

export const {
  failure,
  reject,
  admit: attempt,
  own,
  ownOperation,
  ownRequest,
  matches,
} = makeDataBoundary("mcp", "MCP")
export const manifest = (input: unknown): Manifest =>
  own(ManifestCodec, typeof input === "string" ? decodeJson(input) : input)
export const intent = (input: unknown): PublishIntent => own(PublishIntentCodec, input)

export const validate = Effect.fn("mcp.validate")((input: unknown) =>
  attempt("mcp-manifest", () => manifest(input)),
)
export const render = Effect.fn("mcp.render")(function* (input: Manifest) {
  const selected = yield* validate(input)
  return new TextEncoder().encode(`${canonical(Schema.encodeSync(ManifestCodec)(selected))}\n`)
})
