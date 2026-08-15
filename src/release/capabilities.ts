import { basename } from "node:path"
import * as Schema from "effect/Schema"
import {
  ArtifactCardinality,
  ArtifactCollectionContract,
  ArtifactCollectionId,
  ArtifactCollectionSelector
} from "../model/artifact-collection.js"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath } from "../model/primitives.js"
import { parseSha256Hex } from "../model/digest.js"
import {
  CatalogRenderSource,
  HomebrewRenderer,
  ScoopRenderer,
  GitHubRepositoryCoordinate,
  canonicalCatalogVersion,
  type CatalogRenderer
} from "../model/catalog.js"
import { bunArtifactTarget } from "../capabilities/bun-targets.js"
import {
  NpmAuthentication,
  PyPiAuthentication,
  pypiRepositoryEndpoints,
  type CandidateConfig,
  type CandidateHomebrewCatalog,
  type CandidateScoopCatalog
} from "../recipes/config.js"
import { CapabilityContribution, GraphArchive, GraphChecksum, GraphCommandArtifact, GraphCommandCollection, GraphLinkError,
  GraphCommandCheck, GraphGitHubPublication, GraphNpmPackageBuild, GraphNpmPublication,
  GraphPrepackedNpmPublication, GraphPyPiDistribution,
  GraphPyPiPublication, GraphCatalogRender, GraphCatalogPublication, OutputDeclaration,
  makeCatalogPublicationAuthorityIntent, makeGitHubPublicationAuthorityIntent,
  makeNpmPublicationAuthorityIntent, makePyPiPublicationAuthorityIntent } from "./graph.js"
import type { VerifiedReleaseContext } from "./context.js"

const output = (id: string | OutputId, location: string, kind: OutputDeclaration["kind"], mediaType?: string) =>
  OutputDeclaration.make({ id: OutputId.make(id.toString()), path: SafeRelativePath.make(location), kind,
    ...(mediaType === undefined ? {} : { mediaType }) })
const compact = (name: string) => name.replace(/^@/u, "").replaceAll("/", "-").replace(/[^A-Za-z0-9._-]+/gu, "-")
  .replace(/^-+|-+$/gu, "")
