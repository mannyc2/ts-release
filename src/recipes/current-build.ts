import {
  Check, ContentHole, DigestOp, Exec, OutputDeclaration, Pack, Write
} from "../model/operation.js"
import type { CandidateConfig, CandidatePlatform } from "./config.js"
import {
  basename, command, compactName, nonEmptyCommand, operationId, outputId, path,
  recordOutput, render, selectedOutputs, targetPlatform, type CurrentRows
} from "./current-shared.js"

type Build = NonNullable<CandidateConfig["builds"]>[number]
type TargetBuild = Extract<Build, { readonly builder: "bun" | "command" | "prebuilt" }>
const importedKinds = {
  tarball: "archive", zip: "archive", file: "file", directory: "directory",
  executable: "executable", binary: "executable"
} as const
const declare = (
  rows: CurrentRows, id: string, location: string, kind: OutputDeclaration["kind"],
  provenance: NonNullable<OutputDeclaration["provenance"]>, platform?: CandidatePlatform
) => recordOutput(rows, OutputDeclaration.make({
  id: outputId(id), path: path(location), kind, provenance,
  ...(platform === undefined ? {} : { platform })
}))
const check = (
  id: string, declared: OutputDeclaration, description: string, inputs = false
) => Check.make({
  id: operationId(id), inputs: inputs ? [declared.id] : [],
  outputs: inputs ? [] : [declared], description, path: declared.path
})
const lowerBuildTarget = (
  config: CandidateConfig, rows: CurrentRows, build: TargetBuild, target: string
): void => {
  const binary = build.binary ?? compactName(config.project.name)
  const outputBinary = build.builder === "bun" ? build.binaryName ?? binary : binary
  const id = `${build.id ?? (build.builder === "command" ? "command" : build.builder)}-${target}`
  const fallback = `.release/artifacts/${binary}-${config.project.version}-${target}${
    target.startsWith("windows-") ? ".exe" : ""
  }`
  const location = render(build.output ?? fallback, config, target, binary)
  const declared = declare(rows, id, location, "executable", "build",
    targetPlatform(target, outputBinary, build.builder === "bun"))
  if (build.builder === "prebuilt") {
    rows.build.push(check(`build:prebuilt:${id}:exists`, declared,
      `Verify prebuilt artifact exists for ${target}.`))
    return
  }
  const argv = build.builder === "command"
    ? command(build.run).map((part) => render(part, config, target, binary))
    : [
        "bun", "build", render(build.entry, config, target, binary), "--compile", "--target",
        `bun-${target}${build.cpu === undefined ? "" : `-${build.cpu}`}`,
        "--outfile", location, ...(build.minify === true ? ["--minify"] : [])
      ]
  rows.build.push(Exec.make({
    id: operationId(`build:${build.builder}:${id}`), inputs: [], outputs: [declared],
    description: build.builder === "command"
      ? `Run configured build command for ${target}.`
      : `Compile ${binary} for ${target} with Bun.`,
    contractFixtureId: build.builder === "command"
      ? "build.command/v1"
      : "build.bun-compile/v1",
    argv: nonEmptyCommand(argv), cwd: path("."), environmentNames: []
  }))
  if (build.builder === "command") rows.build.push(check(
    `build:command:${id}:exists`, declared,
    `Verify command build output exists for ${target}.`, true))
}
const lowerBuilds = (config: CandidateConfig, rows: CurrentRows): void => {
  for (const build of config.builds ?? []) {
    for (const target of build.targets) lowerBuildTarget(config, rows, build, target)
  }
}
const lowerNpm = (config: CandidateConfig, rows: CurrentRows): void => {
  if (config.npmPackage === undefined) return
  const declared = declare(rows, "npm-package", config.npmPackage.path ?? ".", "package", "build")
  rows.build.push(check("declare:npm-package", declared, "Declare npm package directory."))
}
const lowerImports = (config: CandidateConfig, rows: CurrentRows): void => {
  for (const artifact of config.artifacts ?? []) {
    const declared = declare(
      rows, artifact.id, render(artifact.path, config), importedKinds[artifact.format],
      "import", artifact.variant)
    rows.build.push(check(`import-artifacts:${artifact.id}:exists`, declared,
      `Verify imported artifact ${artifact.id} exists.`))
  }
}
const lowerArchives = (config: CandidateConfig, rows: CurrentRows): void => {
  for (const archive of config.archives ?? []) {
    const selected = selectedOutputs(rows, archive.ids, () => true)
    const formats = archive.formats ?? ["tar.gz"]
    for (const format of formats) {
      const base = render(
        archive.nameTemplate ?? `${compactName(config.project.name)}_{version}`, config)
      const id = `${archive.id ?? "archive"}${formats.length > 1
        ? `-${format.replaceAll(".", "-")}` : ""}`
      const declared = declare(
        rows, id, `.release/artifacts/${base}.${format}`, "archive", "process")
      rows.process.push(Pack.make({
        id: operationId(`archive:${id}`), inputs: selected.map((item) => item.id),
        outputs: [declared], description: `Create ${format} archive ${basename(declared.path)}.`,
        format, ...(archive.files === undefined ? {} : { files: archive.files })
      }))
    }
  }
}
const lowerChecksum = (config: CandidateConfig, rows: CurrentRows): void => {
  if (config.checksum === undefined) return
  const inputs = [...rows.outputs.values()].filter((item) =>
    !["directory", "package", "digest", "checksum-file", "catalog-file"].includes(item.kind))
    .sort((left, right) => basename(left.path).localeCompare(basename(right.path)))
  const algorithm = config.checksum.algorithm ?? "sha256"
  const digest = declare(
    rows, "checksum-digests", `.release/facts/checksum-${algorithm}`, "digest", "internal")
  rows.process.push(DigestOp.make({
    id: operationId("checksum:digest"), inputs: inputs.map((item) => item.id),
    outputs: [digest], description: `Compute ${algorithm} release digests.`, algorithm
  }))
  const fileName = render(
    config.checksum.nameTemplate ?? "{name}_{version}_checksums.txt", config)
  const declared = declare(
    rows, "checksum", `.release/artifacts/${fileName}`, "checksum-file", "process")
  rows.process.push(Write.make({
    id: operationId("checksum:write"), inputs: [digest.id], outputs: [declared],
    description: `Write ${algorithm} checksum file ${fileName}.`, path: declared.path,
    content: inputs.flatMap((item) => [
      ContentHole.make({ fact: "sha256", outputId: item.id }), `  ${basename(item.path)}\n`
    ])
  }))
}
export const lowerCurrentBuild = (config: CandidateConfig, rows: CurrentRows): void => {
  lowerImports(config, rows)
  lowerBuilds(config, rows)
  lowerNpm(config, rows)
  lowerArchives(config, rows)
  lowerChecksum(config, rows)
}
