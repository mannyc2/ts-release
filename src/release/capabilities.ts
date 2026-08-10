import { NonEmptyName, OperationId, OutputId, SafeRelativePath } from "../model/primitives.js"
import type { CandidateConfig } from "../recipes/config.js"
import { CapabilityContribution, GraphArchive, GraphCatalog, GraphChecksum, GraphCommandArtifact,
  GraphCommandCheck, GraphGitHubPublication, GraphNpmPublication, OutputDeclaration } from "./graph.js"
import type { VerifiedReleaseContext } from "./context.js"

const output = (id: string | OutputId, location: string, kind: OutputDeclaration["kind"], provenance: "build" | "import" | "process" | "catalog", mediaType?: string) =>
  OutputDeclaration.make({ id: OutputId.make(id.toString()), path: SafeRelativePath.make(location), kind, provenance,
    ...(mediaType === undefined ? {} : { mediaType }) })
const compact = (name: string) => name.replace(/^@/u, "").replaceAll("/", "-").replace(/[^A-Za-z0-9._-]+/gu, "-")
  .replace(/^-+|-+$/gu, "")
const render = (value: string, config: CandidateConfig, target = "", binary = compact(config.project.name)) => {
  const [os = "", arch = ""] = target.split("-")
  return value.replaceAll("{name}", compact(config.project.name)).replaceAll("{version}", config.project.version)
    .replaceAll("{tag}", config.project.tag).replaceAll("{targetTriple}", target).replaceAll("{target}", target)
    .replaceAll("{os}", os).replaceAll("{arch}", arch).replaceAll("{binary}", binary)
    .replaceAll("{ext}", os === "windows" ? ".exe" : "")
}
const buildContribution = (config: CandidateConfig, context: VerifiedReleaseContext): CapabilityContribution => {
  const artifacts: OutputDeclaration[] = []
  const preparations: (GraphCommandArtifact | GraphCommandCheck)[] = []
  for (const artifact of config.artifacts ?? []) {
    artifacts.push(output(artifact.id, render(artifact.path, config),
      artifact.format === "zip" || artifact.format === "tarball" ? "archive" : artifact.format === "binary" ? "executable" : artifact.format,
      "import"))
  }
  if (config.npmPackage !== undefined) {
    const declaration = output("npm-package", config.npmPackage.path ?? ".", "package", "build")
    artifacts.push(declaration)
    preparations.push(GraphCommandCheck.make({
      id: OperationId.make("declare:npm-package"), argv: ["test", "-d", declaration.path], cwd: SafeRelativePath.make("."),
      environmentNames: [], inputs: [declaration.id], sourceCommit: context.source.commit
    }))
  }
  for (const build of config.builds ?? []) {
    for (const target of build.targets) {
      const binary = build.binary ?? compact(config.project.name)
      const id = `${build.id ?? build.builder}-${target}`
      const location = render(build.output ?? `.release/artifacts/${binary}-${config.project.version}-${target}${target.startsWith("windows-") ? ".exe" : ""}`, config, target, binary)
      const declaration = output(id, location, "executable", "build")
      if (build.builder === "prebuilt") {
        artifacts.push(declaration)
        preparations.push(GraphCommandCheck.make({
        id: OperationId.make(`build:prebuilt:${id}:exists`), argv: ["test", "-f", location], cwd: SafeRelativePath.make("."),
        environmentNames: [], inputs: [declaration.id], sourceCommit: context.source.commit
        }))
      } else {
        const argv = build.builder === "command" ? build.run.map((part) => render(part, config, target, binary)) : [
          "bun", "build", render(build.entry, config, target, binary), "--compile", "--target", `bun-${target}`,
          "--outfile", location, ...(build.minify === true ? ["--minify"] : [])
        ]
        preparations.push(GraphCommandArtifact.make({
          id: OperationId.make(`build:${build.builder}:${id}`), argv: [argv[0]!, ...argv.slice(1)], cwd: SafeRelativePath.make("."),
          environmentNames: [], inputs: [], outputs: [declaration], sourceCommit: context.source.commit
        }))
      }
    }
  }
  for (const preparation of config.preparations ?? []) {
    const inputs = preparation.inputs ?? []
    const cwd = preparation.cwd ?? SafeRelativePath.make(".")
    const environmentNames = preparation.environmentNames ?? []
    if (preparation.kind === "check") preparations.push(GraphCommandCheck.make({
      id: OperationId.make(`preparation:${preparation.id}`), argv: preparation.run,
      cwd, environmentNames, inputs, sourceCommit: context.source.commit
    }))
    else preparations.push(GraphCommandArtifact.make({
      id: OperationId.make(`preparation:${preparation.id}`), argv: preparation.run,
      cwd, environmentNames, inputs,
      outputs: [
        output(preparation.outputs[0]!.id, preparation.outputs[0]!.path, preparation.outputs[0]!.kind ?? "file", "process", preparation.outputs[0]!.mediaType),
        ...preparation.outputs.slice(1).map((item) => output(item.id, item.path, item.kind ?? "file", "process", item.mediaType))
      ],
      sourceCommit: context.source.commit
    }))
  }
  return CapabilityContribution.make({ artifacts, preparations, publications: [] })
}

