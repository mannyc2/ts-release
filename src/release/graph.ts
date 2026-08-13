import * as Schema from "effect/Schema"
import * as Semver from "semver"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  EnvironmentName,
  ProviderId,
  ResolvedAuthStrategy,
  SubjectId,
  TokenAuthStrategy,
  TrustedPublishingAuthStrategy,
  TrustedPublishingSourceCommit
} from "../model/authority.js"
import {
  ArtifactCollectionContract,
  ArtifactCollectionSelector,
  cardinalitiesOverlap,
  cardinalityIssue,
  collectionContractIssue
} from "../model/artifact-collection.js"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath, Version } from "../model/primitives.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmAccess,
  NpmAuthentication,
  NpmDistTag,
  NpmProvenancePolicy,
  canonicalizeNpmRegistryEndpoint,
  type NpmAuthentication as NpmAuthenticationValue
} from "../recipes/config.js"

export class OutputDeclaration extends Schema.Class<OutputDeclaration>("OutputDeclaration")({
  id: OutputId, path: SafeRelativePath,
  kind: Schema.Literals(["file", "executable", "archive", "digest", "package"]),
  mediaType: Schema.optionalKey(Schema.NonEmptyString)
}) {}
const optional = Schema.optionalKey
const argv = Schema.NonEmptyArray(Schema.String)

export class GraphCommandCheck extends Schema.TaggedClass<GraphCommandCheck>()("GraphCommandCheck", {
  id: OperationId, argv, cwd: SafeRelativePath, inputs: Schema.Array(OutputId)
}) {}

export class GraphCommandArtifact extends Schema.TaggedClass<GraphCommandArtifact>()("GraphCommandArtifact", {
  id: OperationId, argv, cwd: SafeRelativePath,
  inputs: Schema.Array(OutputId), outputs: Schema.NonEmptyArray(OutputDeclaration)
}) {}

export class GraphCommandCollection extends Schema.TaggedClass<GraphCommandCollection>()("GraphCommandCollection", {
  id: OperationId, argv, cwd: SafeRelativePath,
  inputs: Schema.Array(OutputId), collection: ArtifactCollectionContract
}) {}

/** Package-scoped build whose directory outputs are consumed only by npm pack. */
export class GraphNpmPackageBuild extends Schema.TaggedClass<GraphNpmPackageBuild>()("GraphNpmPackageBuild", {
  id: OperationId,
  argv,
  cwd: SafeRelativePath,
  inputs: Schema.Array(OutputId),
  outputRoots: Schema.NonEmptyArray(SafeRelativePath)
}) {}

export class GraphArchive extends Schema.TaggedClass<GraphArchive>()("GraphArchive", {
  id: OperationId, inputs: Schema.Array(OutputId), output: OutputDeclaration,
  format: Schema.Literals(["tar.gz", "zip"])
}) {}

export class GraphChecksum extends Schema.TaggedClass<GraphChecksum>()("GraphChecksum", {
  id: OperationId, inputs: Schema.NonEmptyArray(OutputId), output: OutputDeclaration,
  algorithm: Schema.Literals(["sha256", "sha512"])
}) {}

export const GraphPreparation = Schema.Union([
  GraphCommandCheck, GraphCommandArtifact, GraphCommandCollection, GraphNpmPackageBuild,
  GraphArchive, GraphChecksum
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
  id: OperationId,
  packageArtifact: OutputId,
  packageName: NonEmptyName,
  version: Version,
  registryUrl: CanonicalNpmRegistryEndpoint,
  distTag: NpmDistTag,
  access: NpmAccess,
  authentication: NpmAuthentication,
  provenance: NpmProvenancePolicy,
  authority: PublicationAuthorityIntent
}) {}

export class GraphGitHubPublication extends Schema.TaggedClass<GraphGitHubPublication>()("GraphGitHubPublication", {
  id: OperationId, repository: Schema.NonEmptyString, tag: NonEmptyName, title: NonEmptyName,
  draft: Schema.Boolean, prerelease: Schema.Boolean, body: optional(Schema.String), bodyArtifact: optional(OutputId),
  assetIds: Schema.Array(OutputId), assetCollections: Schema.Array(ArtifactCollectionSelector),
  authority: PublicationAuthorityIntent
}) {}

