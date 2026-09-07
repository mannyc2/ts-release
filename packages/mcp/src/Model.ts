import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { ReleaseError } from "@mannyc1/ts-release"
import { decodeJson } from "@mannyc1/ts-release/http"

export const schemaUrl =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json" as const

const inputFields = {
  description: Schema.optionalKey(Schema.String),
  isRequired: Schema.optionalKey(Schema.Boolean),
  format: Schema.optionalKey(Schema.Literals(["string", "number", "boolean", "filepath"])),
  value: Schema.optionalKey(Schema.String),
  isSecret: Schema.optionalKey(Schema.Boolean),
  default: Schema.optionalKey(Schema.String),
  placeholder: Schema.optionalKey(Schema.String),
  choices: Schema.optionalKey(Schema.Array(Schema.String)),
} as const

export class Input extends Schema.Class<Input>("Mcp.Input")({ ...inputFields }) {}
const variables = Schema.optionalKey(Schema.Record(Schema.String, Input))
export class NamedInput extends Schema.Class<NamedInput>("Mcp.NamedInput")({
  ...inputFields,
  name: Schema.String,
  variables,
}) {}
export class PositionalArgument extends Schema.Class<PositionalArgument>("Mcp.PositionalArgument")({
  ...inputFields,
  type: Schema.Literal("positional"),
  variables,
  valueHint: Schema.optionalKey(Schema.String),
  isRepeated: Schema.optionalKey(Schema.Boolean),
}) {}
export class NamedArgument extends Schema.Class<NamedArgument>("Mcp.NamedArgument")({
  ...inputFields,
  type: Schema.Literal("named"),
  name: Schema.String,
  variables,
  isRepeated: Schema.optionalKey(Schema.Boolean),
}) {}
const PositionalCodec = PositionalArgument.check(
  Schema.makeFilter((value) => value.value !== undefined || value.valueHint !== undefined),
)
export const Argument = Schema.Union([PositionalCodec, NamedArgument])
export type Argument = typeof Argument.Type

export class Stdio extends Schema.Class<Stdio>("Mcp.Stdio")({ type: Schema.Literal("stdio") }) {}
export class StreamableHttp extends Schema.Class<StreamableHttp>("Mcp.StreamableHttp")({
  type: Schema.Literal("streamable-http"),
  url: Schema.String,
  headers: Schema.optionalKey(Schema.Array(NamedInput)),
}) {}
export class Sse extends Schema.Class<Sse>("Mcp.Sse")({
  type: Schema.Literal("sse"),
  url: Schema.String,
  headers: Schema.optionalKey(Schema.Array(NamedInput)),
}) {}
export const Transport = Schema.Union([Stdio, StreamableHttp, Sse])
export type Transport = typeof Transport.Type

export class RemoteHttp extends Schema.Class<RemoteHttp>("Mcp.RemoteHttp")({
  type: Schema.Literal("streamable-http"),
  url: Schema.String,
  headers: Schema.optionalKey(Schema.Array(NamedInput)),
  variables,
}) {}
export class RemoteSse extends Schema.Class<RemoteSse>("Mcp.RemoteSse")({
  type: Schema.Literal("sse"),
  url: Schema.String,
  headers: Schema.optionalKey(Schema.Array(NamedInput)),
  variables,
}) {}
export const Remote = Schema.Union([RemoteHttp, RemoteSse])
export type Remote = typeof Remote.Type