const packageContribution = (config: CandidateConfig, artifacts: ReadonlyArray<OutputDeclaration>, _context: VerifiedReleaseContext): CapabilityContribution => {
  const preparations: (GraphArchive | GraphChecksum)[] = []
  const packageOutputs: OutputDeclaration[] = []
  for (const archive of config.archives ?? []) {
    const selected = archive.ids === undefined ? artifacts : archive.ids.map((id) => artifacts.find((item) => item.id.toString() === id))
    const inputs = selected.filter((item): item is OutputDeclaration => item !== undefined).map((item) => item.id)
    for (const format of archive.formats ?? ["tar.gz"]) {
      const base = render(archive.nameTemplate ?? `${compact(config.project.name)}_{version}`, config)
      const id = `${archive.id ?? "archive"}${(archive.formats ?? ["tar.gz"]).length > 1 ? `-${format.replaceAll(".", "-")}` : ""}`
      const declaration = output(id, `.release/artifacts/${base}.${format}`, "archive", "process")
      packageOutputs.push(declaration)
      preparations.push(GraphArchive.make({ id: OperationId.make(`archive:${id}`), inputs, output: declaration, format,
        ...(archive.files === undefined ? {} : { files: archive.files }) }))
    }
  }
  const checksumInputs = [...artifacts, ...packageOutputs].filter((item) =>
    !["directory", "package", "digest", "checksum-file", "catalog-file"].includes(item.kind))
  if (config.checksum !== undefined && checksumInputs.length > 0) {
    const algorithm = config.checksum.algorithm ?? "sha256"
    preparations.push(GraphChecksum.make({ id: OperationId.make("checksum:digest"), inputs: [checksumInputs[0]!.id, ...checksumInputs.slice(1).map((item) => item.id)],
      output: output("checksum-digests", `.release/facts/checksum-${algorithm}`, "digest", "process"), algorithm }))
  }
  return CapabilityContribution.make({ artifacts: [], preparations, publications: [] })
}

export const contributeRelease = (config: CandidateConfig, context: VerifiedReleaseContext): ReadonlyArray<CapabilityContribution> => {
  const build = buildContribution(config, context)
  const buildOutputs = [...build.artifacts, ...build.preparations.flatMap(preparationOutputs)]
  const packaged = packageContribution(config, buildOutputs, context)
  const allArtifacts = [...buildOutputs, ...packaged.preparations.flatMap(preparationOutputs)]
  const catalogs = (config.catalogs ?? []).map((catalog) => {
    const content = typeof catalog.content === "string" ? render(catalog.content, config) : catalog.content.map((part) =>
      typeof part === "string" ? render(part, config) : { fact: part.fact, outputId: part.artifact })
    const inputs = typeof content === "string" ? [] : content.flatMap((part) => typeof part === "string" ? [] : [part.outputId])
    return GraphCatalog.make({ id: OperationId.make(`catalog:${catalog.id}:render`), inputs,
      output: output(`catalog-file-${catalog.id}`, catalog.file, "catalog-file", "catalog"), content })
  })
  const catalogContribution = CapabilityContribution.make({ artifacts: [], preparations: catalogs, publications: [] })
  const allPrepared = [...allArtifacts, ...catalogs.map((catalog) => catalog.output)]
  const publications = [
    config.publish?.npm === undefined ? undefined : GraphNpmPublication.make({
      id: OperationId.make("npm:npm-release"), packageName: NonEmptyName.make(config.publish.npm.packageName ?? config.project.packageName ?? config.project.name),
      version: NonEmptyName.make(config.project.version), registryUrl: config.publish.npm.registry ?? "https://registry.npmjs.org",
      artifactIds: allPrepared.filter((item) => item.kind === "package").map((item) => item.id)
    }),
    config.publish?.github === undefined || (config.publish.github.repository ?? config.project.repository) === undefined ? undefined : GraphGitHubPublication.make({
      id: OperationId.make("github:github-release"), repository: config.publish.github.repository ?? config.project.repository!, tag: config.project.tag,
      draft: config.publish.github.draft ?? true,
      prerelease: config.publish.github.prerelease === "auto" ? config.project.version.includes("-") : config.publish.github.prerelease ?? false,
      title: NonEmptyName.make(`${config.project.name} ${config.project.version}`),
      ...(config.publish.github.bodyArtifact === undefined && config.project.notes === undefined ? {} : {
        ...(config.publish.github.bodyArtifact === undefined ? { body: config.project.notes! } : { bodyArtifact: config.publish.github.bodyArtifact })
      }),
      assetIds: config.publish.github.ids ?? allPrepared.filter((item) => ["archive", "executable", "file", "digest"].includes(item.kind)).map((item) => item.id)
    })
  ].filter((item): item is GraphNpmPublication | GraphGitHubPublication => item !== undefined)
  return [build, packaged, catalogContribution, CapabilityContribution.make({ artifacts: [], preparations: [], publications })]
}

// Registry entrypoints are projections of these contributors; the composer
// above is the only path that links their values into one graph.
export const contributeBuild = buildContribution
export const contributeArchives = packageContribution
export const contributeNpm = contributeRelease
export const contributeGitHub = contributeRelease
export const contributeCatalog = contributeRelease

const preparationOutputs = (preparation: CapabilityContribution["preparations"][number]): ReadonlyArray<OutputDeclaration> =>
  preparation._tag === "GraphCommandArtifact" ? preparation.outputs
    : preparation._tag === "GraphArchive" || preparation._tag === "GraphChecksum" || preparation._tag === "GraphCatalog"
    ? [preparation.output] : []