const decodeCardinality = Schema.decodeUnknownSync(ArtifactCardinality, { onExcessProperty: "error" })
const decodeCollectionSelector = Schema.decodeUnknownSync(ArtifactCollectionSelector, { onExcessProperty: "error" })
const render = (value: string, config: CandidateConfig, target = "", binary = compact(config.project.name)) => {
  const [os = "", arch = ""] = target.split("-")
  return value.replaceAll("{name}", compact(config.project.name)).replaceAll("{version}", config.project.version)
    .replaceAll("{tag}", config.project.tag).replaceAll("{targetTriple}", target).replaceAll("{target}", target)
    .replaceAll("{os}", os).replaceAll("{arch}", arch).replaceAll("{binary}", binary)
    .replaceAll("{ext}", os === "windows" ? ".exe" : "")
}
export const contributeSourceArtifacts = (
  config: CandidateConfig,
  _context: VerifiedReleaseContext
): CapabilityContribution => {
  const artifacts: OutputDeclaration[] = []
  const preparations: (GraphCommandArtifact | GraphCommandCollection | GraphCommandCheck | GraphNpmPackageBuild)[] = []
  for (const artifact of config.artifacts ?? []) {
    artifacts.push(output(artifact.id, render(artifact.path, config),
      artifact.format === "zip" || artifact.format === "tarball" ? "archive" : artifact.format))
  }
  for (const publication of config.publish?.prepackedNpm ?? []) {
    artifacts.push(output(
      `prepacked-npm:${publication.id}`,
      publication.path.toString(),
      "archive",
      "application/gzip"
    ))
  }
  if (config.npmPackage !== undefined) {
    const declaration = output("npm-package", config.npmPackage.path ?? ".", "package")
    artifacts.push(declaration)
    if (config.npmPackage.build !== undefined) {
      const packageRoot = config.npmPackage.path?.toString() ?? "."
      const rooted = (path: SafeRelativePath): SafeRelativePath => SafeRelativePath.make(
        packageRoot === "." ? path.toString() : `${packageRoot}/${path}`
      )
      preparations.push(GraphNpmPackageBuild.make({
        id: OperationId.make("build:npm-package"),
        argv: config.npmPackage.build.run,
        cwd: SafeRelativePath.make(packageRoot),
        inputs: [],
        outputRoots: config.npmPackage.build.outputRoots.map(rooted) as [SafeRelativePath, ...SafeRelativePath[]]
      }))
    }
    preparations.push(GraphCommandCheck.make({
      id: OperationId.make("declare:npm-package"), argv: ["test", "-d", declaration.path], cwd: SafeRelativePath.make("."),
      inputs: [declaration.id]
    }))
  }
  for (const build of config.builds ?? []) {
    for (const target of build.targets) {
      const binary = build.binary ?? compact(config.project.name)
      const id = `${build.id ?? build.builder}-${target}`
      const location = render(build.output ?? `.release/artifacts/${binary}-${config.project.version}-${target}${target.startsWith("windows-") ? ".exe" : ""}`, config, target, binary)
      const declaration = output(id, location, "executable")
      if (build.builder === "prebuilt") {
        artifacts.push(declaration)
        preparations.push(GraphCommandCheck.make({
        id: OperationId.make(`build:prebuilt:${id}:exists`), argv: ["test", "-f", location], cwd: SafeRelativePath.make("."),
        inputs: [declaration.id]
        }))
      } else {
        const argv = build.builder === "command" ? build.run.map((part) => render(part, config, target, binary)) : [
          "bun", "build", render(build.entry, config, target, binary), "--compile", "--target", bunArtifactTarget(target).bunTarget,
          "--outfile", location, ...(build.minify === true ? ["--minify"] : [])
        ]
        preparations.push(GraphCommandArtifact.make({
          id: OperationId.make(`build:${build.builder}:${id}`), argv: [argv[0]!, ...argv.slice(1)], cwd: SafeRelativePath.make("."),
          inputs: [], outputs: [declaration]
        }))
      }
    }
  }
  for (const preparation of config.preparations ?? []) {
    const inputs = preparation.inputs ?? []
    const cwd = preparation.cwd ?? SafeRelativePath.make(".")
    if (preparation.kind === "check") preparations.push(GraphCommandCheck.make({
      id: OperationId.make(`preparation:${preparation.id}`), argv: preparation.run,
      cwd, inputs
    }))
    else {
      const id = OperationId.make(`preparation:${preparation.id}`)
      if ("outputs" in preparation) preparations.push(GraphCommandArtifact.make({
        id, argv: preparation.run,
        cwd, inputs,
        outputs: [
          output(preparation.outputs[0]!.id, render(preparation.outputs[0]!.path, config), preparation.outputs[0]!.kind ?? "file", preparation.outputs[0]!.mediaType),
          ...preparation.outputs.slice(1).map((item) =>
            output(item.id, render(item.path, config), item.kind ?? "file", item.mediaType))
        ]
      }))
      else preparations.push(GraphCommandCollection.make({
        id, argv: preparation.run, cwd, inputs,
        collection: ArtifactCollectionContract.make({
          id: ArtifactCollectionId.make(preparation.id.toString()),
          producer: id,
          root: preparation.collection.root,
          artifactKind: preparation.collection.artifactKind,
          pathSuffix: preparation.collection.pathSuffix,
          mediaType: preparation.collection.mediaType,
          cardinality: decodeCardinality(preparation.collection.cardinality)
        })
      }))
    }
  }
  return CapabilityContribution.make({ artifacts, preparations, publications: [] })
}