const execution = {
  runtimeHint: Schema.optionalKey(Schema.String),
  transport: Transport,
  runtimeArguments: Schema.optionalKey(Schema.Array(Argument)),
  packageArguments: Schema.optionalKey(Schema.Array(Argument)),
  environmentVariables: Schema.optionalKey(Schema.Array(NamedInput)),
} as const
export class NpmPackage extends Schema.Class<NpmPackage>("Mcp.NpmPackage")({
  registryType: Schema.Literal("npm"),
  registryBaseUrl: Schema.Literal("https://registry.npmjs.org"),
  identifier: Schema.String,
  version: Schema.String,
  ...execution,
}) {}
export class PyPiPackage extends Schema.Class<PyPiPackage>("Mcp.PyPiPackage")({
  registryType: Schema.Literal("pypi"),
  registryBaseUrl: Schema.Literal("https://pypi.org"),
  identifier: Schema.String,
  version: Schema.String,
  ...execution,
}) {}
export class NugetPackage extends Schema.Class<NugetPackage>("Mcp.NugetPackage")({
  registryType: Schema.Literal("nuget"),
  registryBaseUrl: Schema.Literal("https://api.nuget.org/v3/index.json"),
  identifier: Schema.String,
  version: Schema.String,
  ...execution,
}) {}
export class OciPackage extends Schema.Class<OciPackage>("Mcp.OciPackage")({
  registryType: Schema.Literal("oci"),
  identifier: Schema.String,
  ...execution,
}) {}
export class McpbPackage extends Schema.Class<McpbPackage>("Mcp.McpbPackage")({
  registryType: Schema.Literal("mcpb"),
  identifier: Schema.String,
  version: Schema.optionalKey(Schema.String),
  fileSha256: Schema.String,
  ...execution,
}) {}
export const Package = Schema.Union([
  NpmPackage,
  PyPiPackage,
  OciPackage,
  NugetPackage,
  McpbPackage,
])
export type Package = typeof Package.Type

export class Repository extends Schema.Class<Repository>("Mcp.Repository")({
  url: Schema.String,
  source: Schema.String,
  id: Schema.optionalKey(Schema.String),
  subfolder: Schema.optionalKey(Schema.String),
}) {}
export class Icon extends Schema.Class<Icon>("Mcp.Icon")({
  src: Schema.String,
  mimeType: Schema.optionalKey(
    Schema.Literals(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]),
  ),
  sizes: Schema.optionalKey(Schema.Array(Schema.String)),
  theme: Schema.optionalKey(Schema.Literals(["light", "dark"])),
}) {}
export class Manifest extends Schema.Class<Manifest>("Mcp.Manifest")({
  $schema: Schema.Literal(schemaUrl),
  name: Schema.String,
  description: Schema.String,
  version: Schema.String,
  title: Schema.optionalKey(Schema.String),
  repository: Schema.optionalKey(Repository),
  websiteUrl: Schema.optionalKey(Schema.String),
  icons: Schema.optionalKey(Schema.Array(Icon)),
  packages: Schema.optionalKey(Schema.NonEmptyArray(Package)),
  remotes: Schema.optionalKey(Schema.NonEmptyArray(Remote)),
  _meta: Schema.optionalKey(
    Schema.Struct({
      "io.modelcontextprotocol.registry/publisher-provided": Schema.Record(
        Schema.String,
        Schema.Json,
      ),
    }),
  ),
}) {}

export class TokenAuthorization extends Schema.TaggedClass<TokenAuthorization>()(
  "TokenAuthorization",
  { principal: Schema.String, namespace: Schema.String },
) {}
export class OidcAuthorization extends Schema.TaggedClass<OidcAuthorization>()(
  "OidcAuthorization",
  {
    principal: Schema.String,
    issuer: Schema.Literal("https://token.actions.githubusercontent.com"),
    audience: Schema.String,
    repository: Schema.String,
    workflow: Schema.String,
    workflowRef: Schema.String,
  },
) {}
export const Authorization = Schema.Union([TokenAuthorization, OidcAuthorization])
export type Authorization = typeof Authorization.Type
export class PublishIntent extends Schema.Class<PublishIntent>("Mcp.PublishIntent")({
  registry: Schema.Literals([
    "https://registry.modelcontextprotocol.io",
    "https://staging.registry.modelcontextprotocol.io",
  ]),
  manifest: Manifest,
  authorization: Authorization,
}) {}

const secret =
  /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abps]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|npm_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY)/u
const issue = (condition: unknown, message: string): string | undefined =>
  condition ? undefined : message
const textIssue = (value: string, maximum: number, empty = false): string | undefined =>
  issue(
    (empty || value.length > 0) &&
      value === value.normalize("NFC") &&
      value.trim() === value &&
      [...value].length <= maximum &&
      !/[\u0000-\u001f\u007f]/u.test(value) &&
      !secret.test(value),
    "MCP text must be canonical public NFC text",
  )
const exactVersion = (value: string): boolean =>
  textIssue(value, 255) === undefined &&
  value !== "latest" &&
  !/[<>=~^*|,\s]/u.test(value) &&
  !/(?:^|[._-])[xX](?:$|[._-])/u.test(value)