export const GraphPublication = Schema.Union([GraphNpmPublication, GraphGitHubPublication])
export type GraphPublication = typeof GraphPublication.Type

export class CapabilityContribution extends Schema.Class<CapabilityContribution>("CapabilityContribution")({
  artifacts: Schema.Array(OutputDeclaration), preparations: Schema.Array(GraphPreparation),
  publications: Schema.Array(GraphPublication)
}) {}

export class ReleaseGraph extends Schema.Class<ReleaseGraph>("ReleaseGraph")({
  artifacts: Schema.Array(OutputDeclaration), collections: Schema.Array(ArtifactCollectionContract),
  preparations: Schema.Array(GraphPreparation),
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
  try { return canonicalizeNpmRegistryEndpoint(value) } catch (cause) {
    throw authorityError(
      "publish.npm.registry",
      cause instanceof Error ? cause.message : String(cause)
    )
  }
}

const tokenStrategy = (value: string, field: string): TokenAuthStrategy => {
  let name: EnvironmentName
  try { name = EnvironmentName.make(value) } catch {
    throw authorityError(field, "Credential references derived from tokenEnv must be portable environment variable names.")
  }
  return TokenAuthStrategy.make({ kind: "token", credential: CredentialRef.make(name) })
}

const anonymousStrategy = (): AnonymousAuthStrategy => AnonymousAuthStrategy.make({ kind: "anonymous" })

export interface NpmPublicationAuthorityInput {
  readonly packageName: string
  readonly version: string
  readonly registryUrl: string
  readonly distTag: string
  readonly authentication: NpmAuthenticationValue
  readonly sourceCommit?: string
}

/** Resolve npm auth once; no secret value enters the graph or prepared state. */
export const makeNpmPublicationAuthorityIntent = (
  input: NpmPublicationAuthorityInput
): PublicationAuthorityIntent => {
  const version = input.version
  let tag: string
  try { tag = NpmDistTag.make(input.distTag) } catch (cause) {
    throw authorityError(
      "publish.npm.distTag",
      cause instanceof Error ? cause.message : String(cause)
    )
  }
  if (Semver.prerelease(version) !== null && tag === "latest") {
    throw authorityError("publish.npm.distTag", "npm prerelease publication requires a non-latest dist-tag.")
  }
  const provider = ProviderId.make("npm")
  const publishStrategy: ResolvedAuthStrategy = input.authentication.strategy === "token"
    ? tokenStrategy(input.authentication.credential, "publish.npm.authentication.credential")
    : (() => {
      let sourceCommit: TrustedPublishingSourceCommit
      try {
        sourceCommit = TrustedPublishingSourceCommit.make(input.sourceCommit ?? "")
      } catch {
        throw authorityError(
          "source.commit",
          "npm trusted publishing requires a lowercase full Git SHA (40 or 64 hex characters)."
        )
      }
      return TrustedPublishingAuthStrategy.make({
        kind: "trusted-publishing", identityProvider: input.authentication.attestation.provider,
        runnerClass: input.authentication.attestation.runner,
        repository: input.authentication.attestation.repository,
        workflow: `.github/workflows/${input.authentication.attestation.workflow}`,
        workflowRef: input.authentication.attestation.workflowRef,
        sourceCommit,
        provenanceEnvironmentContract: "github-actions-npm-provenance-v1",
        allowedAction: input.authentication.attestation.allowedAction,
        publisherSink: "certified-npm-cli"
      })
    })()
  return PublicationAuthorityIntent.make({
    subject: SubjectId.make(`npm:${input.packageName}@${input.version}`),
    provider,
    audience: CanonicalAudience.make(canonicalizeRegistryUrl(input.registryUrl)),
    // Public registry observation is anonymous. This graph deliberately has
    // no authenticated npm read strategy: custom/private reads remain
    // unsupported until they receive a distinct typed read credential.
    observationStrategies: [anonymousStrategy()],
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
  readonly distTag: string
  readonly access: "public" | "restricted"
  readonly authentication: NpmAuthenticationValue
  readonly provenance: "automatic" | "required" | "disabled"
  readonly authority: PublicationAuthorityIntent
}): string | undefined => {
  const version = publication.version.toString()
  if (Semver.valid(version) !== version) {
    return "npm publication version must be canonical SemVer."
  }
  if (Semver.prerelease(version) !== null && publication.distTag === "latest") {
    return "npm prerelease publication must use an explicit non-latest dist-tag."
  }
  if (publication.access === "restricted" && !publication.packageName.toString().startsWith("@")) {
    return "npm restricted access is valid only for scoped package names."
  }
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
    return publication.authentication.strategy === "token" && publication.provenance !== "automatic" &&
        authority.publishStrategy.credential === publication.authentication.credential &&
        authority.observationStrategies.length === 1
      ? undefined
      : "npm token publication requires the exact configured mutation token, explicit provenance, and anonymous-only observation."
  }
  if (authority.publishStrategy.kind === "trusted-publishing") {
    const authentication = publication.authentication
    return authentication.strategy === "trusted-publishing" &&
        publication.registryUrl === "https://registry.npmjs.org/" &&
        authentication.attestation.allowedAction === "npm-publish-direct" &&
        authority.observationStrategies.length === 1 &&
        authority.publishStrategy.identityProvider === "github-actions" &&
        authority.publishStrategy.runnerClass === authentication.attestation.runner &&
        authority.publishStrategy.repository === authentication.attestation.repository &&
        authority.publishStrategy.workflow === `.github/workflows/${authentication.attestation.workflow}` &&
        authority.publishStrategy.workflowRef === authentication.attestation.workflowRef &&
        /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(authority.publishStrategy.sourceCommit) &&
        authority.publishStrategy.provenanceEnvironmentContract === "github-actions-npm-provenance-v1" &&
        authority.publishStrategy.allowedAction === authentication.attestation.allowedAction &&
        authority.publishStrategy.publisherSink === "certified-npm-cli"
      ? undefined
      : "npm trusted publishing requires the exact direct-publish attestation, hosted workflow identity/ref, and certified npm sink."
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
    : preparation._tag === "GraphArchive" || preparation._tag === "GraphChecksum"
    ? [preparation.output] : []

const pathsOverlap = (left: string, right: string): boolean =>
  left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)
const portablePathsOverlap = (left: string, right: string): boolean =>
  pathsOverlap(left.toLocaleLowerCase("en-US"), right.toLocaleLowerCase("en-US"))

export const linkContributions = (
  contributions: ReadonlyArray<CapabilityContribution>
): ReleaseGraph => {
  const contributedPreparations = contributions.flatMap((item) => item.preparations)
  const collections = contributedPreparations.flatMap((preparation) =>
    preparation._tag === "GraphCommandCollection" ? [preparation.collection] : [])
    .sort(byId)
  const collectionIds = new Map<string, ArtifactCollectionContract>()
  const collectionRoots = new Map<string, string>()
  for (const collection of collections) {
    const id = collection.id.toString()
    const previousId = [...collectionIds.keys()].find((candidate) =>
      candidate.toLocaleLowerCase("en-US") === id.toLocaleLowerCase("en-US"))
    if (previousId !== undefined) throw new GraphLinkError({
      kind: "duplicate", value: id,
      reason: `Artifact collection id collides with ${previousId} under portable case folding.`
    })
    const issue = cardinalityIssue(collection.cardinality)
    if (issue !== undefined) throw new GraphLinkError({ kind: "reference", value: id, reason: issue })
    const contractIssue = collectionContractIssue(collection)
    if (contractIssue !== undefined) throw new GraphLinkError({
      kind: "reference", value: id, reason: contractIssue
    })
    const root = collection.root.toString()
    const previousRoot = [...collectionRoots.entries()].find(([candidate]) => portablePathsOverlap(candidate, root))
    if (previousRoot !== undefined) throw new GraphLinkError({
      kind: "path", value: root,
      reason: `Artifact collection roots ${previousRoot[0]} (${previousRoot[1]}) and ${root} (${id}) overlap.`
    })
    collectionIds.set(id, collection)
    collectionRoots.set(root, id)
  }
  const declared = contributions.flatMap((item) => item.artifacts)
  const allPreparationOutputs = contributions.flatMap((item) => item.preparations.flatMap(preparationOutputs))
  const artifactIds = new Set<string>()
  for (const artifact of [...declared, ...allPreparationOutputs]) {
    if (artifactIds.has(artifact.id.toString())) throw new GraphLinkError({
      kind: "duplicate", value: artifact.id.toString(), reason: "Artifact id has more than one declaration or producer."
    })
    artifactIds.add(artifact.id.toString())
  }
  const artifacts = [...declared, ...allPreparationOutputs].sort(byId)
  const paths = new Map<string, string>()
  for (const artifact of artifacts) {
    const path = artifact.path.toString()
    const previous = paths.get(path)
    if (previous !== undefined && previous !== artifact.id.toString()) throw new GraphLinkError({
      kind: "path", value: path, reason: `Artifacts ${previous} and ${artifact.id} share one output path.`
    })
    paths.set(path, artifact.id.toString())
    if (artifact.kind !== "package") {
      const collection = [...collectionRoots.entries()].find(([root]) => portablePathsOverlap(root, path))
      if (collection !== undefined) throw new GraphLinkError({
        kind: "path", value: path,
        reason: `Artifact ${artifact.id} overlaps collection root ${collection[0]} (${collection[1]}).`
      })
    }
  }
  const preparations = contributedPreparations.sort(byId)
  const operationIds = new Set<string>()
  const producers = new Map<string, string>()
  for (const preparation of preparations) {
    const id = preparation.id.toString()
    if (operationIds.has(id)) throw new GraphLinkError({
      kind: "duplicate", value: id, reason: "Preparation id has more than one producer."
    })
    operationIds.add(id)
    if (preparation._tag === "GraphNpmPackageBuild") {
      const cwd = preparation.cwd.toString()
      const roots = preparation.outputRoots.map(String)
      if (new Set(roots.map((root) => root.toLocaleLowerCase("en-US"))).size !== roots.length) {
        throw new GraphLinkError({ kind: "path", value: id, reason: "npm package build output roots must be unique." })
      }
      for (let index = 0; index < roots.length; index += 1) {
        const root = roots[index]!
        if (cwd !== "." && root !== cwd && !root.startsWith(`${cwd}/`)) throw new GraphLinkError({
          kind: "path", value: root, reason: "npm package build output roots must remain inside npmPackage.path."
        })
        if (artifacts.some((artifact) => artifact.kind !== "package" && portablePathsOverlap(root, artifact.path.toString())) ||
            [...collectionRoots.keys()].some((collection) => portablePathsOverlap(root, collection))) throw new GraphLinkError({
          kind: "path", value: root, reason: "npm package build output roots cannot overlap captured artifacts or collections."
        })
        for (const other of roots.slice(index + 1)) if (portablePathsOverlap(root, other)) throw new GraphLinkError({
          kind: "path", value: root, reason: `npm package build output roots ${root} and ${other} overlap.`
        })
      }
    }
    if (preparation._tag === "GraphCommandCollection" && preparation.collection.producer.toString() !== id) {
      throw new GraphLinkError({
        kind: "reference", value: preparation.collection.id.toString(),
        reason: `Artifact collection declares producer ${preparation.collection.producer} but is owned by ${id}.`
      })
    }
    if (preparation._tag === "GraphCommandCollection") {
      const root = preparation.collection.root.toString()
      const overlap = preparation.inputs.map((input) => artifacts.find((artifact) => artifact.id === input))
        .find((artifact) => artifact !== undefined && portablePathsOverlap(root, artifact.path.toString()))
      if (overlap !== undefined) throw new GraphLinkError({
        kind: "path", value: root,
        reason: `Artifact collection root overlaps read-only input ${overlap.id} at ${overlap.path}.`
      })
    }
    for (const input of preparationInputs(preparation)) {
      if (!artifactIds.has(input.toString())) throw new GraphLinkError({
        kind: "missing", value: input.toString(), reason: `Preparation ${id} references no artifact.`
      })
    }
    for (const output of preparationOutputs(preparation)) {
      const outputId = output.id.toString()
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
    const references = preparation._tag === "GraphCommandCheck" || preparation._tag === "GraphCommandArtifact" ||
        preparation._tag === "GraphCommandCollection" || preparation._tag === "GraphNpmPackageBuild"
      ? preparation.argv.flatMap((part) => [...part.matchAll(/\{(input|output|collection):([^}]+)\}/gu)]) : []
    for (const reference of references) {
      const direction = reference[1]
      const referenced = reference[2] ?? ""
      if (direction === "input" && !preparationInputs(preparation).some((input) => input.toString() === referenced)) {
        throw new GraphLinkError({ kind: "reference", value: referenced, reason: "Command input reference is undeclared." })
      }
      if (direction === "output" && !preparationOutputs(preparation).some((output) => output.id.toString() === referenced)) {
        throw new GraphLinkError({ kind: "reference", value: referenced, reason: "Command output reference is undeclared." })
      }
      if (direction === "collection" && (preparation._tag !== "GraphCommandCollection" ||
          preparation.collection.id.toString() !== referenced)) {
        throw new GraphLinkError({ kind: "reference", value: referenced, reason: "Command collection reference is undeclared." })
      }
    }
    if (preparation._tag === "GraphCommandCheck" || preparation._tag === "GraphCommandArtifact" ||
        preparation._tag === "GraphCommandCollection" || preparation._tag === "GraphNpmPackageBuild") {
      for (const part of preparation.argv) {
        for (const token of part.matchAll(/\{([^}]+)\}/gu)) {
          const value = token[1] ?? ""
          if (!value.startsWith("input:") && !value.startsWith("output:") && !value.startsWith("collection:")) throw new GraphLinkError({
            kind: "reference", value, reason: "Command paths support only declared input, output, and collection references."
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
    if (publication._tag === "GraphGitHubPublication") {
      const selected = new Set<string>()
      for (const selector of publication.assetCollections) {
        const id = selector.collection.toString()
        if (selected.has(id)) throw new GraphLinkError({
          kind: "duplicate", value: id, reason: "GitHub publication repeats one artifact collection selector."
        })
        selected.add(id)
        const contract = collectionIds.get(id)
        if (contract === undefined) throw new GraphLinkError({
          kind: "missing", value: id, reason: "GitHub publication selector references no artifact collection."
        })
        const issue = cardinalityIssue(selector.cardinality)
        if (issue !== undefined) throw new GraphLinkError({ kind: "reference", value: id, reason: issue })
        if (!cardinalitiesOverlap(contract.cardinality, selector.cardinality)) throw new GraphLinkError({
          kind: "reference", value: id,
          reason: "GitHub publication cardinality cannot be satisfied by the producer collection contract."
        })
        if (selector.artifactKind !== contract.artifactKind || selector.pathSuffix !== contract.pathSuffix ||
            selector.mediaType !== contract.mediaType) throw new GraphLinkError({
          kind: "reference", value: id,
          reason: "GitHub publication selector kind, path suffix, and media type must exactly match its collection contract."
        })
      }
    }
    const ids = publication._tag === "GraphGitHubPublication"
      ? [...publication.assetIds, ...(publication.bodyArtifact === undefined ? [] : [publication.bodyArtifact])]
      : [publication.packageArtifact]
    for (const id of ids) if (!artifactIds.has(id.toString()) && !producers.has(id.toString())) {
      throw new GraphLinkError({ kind: "missing", value: id.toString(), reason: "Publication references no artifact." })
    }
    if (publication._tag === "GraphNpmPublication") {
      const packageArtifact = artifacts.find((artifact) => artifact.id === publication.packageArtifact)
      if (packageArtifact?.kind !== "package") throw new GraphLinkError({
        kind: "reference", value: publication.packageArtifact.toString(),
        reason: "npm publication must reference exactly one declared package artifact."
      })
      if (publication.access === "restricted" && !publication.packageName.startsWith("@")) throw new GraphLinkError({
        kind: "reference", value: publication.packageName.toString(),
        reason: "npm restricted access is valid only for scoped package names."
      })
    }
    if (publication._tag === "GraphGitHubPublication" && publication.bodyArtifact !== undefined) {
      const body = artifacts.find((artifact) => artifact.id.toString() === publication.bodyArtifact!.toString())
      if (body === undefined || body.mediaType === undefined || !body.mediaType.startsWith("text/")) throw new GraphLinkError({
        kind: "reference", value: publication.bodyArtifact.toString(), reason: "GitHub body artifacts must declare a text/* media type."
      })
    }
    if (publication._tag === "GraphGitHubPublication") {
      for (const id of publication.assetIds) {
        const asset = artifacts.find((artifact) => artifact.id.toString() === id.toString())
        if (asset === undefined || asset.kind === "package") throw new GraphLinkError({
          kind: "reference", value: id.toString(), reason: "GitHub assets must be capturable file artifacts."
        })
      }
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
  return ReleaseGraph.make({ artifacts, collections, preparations: ordered, publications })
}