export const contributePackages = (
  config: CandidateConfig,
  artifacts: ReadonlyArray<OutputDeclaration>,
  _context: VerifiedReleaseContext
): CapabilityContribution => {
  const preparations: (GraphArchive | GraphChecksum)[] = []
  const packageOutputs: OutputDeclaration[] = []
  for (const archive of config.archives ?? []) {
    const inputs = archive.ids === undefined
      ? artifacts.filter((item) => item.kind !== "package").map((item) => item.id)
      : archive.ids
    for (const format of archive.formats ?? ["tar.gz"]) {
      const base = render(archive.nameTemplate ?? `${compact(config.project.name)}_{version}`, config)
      const id = `${archive.id ?? "archive"}${(archive.formats ?? ["tar.gz"]).length > 1 ? `-${format.replaceAll(".", "-")}` : ""}`
      const declaration = output(id, `.release/artifacts/${base}.${format}`, "archive")
      packageOutputs.push(declaration)
      preparations.push(GraphArchive.make({ id: OperationId.make(`archive:${id}`), inputs, output: declaration, format }))
    }
  }
  const checksumInputs = [...artifacts, ...packageOutputs].filter((item) =>
    item.kind !== "package" && item.kind !== "digest")
  if (config.checksum !== undefined) {
    const algorithm = config.checksum.algorithm
    if (checksumInputs.length === 0) {
      throw new GraphLinkError({
        kind: "reference",
        value: "checksum",
        reason: "Checksum configuration requires at least one capturable artifact."
      })
    }
    preparations.push(GraphChecksum.make({ id: OperationId.make("checksum:digest"), inputs: [checksumInputs[0]!.id, ...checksumInputs.slice(1).map((item) => item.id)],
      output: output("checksum-digests", `.release/facts/checksum-${algorithm}`, "digest"), algorithm }))
  }
  return CapabilityContribution.make({ artifacts: [], preparations, publications: [] })
}

interface CatalogRenderRow {
  readonly id: string
  readonly renderer: CatalogRenderer
  readonly sources: readonly [CatalogRenderSource, ...Array<CatalogRenderSource>]
  readonly output: OutputDeclaration
}

const catalogRows = (
  config: CandidateConfig,
  artifacts: ReadonlyArray<OutputDeclaration>,
  selected: "homebrew" | "scoop" | "all" = "all"
): ReadonlyArray<CatalogRenderRow> => {
  const repository = config.publish?.github?.repository ?? config.project.repository
  const rows: Array<CatalogRenderRow> = []
  const build = (
    kind: "homebrew" | "scoop",
    catalog: NonNullable<NonNullable<CandidateConfig["catalogs"]>[typeof kind]>[number]
  ): CatalogRenderRow => {
    if (repository === undefined || !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(repository)) {
      throw new GraphLinkError({
        kind: "reference", value: `catalogs.${kind}`,
        reason: "Catalog download URLs require one exact GitHub source repository."
      })
    }
    const sources = catalog.sources.map((source) => {
      const artifact = artifacts.find((candidate) => candidate.id.toString() === source.artifact.toString())
      if (artifact === undefined || artifact.kind !== "archive") throw new GraphLinkError({
        kind: "reference", value: source.artifact.toString(),
        reason: `${kind} catalogs require declared archive artifacts.`
      })
      const filename = NonEmptyName.make(basename(artifact.path.toString()))
      return CatalogRenderSource.make({
        artifactId: source.artifact,
        architecture: source.architecture,
        filename,
        url: `https://github.com/${repository}/releases/download/${encodeURIComponent(config.project.tag)}/${encodeURIComponent(filename)}`
      })
    }).sort((left, right) => left.architecture < right.architecture ? -1 : left.architecture > right.architecture ? 1 : 0)
    if (new Set(sources.map((source) => source.architecture)).size !== sources.length) throw new GraphLinkError({
      kind: "duplicate", value: catalog.id.toString(), reason: `${kind} catalog repeats one architecture.`
    })
    if (kind === "scoop" && sources.some((source) => !source.filename.toString().endsWith(".zip"))) throw new GraphLinkError({
      kind: "reference", value: catalog.id.toString(), reason: "Scoop catalogs support ZIP archives only."
    })
    const renderer = kind === "homebrew"
      ? HomebrewRenderer.make({
        name: (catalog as CandidateHomebrewCatalog).formulaName,
        description: catalog.description,
        homepage: catalog.homepage,
        ...(catalog.license === undefined ? {} : { license: catalog.license }),
        installPath: (catalog as CandidateHomebrewCatalog).installPath
      })
      : ScoopRenderer.make({
        name: (catalog as CandidateScoopCatalog).manifestName,
        description: catalog.description,
        homepage: catalog.homepage,
        ...(catalog.license === undefined ? {} : { license: catalog.license }),
        bin: (catalog as CandidateScoopCatalog).bin
      })
    return {
      id: catalog.id.toString(),
      renderer,
      sources: sources as [CatalogRenderSource, ...Array<CatalogRenderSource>],
      output: output(
        `catalog-${catalog.id}`,
        `.release/catalogs/${catalog.id}.${kind === "homebrew" ? "rb" : "json"}`,
        "file",
        kind === "homebrew" ? "text/x-ruby" : "application/json"
      )
    }
  }
  if (selected !== "scoop") for (const catalog of config.catalogs?.homebrew ?? []) rows.push(build("homebrew", catalog))
  if (selected !== "homebrew") for (const catalog of config.catalogs?.scoop ?? []) rows.push(build("scoop", catalog))
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new GraphLinkError({
    kind: "duplicate", value: "catalogs", reason: "Catalog renderer ids must be unique across Homebrew and Scoop."
  })
  if (rows.length > 0) canonicalCatalogVersion(config.project.version.toString())
  return rows
}

