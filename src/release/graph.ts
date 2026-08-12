import * as Schema from "effect/Schema"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  EnvironmentName,
  ProviderId,
  ResolvedAuthStrategy,
  SubjectId,
  TokenAuthStrategy,
  TrustedPublishingAuthStrategy
} from "../model/authority.js"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath } from "../model/primitives.js"

export class OutputDeclaration extends Schema.Class<OutputDeclaration>("OutputDeclaration")({
  id: OutputId, path: SafeRelativePath,
  kind: Schema.Literals(["file", "directory", "executable", "archive", "digest", "package", "wheel", "checksum-file", "catalog-file", "container-metadata", "sbom", "signature", "notarized", "attestation"]),
  provenance: Schema.optionalKey(Schema.Literals(["build", "import", "process", "catalog", "internal"])),
  mediaType: Schema.optionalKey(Schema.NonEmptyString),
  platform: Schema.optionalKey(Schema.Struct({
    os: Schema.Literals(["linux", "darwin", "windows"]), arch: Schema.Literals(["x64", "arm64"]),
    libc: Schema.optionalKey(Schema.Literals(["glibc", "musl"])), binaryName: Schema.optionalKey(Schema.NonEmptyString), targetTriple: Schema.optionalKey(Schema.NonEmptyString)
  }))
}) {}
export class ContentHole extends Schema.Class<ContentHole>("ContentHole")({
  fact: Schema.Literals(["sha256", "downloadUrl", "assetName"]), outputId: OutputId
}) {}
export const ContentValue = Schema.Union([Schema.String, Schema.Array(Schema.Union([Schema.String, ContentHole]))])
export type ContentValue = typeof ContentValue.Type
const optional = Schema.optionalKey
const argv = Schema.NonEmptyArray(Schema.String)

export class GraphCommandCheck extends Schema.TaggedClass<GraphCommandCheck>()("GraphCommandCheck", {
  id: OperationId, argv, cwd: SafeRelativePath, environmentNames: Schema.Array(Schema.NonEmptyString),
  inputs: Schema.Array(OutputId), sourceCommit: NonEmptyName
}) {}

export class GraphCommandArtifact extends Schema.TaggedClass<GraphCommandArtifact>()("GraphCommandArtifact", {
  id: OperationId, argv, cwd: SafeRelativePath, environmentNames: Schema.Array(Schema.NonEmptyString),
  inputs: Schema.Array(OutputId), outputs: Schema.NonEmptyArray(OutputDeclaration), sourceCommit: NonEmptyName
}) {}

export class GraphArchive extends Schema.TaggedClass<GraphArchive>()("GraphArchive", {
  id: OperationId, inputs: Schema.Array(OutputId), output: OutputDeclaration,
  format: Schema.Literals(["tar.gz", "zip"]), files: optional(Schema.NonEmptyArray(Schema.String))
}) {}

export class GraphChecksum extends Schema.TaggedClass<GraphChecksum>()("GraphChecksum", {
  id: OperationId, inputs: Schema.NonEmptyArray(OutputId), output: OutputDeclaration,
  algorithm: Schema.Literals(["sha256", "sha512"])
}) {}

export class GraphCatalog extends Schema.TaggedClass<GraphCatalog>()("GraphCatalog", {
  id: OperationId, inputs: Schema.Array(OutputId), output: OutputDeclaration, content: Schema.Union([
    Schema.String, Schema.Array(Schema.Union([Schema.String, Schema.Struct({
      fact: Schema.Literals(["sha256", "downloadUrl", "assetName"]), outputId: OutputId
    })]))
  ])
}) {}

export const GraphPreparation = Schema.Union([
  GraphCommandCheck, GraphCommandArtifact, GraphArchive, GraphChecksum, GraphCatalog
])
export type GraphPreparation = typeof GraphPreparation.Type

/** Safe, durable authority intent resolved before a publication enters the graph. */
export class PublicationAuthorityIntent
  extends Schema.Class<PublicationAuthorityIntent>("PublicationAuthorityIntent")({
    subject: SubjectId,
    provider: ProviderId,
    audience: CanonicalAudience,
    observationStrategies: Schema.NonEmptyArray(ResolvedAuthStrategy),
    publishStrategy: ResolvedAuthStrategy
  }) {}