const safePath = (value: string): boolean =>
  value.length <= 1024 &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  !value.split("/").some((part) => part === "" || part === "." || part === "..")
const httpsUrl = (value: string, httpsOnly = true): boolean => {
  try {
    const url = new URL(value)
    return (
      (!httpsOnly || url.protocol === "https:") &&
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.href === value || (url.pathname === "/" && url.origin === value))
    )
  } catch {
    return false
  }
}
const templateUrl = (value: string): boolean => {
  if (textIssue(value, 4096) !== undefined || /\s/u.test(value)) return false
  if (/^https?:\/\//u.test(value)) {
    const literal = value.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/gu, "x")
    return httpsUrl(literal, false)
  }
  return /^\{[A-Za-z_][A-Za-z0-9_]*\}[^\s]*$/u.test(value)
}
const inputIssue = (value: Input): string | undefined => {
  for (const field of ["description", "value", "default", "placeholder"] as const) {
    const selected = value[field]
    if (selected !== undefined && textIssue(selected, 4096, true) !== undefined)
      return "MCP input text is invalid"
  }
  if (value.isSecret === true && (value.value !== undefined || value.default !== undefined))
    return "Secret MCP inputs cannot embed values or defaults"
  if (value.choices !== undefined) {
    if (new Set(value.choices).size !== value.choices.length) return "MCP input choices repeat"
    if (value.choices.some((choice) => textIssue(choice, 4096, true) !== undefined))
      return "MCP input choice is invalid"
  }
  return undefined
}
const variablesIssue = (values: Readonly<Record<string, Input>> | undefined): string | undefined => {
  for (const [name, value] of Object.entries(values ?? {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) || name.length > 255)
      return "MCP variable name is invalid"
    const selected = inputIssue(value)
    if (selected) return selected
  }
  return undefined
}
const namedInputsIssue = (
  values: ReadonlyArray<NamedInput> | undefined,
): string | undefined => {
  const names = new Set<string>()
  for (const value of values ?? []) {
    if (textIssue(value.name, 255) !== undefined || names.has(value.name))
      return "MCP named inputs must have unique canonical names"
    names.add(value.name)
    const selected = inputIssue(value) ?? variablesIssue(value.variables)
    if (selected) return selected
  }
  return undefined
}
const argumentIssue = (value: Argument): string | undefined => {
  if (value.type === "named" && textIssue(value.name, 255) !== undefined)
    return "MCP named argument is invalid"
  if (value.type === "positional" && value.value === undefined && value.valueHint === undefined)
    return "MCP positional argument needs value or valueHint"
  if (value.type === "positional" && value.valueHint !== undefined && textIssue(value.valueHint, 255))
    return "MCP positional valueHint is invalid"
  return inputIssue(value) ?? variablesIssue(value.variables)
}
const transportIssue = (value: Transport | Remote): string | undefined => {
  if (value.type === "stdio") return undefined
  if (!templateUrl(value.url)) return "MCP transport URL is invalid"
  return namedInputsIssue(value.headers) ??
    ("variables" in value ? variablesIssue(value.variables) : undefined)
}
const packageIdentifierIssue = (value: Package): string | undefined => {
  if (value.registryType === "npm")
    return issue(
      /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u.test(value.identifier) &&
        value.identifier.length <= 214,
      "MCP npm identifier is invalid",
    )
  if (value.registryType === "pypi")
    return issue(
      /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/u.test(value.identifier) &&
        value.identifier.length <= 255,
      "MCP PyPI identifier is invalid",
    )
  if (value.registryType === "nuget")
    return issue(
      /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/u.test(value.identifier) &&
        value.identifier.length <= 100,
      "MCP NuGet identifier is invalid",
    )
  if (value.registryType === "oci") {
    const digest = /@sha256:[a-f0-9]{64}$/u.test(value.identifier)
    const slash = value.identifier.lastIndexOf("/"),
      colon = value.identifier.lastIndexOf(":"),
      tag = colon > slash ? value.identifier.slice(colon + 1) : "",
      tagged = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/u.test(tag) && tag !== "latest",
      coordinate = digest
        ? value.identifier.slice(0, value.identifier.indexOf("@sha256:"))
        : value.identifier.slice(0, colon),
      [host, ...path] = coordinate.split("/"),
      supported =
        host === "docker.io" ||
        host === "ghcr.io" ||
        host === "quay.io" ||
        host === "mcr.microsoft.com" ||
        host?.endsWith(".pkg.dev") ||
        host?.endsWith(".azurecr.io")
    return issue(
      (digest || tagged) &&
        supported &&
        path.length > 0 &&
        path.every((part) => /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(part)),
      "MCP OCI identifier needs an immutable public coordinate",
    )
  }
  let url: URL
  try {
    url = new URL(value.identifier)
  } catch {
    return "MCPB identifier is invalid"
  }
  const release =
    url.hostname === "github.com"
      ? /^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+$/u.test(url.pathname)
      : url.hostname === "gitlab.com" &&
        /^\/(?:[^/]+\/)+-\/releases\/[^/]+\/downloads\/[^/]+$/u.test(url.pathname)
  return issue(
    httpsUrl(value.identifier) && !url.search && release && /^[a-f0-9]{64}$/u.test(value.fileSha256),
    "MCPB package needs an exact release URL and SHA-256",
  )
}