export const contributeCatalogRendering = (
  config: CandidateConfig,
  artifacts: ReadonlyArray<OutputDeclaration>,
  kind: "homebrew" | "scoop"
): CapabilityContribution => CapabilityContribution.make({
  artifacts: [],
  preparations: catalogRows(config, artifacts, kind).map((row) => GraphCatalogRender.make({
    id: OperationId.make(`catalog:render:${row.id}`),
    inputs: row.sources.map((source) => source.artifactId) as [OutputId, ...Array<OutputId>],
    output: row.output,
    version: config.project.version,
    renderer: row.renderer,
    sources: row.sources
  })),
  publications: []
})

export const contributeCatalogPublications = (
  config: CandidateConfig,
  artifacts: ReadonlyArray<OutputDeclaration>
): CapabilityContribution => {
  const destinations = config.publish?.catalogGit
  if (destinations === undefined) return CapabilityContribution.make({ artifacts: [], preparations: [], publications: [] })
  const rows = catalogRows(config, artifacts)
  const sourceRepository = config.publish?.github?.repository ?? config.project.repository
  if (config.publish?.github === undefined || sourceRepository === undefined) throw new GraphLinkError({
    kind: "reference", value: "publish.catalogGit",
    reason: "Catalog delivery requires an installed GitHub release publication for every referenced download."
  })
  const selectedGithubIds = config.publish.github.ids ?? artifacts.filter((artifact) =>
    ["archive", "executable", "file", "digest"].includes(artifact.kind)).map((artifact) => artifact.id)
  const publications = destinations.map((destination) => {
    const row = rows.find((candidate) => candidate.id === destination.catalog.toString())
    if (row === undefined) throw new GraphLinkError({
      kind: "missing", value: destination.catalog.toString(), reason: "Catalog delivery references no typed renderer."
    })
    if (row.sources.some((source) => !selectedGithubIds.some((id) => id.toString() === source.artifactId.toString()))) {
      throw new GraphLinkError({
        kind: "reference", value: destination.catalog.toString(),
        reason: "Catalog delivery is blocked unless every download artifact belongs to the exact GitHub release publication."
      })
    }
    const targetPath = destination.targetPath.toString()
    const statePath = destination.statePath.toString()
    if (targetPath === statePath || targetPath.startsWith(`${statePath}/`) || statePath.startsWith(`${targetPath}/`)) {
      throw new GraphLinkError({
        kind: "path", value: targetPath, reason: "Catalog target and managed-state paths must be disjoint files."
      })
    }
    return GraphCatalogPublication.make({
      id: OperationId.make(`zz:catalog-git:${row.id}`),
      catalogId: NonEmptyName.make(row.id),
      targetArtifact: row.output.id,
      repository: destination.repository,
      branch: destination.branch,
      targetPath: destination.targetPath,
      statePath: destination.statePath,
      version: config.project.version,
      sourceRepository: GitHubRepositoryCoordinate.make(sourceRepository),
      sourceTag: config.project.tag,
      renderer: row.renderer,
      sources: row.sources,
      authority: makeCatalogPublicationAuthorityIntent({
        repository: destination.repository,
        branch: destination.branch,
        targetPath: destination.targetPath,
        statePath: destination.statePath,
        tokenEnv: destination.tokenEnv
      })
    })
  })
  return CapabilityContribution.make({ artifacts: [], preparations: [], publications })
}