export class GraphNpmPublication extends Schema.TaggedClass<GraphNpmPublication>()("GraphNpmPublication", {
  id: OperationId, packageName: NonEmptyName, version: NonEmptyName, registryUrl: Schema.NonEmptyString,
  artifactIds: Schema.Array(OutputId), authority: PublicationAuthorityIntent
}) {}

export class GraphGitHubPublication extends Schema.TaggedClass<GraphGitHubPublication>()("GraphGitHubPublication", {
  id: OperationId, repository: Schema.NonEmptyString, tag: NonEmptyName, title: NonEmptyName,
  draft: Schema.Boolean, prerelease: Schema.Boolean, body: optional(Schema.String), bodyArtifact: optional(OutputId),
  assetIds: Schema.Array(OutputId), authority: PublicationAuthorityIntent
}) {}

export const GraphPublication = Schema.Union([GraphNpmPublication, GraphGitHubPublication])
export type GraphPublication = typeof GraphPublication.Type

export class CapabilityContribution extends Schema.Class<CapabilityContribution>("CapabilityContribution")({
  artifacts: Schema.Array(OutputDeclaration), preparations: Schema.Array(GraphPreparation),
  publications: Schema.Array(GraphPublication)
}) {}

export class ReleaseGraph extends Schema.Class<ReleaseGraph>("ReleaseGraph")({
  artifacts: Schema.Array(OutputDeclaration), preparations: Schema.Array(GraphPreparation),
  publications: Schema.Array(GraphPublication)
}) {}

export class GraphLinkError
  extends Schema.TaggedErrorClass<GraphLinkError>()("GraphLinkError", {
    kind: Schema.Literals(["duplicate", "missing", "cycle", "path", "reference"]),
    value: Schema.String, reason: Schema.String
  }) {}

const authorityError = (value: string, reason: string): GraphLinkError =>
  new GraphLinkError({ kind: "reference", value, reason })

/**
 * Canonical registry authority includes the complete normalized base path.
 * Query, fragment, and user-info components can never enter a credential
 * audience.
 */
export const canonicalizeRegistryUrl = (value: string): string => {
  let endpoint: URL
  try { endpoint = new URL(value) } catch {
    throw authorityError("publish.npm.registry", "npm registry must be an absolute HTTP(S) URL.")
  }
  if ((endpoint.protocol !== "https:" && endpoint.protocol !== "http:") || endpoint.host.length === 0) {
    throw authorityError("publish.npm.registry", "npm registry must be an absolute HTTP(S) URL.")
  }
  if (endpoint.username.length > 0 || endpoint.password.length > 0) {
    throw authorityError("publish.npm.registry", "npm registry must not contain credentials.")
  }
  if (value.includes("?") || value.includes("#")) {
    throw authorityError("publish.npm.registry", "npm registry must not contain a query or fragment.")
  }
  const basePath = endpoint.pathname.replace(/\/+$/u, "")
  return `${endpoint.origin}${basePath.length === 0 ? "/" : `${basePath}/`}`
}

const tokenStrategy = (value: string, field: string): TokenAuthStrategy => {
  let name: EnvironmentName
  try { name = EnvironmentName.make(value) } catch {
    throw authorityError(field, "Credential references derived from tokenEnv must be portable environment variable names.")
  }
  return TokenAuthStrategy.make({ kind: "token", credential: CredentialRef.make(name) })
}

const anonymousStrategy = (): AnonymousAuthStrategy => AnonymousAuthStrategy.make({ kind: "anonymous" })

const githubWorkflowIdentity = (value: string | undefined): string => {
  const workflow = value ?? "release.yml"
  const canonical = workflow.startsWith(".github/workflows/")
    ? workflow
    : `.github/workflows/${workflow}`
  if (!/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/u.test(canonical)) {
    throw authorityError(
      "publish.npm.trustedPublishing.workflow",
      "Trusted-publishing workflow must name one YAML file in .github/workflows/."
    )
  }
  return canonical
}

const githubHostedIdentityProvider = (value: "github-actions" | undefined): ProviderId => {
  if (value !== undefined && value !== "github-actions") {
    throw authorityError(
      "publish.npm.trustedPublishing.provider",
      "The certified trusted-publishing identity provider is github-actions."
    )
  }
  return ProviderId.make("github-actions")
}

export interface NpmPublicationAuthorityInput {
  readonly packageName: string
  readonly version: string
  readonly registryUrl: string
  readonly tokenEnv?: string
  readonly trustedPublishing?: {
    readonly provider?: "github-actions"
    readonly workflow?: string
  }
}