const manifestIssue = (manifest: Manifest): string | undefined => {
  if (
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)+\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(
      manifest.name,
    ) ||
    [...manifest.name].length > 200
  )
    return "MCP server name must use canonical lowercase reverse-DNS/name form"
  if (textIssue(manifest.description, 100) || !exactVersion(manifest.version))
    return "MCP description or version is invalid"
  if (manifest.title !== undefined && textIssue(manifest.title, 100)) return "MCP title is invalid"
  if (manifest.websiteUrl !== undefined && !httpsUrl(manifest.websiteUrl))
    return "MCP website URL is invalid"
  if (manifest.repository !== undefined) {
    if (
      !httpsUrl(manifest.repository.url) ||
      textIssue(manifest.repository.source, 255) ||
      (manifest.repository.id !== undefined && textIssue(manifest.repository.id, 255)) ||
      (manifest.repository.subfolder !== undefined && !safePath(manifest.repository.subfolder))
    )
      return "MCP repository metadata is invalid"
  }
  for (const icon of manifest.icons ?? []) {
    if (
      !httpsUrl(icon.src) ||
      icon.src.length > 255 ||
      icon.sizes?.some((size) => !/^(?:[1-9][0-9]*x[1-9][0-9]*|any)$/u.test(size))
    )
      return "MCP icon metadata is invalid"
  }
  if (!manifest.packages && !manifest.remotes)
    return "MCP manifest needs at least one package or remote"
  const coordinates = new Set<string>()
  for (const entry of manifest.packages ?? []) {
    const version = "version" in entry ? entry.version : undefined,
      coordinate = `${entry.registryType}\0${entry.identifier}\0${version ?? ""}`
    if (coordinates.has(coordinate)) return "MCP package coordinate repeats"
    coordinates.add(coordinate)
    if (version !== undefined && !exactVersion(version)) return "MCP package version is not exact"
    const selected = packageIdentifierIssue(entry) ?? transportIssue(entry.transport)
    if (selected) return selected
    if ((entry.runtimeArguments?.length ?? 0) > 0 && entry.runtimeHint === undefined)
      return "MCP runtime arguments need runtimeHint"
    if (entry.runtimeHint !== undefined && textIssue(entry.runtimeHint, 255))
      return "MCP runtimeHint is invalid"
    const environment = namedInputsIssue(entry.environmentVariables)
    if (environment) return environment
    for (const argument of [...(entry.runtimeArguments ?? []), ...(entry.packageArguments ?? [])]) {
      const selected = argumentIssue(argument)
      if (selected) return selected
    }
  }
  const remotes = new Set<string>()
  for (const remote of manifest.remotes ?? []) {
    const coordinate = `${remote.type}\0${remote.url}`
    if (remotes.has(coordinate)) return "MCP remote coordinate repeats"
    remotes.add(coordinate)
    const selected = transportIssue(remote)
    if (selected) return selected
  }
  if (manifest._meta !== undefined) {
    const encoded = canonical(
      manifest._meta["io.modelcontextprotocol.registry/publisher-provided"],
    )
    if (new TextEncoder().encode(encoded).length > 4096)
      return "MCP publisher metadata exceeds 4096 bytes"
  }
  return recursiveTextIssue(manifest)
}