export const contributeNpmPublication = (
  config: CandidateConfig,
  context: VerifiedReleaseContext
): CapabilityContribution => {
  const intent = config.publish?.npm
  const prepacked = config.publish?.prepackedNpm
  if (intent !== undefined && prepacked !== undefined) throw new GraphLinkError({
    kind: "reference",
    value: "publish.prepackedNpm",
    reason: "Source-pack and prepacked npm publication modes are mutually exclusive."
  })
  if (prepacked !== undefined) {
    const publications = prepacked.map((subject) => {
      const authentication = Schema.decodeUnknownSync(NpmAuthentication, {
        onExcessProperty: "error"
      })(subject.authentication)
      return GraphPrepackedNpmPublication.make({
        id: OperationId.make(`npm:${subject.id}`),
        packageArtifact: OutputId.make(`prepacked-npm:${subject.id}`),
        packageName: NonEmptyName.make(subject.packageName),
        version: subject.version,
        sha256: parseSha256Hex(subject.sha256),
        registryUrl: subject.registry,
        distTag: subject.distTag,
        access: subject.access,
        authentication,
        provenance: subject.provenance,
        authority: makeNpmPublicationAuthorityIntent({
          packageName: subject.packageName,
          version: subject.version.toString(),
          registryUrl: subject.registry,
          distTag: subject.distTag,
          authentication,
          sourceCommit: context.source.commit.toString()
        })
      })
    })
    return CapabilityContribution.make({ artifacts: [], preparations: [], publications })
  }
  if (intent === undefined) return CapabilityContribution.make({ artifacts: [], preparations: [], publications: [] })
  // Resolution is intentionally plain durable data. Decode the nested variant
  // exactly once as it enters the class-backed graph IR.
  const authentication = Schema.decodeUnknownSync(NpmAuthentication, {
    onExcessProperty: "error"
  })(intent.authentication)
  const publication = GraphNpmPublication.make({
    id: OperationId.make("npm:npm-release"),
    packageArtifact: intent.packageArtifact,
    packageName: intent.packageName,
    version: config.project.version,
    registryUrl: intent.registry,
    distTag: intent.distTag,
    access: intent.access,
    authentication,
    provenance: intent.provenance,
    authority: makeNpmPublicationAuthorityIntent({
      packageName: intent.packageName.toString(),
      version: config.project.version.toString(),
      registryUrl: intent.registry,
      distTag: intent.distTag,
      authentication,
      sourceCommit: context.source.commit.toString()
    })
  })
  return CapabilityContribution.make({ artifacts: [], preparations: [], publications: [publication] })
}

export const contributeGitHubPublication = (
  config: CandidateConfig,
  artifacts: ReadonlyArray<OutputDeclaration>
): CapabilityContribution => {
  const authored = config.publish?.github
  const repository = authored?.repository ?? config.project.repository
  if (authored === undefined || repository === undefined) return CapabilityContribution.make({ artifacts: [], preparations: [], publications: [] })
  const publication = GraphGitHubPublication.make({
    id: OperationId.make("github:github-release"),
    repository,
    tag: config.project.tag,
    draft: authored.draft ?? true,
    prerelease: authored.prerelease === "auto"
      ? config.project.version.includes("-")
      : authored.prerelease ?? false,
    title: NonEmptyName.make(`${config.project.name} ${config.project.version}`),
    ...(authored.bodyArtifact === undefined
      ? authored.body === undefined ? {} : { body: authored.body }
      : { bodyArtifact: authored.bodyArtifact }),
    assetIds: authored.ids ?? artifacts.filter((item) =>
      ["archive", "executable", "file", "digest"].includes(item.kind)).map((item) => item.id),
    assetCollections: (authored.collections ?? []).map(decodeCollectionSelector),
    authority: makeGitHubPublicationAuthorityIntent({
      repository,
      tag: config.project.tag.toString(),
      ...(authored.tokenEnv === undefined ? {} : { tokenEnv: authored.tokenEnv })
    })
  })
  return CapabilityContribution.make({ artifacts: [], preparations: [], publications: [publication] })
}