/** Resolve npm auth once; no secret value enters the graph or prepared state. */
export const makeNpmPublicationAuthorityIntent = (
  input: NpmPublicationAuthorityInput
): PublicationAuthorityIntent => {
  if (input.tokenEnv !== undefined && input.trustedPublishing !== undefined) {
    throw authorityError("publish.npm", "npm token and trusted-publishing strategies are mutually exclusive.")
  }
  const provider = ProviderId.make("npm")
  const publishStrategy: ResolvedAuthStrategy = input.trustedPublishing === undefined
    ? tokenStrategy(input.tokenEnv ?? "NPM_TOKEN", "publish.npm.tokenEnv")
    : TrustedPublishingAuthStrategy.make({
      kind: "trusted-publishing",
      identityProvider: githubHostedIdentityProvider(input.trustedPublishing.provider),
      runnerClass: "github-hosted",
      workflow: githubWorkflowIdentity(input.trustedPublishing.workflow)
    })
  return PublicationAuthorityIntent.make({
    subject: SubjectId.make(`npm:${input.packageName}@${input.version}`),
    provider,
    audience: CanonicalAudience.make(canonicalizeRegistryUrl(input.registryUrl)),
    observationStrategies: publishStrategy.kind === "token"
      ? [anonymousStrategy(), publishStrategy]
      : [anonymousStrategy()],
    publishStrategy
  })
}

const githubCoordinate = (value: string): string => {
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(value)) {
    throw authorityError("publish.github.repository", "GitHub repository must be an owner/repository coordinate.")
  }
  return value
}

export interface GitHubPublicationAuthorityInput {
  readonly repository: string
  readonly tag: string
  readonly tokenEnv?: string
}

/** Resolve GitHub auth once; anonymous observation is always attempted first. */
export const makeGitHubPublicationAuthorityIntent = (
  input: GitHubPublicationAuthorityInput
): PublicationAuthorityIntent => {
  const repository = githubCoordinate(input.repository)
  const provider = ProviderId.make("github")
  const publishStrategy = tokenStrategy(input.tokenEnv ?? "GITHUB_TOKEN", "publish.github.tokenEnv")
  return PublicationAuthorityIntent.make({
    subject: SubjectId.make(`github:${repository}#${input.tag}`),
    provider,
    audience: CanonicalAudience.make(`https://api.github.com/repos/${repository}`),
    observationStrategies: [anonymousStrategy(), publishStrategy],
    publishStrategy
  })
}

const sameTokenStrategy = (left: ResolvedAuthStrategy | undefined, right: TokenAuthStrategy): boolean =>
  left?.kind === "token" && left.credential === right.credential

export const npmPublicationAuthorityIssue = (publication: {
  readonly packageName: { readonly toString: () => string }
  readonly version: { readonly toString: () => string }
  readonly registryUrl: string
  readonly authority: PublicationAuthorityIntent
}): string | undefined => {
  const expectedSubject = `npm:${publication.packageName}@${publication.version}`
  let expectedAudience: string
  try { expectedAudience = canonicalizeRegistryUrl(publication.registryUrl) } catch {
    return "npm publication must carry a canonical absolute registry endpoint."
  }
  const { authority } = publication
  if (publication.registryUrl !== expectedAudience || authority.subject !== expectedSubject ||
      authority.provider !== "npm" || authority.audience !== expectedAudience) {
    return "npm publication authority must match its exact package, version, provider, and canonical registry audience."
  }
  if (authority.observationStrategies[0]?.kind !== "anonymous") {
    return "npm observation authority must attempt anonymous access first."
  }
  if (authority.publishStrategy.kind === "token") {
    return authority.observationStrategies.length === 2 &&
        sameTokenStrategy(authority.observationStrategies[1], authority.publishStrategy)
      ? undefined
      : "npm token publication requires anonymous observation followed by the exact configured token reference."
  }
  if (authority.publishStrategy.kind === "trusted-publishing") {
    return authority.observationStrategies.length === 1 &&
        authority.publishStrategy.identityProvider === "github-actions" &&
        authority.publishStrategy.runnerClass === "github-hosted" &&
        /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/u.test(authority.publishStrategy.workflow)
      ? undefined
      : "npm trusted publishing requires anonymous observation and the certified npm/GitHub Actions identity."
  }
  return "npm publication requires token or trusted-publishing mutation authority."
}

