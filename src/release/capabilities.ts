import * as Schema from "effect/Schema"
import {
  ArtifactCardinality,
  ArtifactCollectionContract,
  ArtifactCollectionId,
  ArtifactCollectionSelector
} from "../model/artifact-collection.js"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath } from "../model/primitives.js"
import { bunArtifactTarget } from "../capabilities/bun-targets.js"
import { NpmAuthentication, type CandidateConfig } from "../recipes/config.js"
import { CapabilityContribution, GraphArchive, GraphChecksum, GraphCommandArtifact, GraphCommandCollection, GraphLinkError,
  GraphCommandCheck, GraphGitHubPublication, GraphNpmPackageBuild, GraphNpmPublication, OutputDeclaration,
  makeGitHubPublicationAuthorityIntent, makeNpmPublicationAuthorityIntent } from "./graph.js"
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
          output(preparation.outputs[0]!.id, preparation.outputs[0]!.path, preparation.outputs[0]!.kind ?? "file", preparation.outputs[0]!.mediaType),
          ...preparation.outputs.slice(1).map((item) => output(item.id, item.path, item.kind ?? "file", item.mediaType))
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

export const contributeNpmPublication = (
  config: CandidateConfig,
  context: VerifiedReleaseContext
): CapabilityContribution => {
  const intent = config.publish?.npm
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

export const contributeRelease = (config: CandidateConfig, context: VerifiedReleaseContext): ReadonlyArray<CapabilityContribution> => {
  const build = contributeSourceArtifacts(config, context)
  const buildOutputs = [...build.artifacts, ...build.preparations.flatMap(preparationOutputs)]
  const packaged = contributePackages(config, buildOutputs, context)
  const allArtifacts = [...buildOutputs, ...packaged.preparations.flatMap(preparationOutputs)]
  return [
    build,
    packaged,
    contributeNpmPublication(config, context),
    contributeGitHubPublication(config, allArtifacts)
  ]
}

const preparationOutputs = (preparation: CapabilityContribution["preparations"][number]): ReadonlyArray<OutputDeclaration> =>
  preparation._tag === "GraphCommandArtifact" ? preparation.outputs
    : preparation._tag === "GraphArchive" || preparation._tag === "GraphChecksum"
    ? [preparation.output] : []