export const contributePyPiPublication = (
  config: CandidateConfig,
  context: VerifiedReleaseContext,
  artifacts: ReadonlyArray<OutputDeclaration>
): CapabilityContribution => {
  const intent = config.publish?.pypi
  if (intent === undefined) return CapabilityContribution.make({ artifacts: [], preparations: [], publications: [] })
  const authentication = Schema.decodeUnknownSync(PyPiAuthentication, {
    onExcessProperty: "error"
  })(intent.authentication)
  const endpoints = pypiRepositoryEndpoints(intent.repository)
  const files = intent.artifacts.map((id) => {
    const declaration = artifacts.find((artifact) => artifact.id.toString() === id.toString())
    if (declaration === undefined) throw new GraphLinkError({
      kind: "missing", value: id.toString(), reason: "PyPI publication references no declared artifact."
    })
    const filename = basename(declaration.path.toString())
    return GraphPyPiDistribution.make({
      artifactId: id,
      filename: NonEmptyName.make(filename),
      authority: makePyPiPublicationAuthorityIntent({
        project: intent.project,
        version: intent.version,
        filename,
        repository: intent.repository,
        authentication,
        sourceCommit: context.source.commit.toString()
      })
    })
  }) as [GraphPyPiDistribution, ...Array<GraphPyPiDistribution>]
  return CapabilityContribution.make({
    artifacts: [], preparations: [], publications: [GraphPyPiPublication.make({
      id: OperationId.make("pypi:pypi-release"),
      project: intent.project,
      version: intent.version,
      repository: intent.repository,
      simpleBaseUrl: endpoints.simpleBaseUrl,
      projectUrl: `${endpoints.simpleBaseUrl}${encodeURIComponent(intent.project)}/`,
      uploadUrl: endpoints.uploadUrl,
      authentication,
      files
    })]
  })
}

export const contributeRelease = (config: CandidateConfig, context: VerifiedReleaseContext): ReadonlyArray<CapabilityContribution> => {
  const build = contributeSourceArtifacts(config, context)
  const buildOutputs = [...build.artifacts, ...build.preparations.flatMap(preparationOutputs)]
  const packaged = contributePackages(config, buildOutputs, context)
  const allArtifacts = [...buildOutputs, ...packaged.preparations.flatMap(preparationOutputs)]
  const homebrew = contributeCatalogRendering(config, allArtifacts, "homebrew")
  const scoop = contributeCatalogRendering(config, allArtifacts, "scoop")
  const renderedArtifacts = [...allArtifacts, ...homebrew.preparations.flatMap(preparationOutputs), ...scoop.preparations.flatMap(preparationOutputs)]
  return [
    build,
    packaged,
    homebrew,
    scoop,
    contributeNpmPublication(config, context),
    contributePyPiPublication(config, context, renderedArtifacts),
    contributeGitHubPublication(config, renderedArtifacts),
    contributeCatalogPublications(config, renderedArtifacts)
  ]
}

const preparationOutputs = (preparation: CapabilityContribution["preparations"][number]): ReadonlyArray<OutputDeclaration> =>
  preparation._tag === "GraphCommandArtifact" ? preparation.outputs
    : preparation._tag === "GraphArchive" || preparation._tag === "GraphChecksum" || preparation._tag === "GraphCatalogRender"
    ? [preparation.output] : []