export const githubPublicationAuthorityIssue = (publication: {
  readonly repository: string
  readonly tag: { readonly toString: () => string }
  readonly authority: PublicationAuthorityIntent
}): string | undefined => {
  let repository: string
  try { repository = githubCoordinate(publication.repository) } catch {
    return "GitHub publication must carry an owner/repository coordinate."
  }
  const { authority } = publication
  if (authority.subject !== `github:${repository}#${publication.tag}` || authority.provider !== "github" ||
      authority.audience !== `https://api.github.com/repos/${repository}`) {
    return "GitHub publication authority must match its exact repository, tag, provider, and API audience."
  }
  if (authority.publishStrategy.kind !== "token" || authority.observationStrategies.length !== 2 ||
      authority.observationStrategies[0]?.kind !== "anonymous" ||
      !sameTokenStrategy(authority.observationStrategies[1], authority.publishStrategy)) {
    return "GitHub publication requires anonymous observation followed by its exact configured token reference."
  }
  return undefined
}

// `localeCompare` is environment-dependent. Graph order is an internal
// identity, so it uses the repository's plain code-point order instead.
const byId = (left: { readonly id: { toString(): string } }, right: { readonly id: { toString(): string } }) => {
  const a = left.id.toString()
  const b = right.id.toString()
  return a < b ? -1 : a > b ? 1 : 0
}

const preparationInputs = (preparation: GraphPreparation): ReadonlyArray<OutputId> => preparation.inputs
const preparationOutputs = (preparation: GraphPreparation): ReadonlyArray<OutputDeclaration> =>
  preparation._tag === "GraphCommandArtifact" ? preparation.outputs
    : preparation._tag === "GraphArchive" || preparation._tag === "GraphChecksum" || preparation._tag === "GraphCatalog"
    ? [preparation.output] : []