const recursiveTextIssue = (value: unknown): string | undefined => {
  if (typeof value === "string") return secret.test(value) ? "MCP data contains token-shaped text" : undefined
  if (value === null || typeof value !== "object") return undefined
  for (const child of Object.values(value)) {
    const selected = recursiveTextIssue(child)
    if (selected) return selected
  }
  return undefined
}

export const ManifestCodec = Manifest.check(Schema.makeFilter(manifestIssue))
const intentIssue = (intent: PublishIntent): string | undefined => {
  const selected = manifestIssue(intent.manifest)
  if (selected) return selected
  const namespace = intent.manifest.name.split("/")[0]!
  if (textIssue(intent.authorization.principal, 512)) return "MCP principal is invalid"
  if (intent.authorization._tag === "TokenAuthorization")
    return intent.authorization.namespace === namespace &&
      /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/u.test(intent.authorization.namespace)
      ? undefined
      : "MCP token namespace does not own the server"
  if (
    intent.authorization.audience !== intent.registry ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u.test(
      intent.authorization.repository,
    ) ||
    !safePath(intent.authorization.workflow) ||
    !/^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]+$/u.test(intent.authorization.workflowRef) ||
    intent.authorization.workflowRef.includes("..")
  )
    return "MCP OIDC authority is invalid"
  const owner = intent.authorization.repository.split("/")[0]
  return namespace === `io.github.${owner}` ? undefined : "MCP OIDC repository does not own the server"
}
export const PublishIntentCodec = PublishIntent.check(Schema.makeFilter(intentIssue))

const compare = (left: string, right: string): number => {
  const a = [...left], b = [...right]
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const selected = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!
    if (selected) return selected
  }
  return a.length - b.length
}
export const canonical = (input: unknown): string => {
  const active = new Set<object>()
  const visit = (value: unknown): string => {
    if (value === null || typeof value === "boolean") return JSON.stringify(value)
    if (typeof value === "string") {
      if (value !== value.normalize("NFC")) throw new Error("String is not NFC")
      return JSON.stringify(value)
    }
    if (typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0))
      return String(value)
    if (typeof value !== "object") throw new Error("Value is not canonical JSON")
    if (active.has(value)) throw new Error("Value is cyclic")
    active.add(value)
    const array = Array.isArray(value)
    const keys = Reflect.ownKeys(value).filter((key) => !(array && key === "length"))
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (typeof key !== "string" || !descriptor.enumerable || !("value" in descriptor))
        throw new Error("Value contains hidden data or an accessor")
    }
    let output: string
    if (array) {
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index)))
        throw new Error("Array is sparse or has extra fields")
      output = `[${value.map(visit).join(",")}]`
    }
    else {
      output = `{${(keys as string[]).sort(compare).map((key) =>
        `${visit(key)}:${visit(Object.getOwnPropertyDescriptor(value, key)!.value)}`).join(",")}}`
    }
    active.delete(value)
    return output
  }
  return visit(input)
}
export const deepFreeze = <A>(value: A): A => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}
export const own = <A, I>(codec: Schema.Codec<A, I>, input: unknown): A =>
  deepFreeze(
    Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(
      JSON.parse(canonical(input)) as unknown,
    ),
  )
export const attempt = <A>(code: string, body: () => A): Effect.Effect<A, ReleaseError> =>
  Effect.try({
    try: body,
    catch: (cause) =>
      cause instanceof ReleaseError
        ? cause
        : new ReleaseError({
            code,
            message: cause instanceof Error ? cause.message : "MCP value could not be admitted",
          }),
  })
export const manifest = (input: unknown): Manifest => {
  const parsed =
    typeof input === "string" ? decodeJson(new TextEncoder().encode(input)) : input
  return own(ManifestCodec, parsed)
}
export const intent = (input: unknown): PublishIntent => own(PublishIntentCodec, input)

export const validate = Effect.fn("mcp.validate")(function* (input: unknown) {
  return yield* attempt("mcp-manifest", () => manifest(input))
})
export const render = Effect.fn("mcp.render")(function* (input: Manifest) {
  const selected = yield* validate(input)
  return new TextEncoder().encode(`${canonical(Schema.encodeSync(ManifestCodec)(selected))}\n`)
})