export const linkContributions = (
  contributions: ReadonlyArray<CapabilityContribution>
): ReleaseGraph => {
  const declared = contributions.flatMap((item) => item.artifacts)
  const allPreparationOutputs = contributions.flatMap((item) => item.preparations.flatMap(preparationOutputs))
  const artifactIds = new Set<string>()
  for (const artifact of declared) {
    if (artifactIds.has(artifact.id.toString())) throw new GraphLinkError({
      kind: "duplicate", value: artifact.id.toString(), reason: "Artifact id has more than one declaration."
    })
    artifactIds.add(artifact.id.toString())
  }
  for (const artifact of allPreparationOutputs) artifactIds.add(artifact.id.toString())
  const artifacts = [...declared, ...allPreparationOutputs.filter((item) =>
    !declared.some((declaredArtifact) => declaredArtifact.id === item.id)
  )].sort(byId)
  const paths = new Map<string, string>()
  for (const artifact of artifacts) {
    const path = artifact.path.toString()
    const previous = paths.get(path)
    if (previous !== undefined && previous !== artifact.id.toString()) throw new GraphLinkError({
      kind: "path", value: path, reason: `Artifacts ${previous} and ${artifact.id} share one output path.`
    })
    paths.set(path, artifact.id.toString())
  }
  const preparations = contributions.flatMap((item) => item.preparations).sort(byId)
  const operationIds = new Set<string>()
  const producers = new Map<string, string>()
  for (const preparation of preparations) {
    const id = preparation.id.toString()
    if (operationIds.has(id)) throw new GraphLinkError({
      kind: "duplicate", value: id, reason: "Preparation id has more than one producer."
    })
    operationIds.add(id)
    for (const input of preparationInputs(preparation)) {
      if (!artifactIds.has(input.toString())) throw new GraphLinkError({
        kind: "missing", value: input.toString(), reason: `Preparation ${id} references no artifact.`
      })
    }
    for (const output of preparationOutputs(preparation)) {
      const outputId = output.id.toString()
      if (declared.some((artifact) => artifact.id.toString() === outputId)) throw new GraphLinkError({
        kind: "duplicate", value: outputId, reason: "A declared artifact cannot also be a preparation output."
      })
      if (producers.has(outputId)) throw new GraphLinkError({
        kind: "duplicate", value: outputId, reason: "Output has more than one producer."
      })
      if (preparation._tag === "GraphCommandArtifact" && ["directory", "package"].includes(output.kind)) throw new GraphLinkError({
        kind: "path", value: outputId, reason: "Generic command outputs must be regular files."
      })
      if (preparation._tag === "GraphCommandArtifact" && preparation.inputs.some((input) => input.toString() === outputId)) throw new GraphLinkError({
        kind: "reference", value: outputId, reason: "Command inputs and outputs must be disjoint."
      })
      if (preparation._tag === "GraphCommandArtifact" && preparation.inputs.some((input) =>
        artifacts.find((artifact) => artifact.id.toString() === input.toString())?.path === output.path)) throw new GraphLinkError({
        kind: "path", value: outputId, reason: "Command outputs must not overwrite input paths."
      })
      producers.set(outputId, id)
    }
    const references = preparation._tag === "GraphCommandCheck" || preparation._tag === "GraphCommandArtifact"
      ? preparation.argv.flatMap((part) => [...part.matchAll(/\{(input|output):([^}]+)\}/gu)]) : []
    for (const reference of references) {
      const direction = reference[1]
      const referenced = reference[2] ?? ""
      if (direction === "input" && !preparationInputs(preparation).some((input) => input.toString() === referenced)) {
        throw new GraphLinkError({ kind: "reference", value: referenced, reason: "Command input reference is undeclared." })
      }
      if (direction === "output" && !preparationOutputs(preparation).some((output) => output.id.toString() === referenced)) {
        throw new GraphLinkError({ kind: "reference", value: referenced, reason: "Command output reference is undeclared." })
      }
    }
    if (preparation._tag === "GraphCommandCheck" || preparation._tag === "GraphCommandArtifact") {
      for (const part of preparation.argv) {
        for (const token of part.matchAll(/\{([^}]+)\}/gu)) {
          const value = token[1] ?? ""
          if (!value.startsWith("input:") && !value.startsWith("output:")) throw new GraphLinkError({
            kind: "reference", value, reason: "Command paths only support {input:<id>} and {output:<id>} references."
          })
        }
      }
    }
  }
  const publications = contributions.flatMap((item) => item.publications).sort(byId)
  for (const publication of publications) {
    const authorityIssue = publication._tag === "GraphNpmPublication"
      ? npmPublicationAuthorityIssue(publication)
      : githubPublicationAuthorityIssue(publication)
    if (authorityIssue !== undefined) throw new GraphLinkError({
      kind: "reference", value: publication.id.toString(), reason: authorityIssue
    })
    if (publication._tag === "GraphGitHubPublication" && publication.body !== undefined && publication.bodyArtifact !== undefined) {
      throw new GraphLinkError({ kind: "reference", value: publication.id.toString(), reason: "GitHub body must be inline text or one text artifact, not both." })
    }
    const ids = publication._tag === "GraphGitHubPublication"
      ? [...publication.assetIds, ...(publication.bodyArtifact === undefined ? [] : [publication.bodyArtifact])]
      : publication.artifactIds
    for (const id of ids) if (!artifactIds.has(id.toString()) && !producers.has(id.toString())) {
      throw new GraphLinkError({ kind: "missing", value: id.toString(), reason: "Publication references no artifact." })
    }
    if (publication._tag === "GraphGitHubPublication" && publication.bodyArtifact !== undefined) {
      const body = artifacts.find((artifact) => artifact.id.toString() === publication.bodyArtifact!.toString())
      if (body !== undefined && (body.mediaType === undefined || !body.mediaType.startsWith("text/"))) throw new GraphLinkError({
        kind: "reference", value: publication.bodyArtifact.toString(), reason: "GitHub body artifacts must declare a text/* media type."
      })
    }
  }
  const dependencies = new Map<string, Set<string>>(
    preparations.map((preparation) => [preparation.id.toString(), new Set(
      preparationInputs(preparation).map((input) => producers.get(input.toString())).filter(
        (value): value is string => value !== undefined
      ))])
  )
  const ordered: GraphPreparation[] = []
  const pending = new Map(preparations.map((preparation) => [preparation.id.toString(), preparation]))
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((preparation) =>
      [...dependencies.get(preparation.id.toString())!].every((dependency) =>
        !pending.has(dependency)
      )).sort(byId)
    if (ready.length === 0) throw new GraphLinkError({
      kind: "cycle", value: [...pending.keys()].sort().join(","), reason: "Preparation dependency cycle."
    })
    for (const preparation of ready) {
      pending.delete(preparation.id.toString())
      ordered.push(preparation)
    }
  }
  return ReleaseGraph.make({ artifacts, preparations: ordered, publications })
}
