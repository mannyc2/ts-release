import { Check, ContentHole, DigestOp, Exec, OutputDeclaration, Pack, Write } from "../model/operation.js"
import type { CandidateConfig, CandidatePlatform } from "./config.js"
import {
  basename, command, compactName, nonEmptyCommand, operationId, outputId, path,
  recordOutput, render, selectedOutputs, targetPlatform, type LegacyStageRows
} from "./current-shared.js"

type Build = NonNullable<CandidateConfig["builds"]>[number]
type TargetBuild = Extract<Build, { readonly builder: "bun" | "command" | "prebuilt" }>
const importedKinds = {
  tarball: "archive", zip: "archive", file: "file", directory: "directory",
  executable: "executable", binary: "executable"
} as const
const declare = (
  rows: LegacyStageRows, id: string, location: string, kind: OutputDeclaration["kind"],
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
  config: CandidateConfig, rows: LegacyStageRows, build: TargetBuild, target: string
): LegacyStageRows => {
  const binary = build.binary ?? compactName(config.project.name)
  const outputBinary = build.builder === "bun" ? build.binaryName ?? binary : binary
  const id = `${build.id ?? (build.builder === "command" ? "command" : build.builder)}-${target}`
  const fallback = `.release/artifacts/${binary}-${config.project.version}-${target}${
    target.startsWith("windows-") ? ".exe" : ""
  }`
  const location = render(build.output ?? fallback, config, target, binary)
  let [next, declared] = declare(rows, id, location, "executable", "build",
    targetPlatform(target, outputBinary, build.builder === "bun"))
  if (build.builder === "prebuilt") return {
    ...next, build: [...next.build, check(`build:prebuilt:${id}:exists`, declared,
      `Verify prebuilt artifact exists for ${target}.`)]
  }
  const argv = build.builder === "command"
    ? command(build.run).map((part) => render(part, config, target, binary))
    : [
        "bun", "build", render(build.entry, config, target, binary), "--compile", "--target",
        `bun-${target}${build.cpu === undefined ? "" : `-${build.cpu}`}`,
        "--outfile", location, ...(build.minify === true ? ["--minify"] : [])
      ]
  next = { ...next, build: [...next.build, Exec.make({
    id: operationId(`build:${build.builder}:${id}`), inputs: [], outputs: [declared],
    description: build.builder === "command"
      ? `Run configured build command for ${target}.`
      : `Compile ${binary} for ${target} with Bun.`,
    contractFixtureId: build.builder === "command"
      ? "build.command/v1"
      : "build.bun-compile/v1",
    argv: nonEmptyCommand(argv), cwd: path("."), environmentNames: []
  })] }
  return build.builder === "command"
    ? { ...next, build: [...next.build, check(
      `build:command:${id}:exists`, declared,
      `Verify command build output exists for ${target}.`, true)] }
    : next
}
const lowerBuilds = (config: CandidateConfig, rows: LegacyStageRows): LegacyStageRows => {
  let next = rows
  for (const build of config.builds ?? []) {
    for (const target of build.targets) next = lowerBuildTarget(config, next, build, target)
  }
  return next
}
const lowerNpm = (config: CandidateConfig, rows: LegacyStageRows): LegacyStageRows => {
  if (config.npmPackage === undefined) return rows
  const [next, declared] = declare(rows, "npm-package", config.npmPackage.path ?? ".", "package", "build")
  return { ...next, build: [...next.build, check("declare:npm-package", declared, "Declare npm package directory.")] }
}
const lowerImports = (config: CandidateConfig, rows: LegacyStageRows): LegacyStageRows => {
  let next = rows
  for (const artifact of config.artifacts ?? []) {
    let declared: OutputDeclaration
    ;[next, declared] = declare(
      next, artifact.id, render(artifact.path, config), importedKinds[artifact.format],
      "import", artifact.variant)
    next = { ...next, build: [...next.build, check(`import-artifacts:${artifact.id}:exists`, declared,
      `Verify imported artifact ${artifact.id} exists.`)] }
  }
  return next
}
const lowerArchives = (config: CandidateConfig, rows: LegacyStageRows): LegacyStageRows => {
  let next = rows
  for (const archive of config.archives ?? []) {
    const selected = selectedOutputs(next, archive.ids, () => true)
    const formats = archive.formats ?? ["tar.gz"]
    for (const format of formats) {
      const base = render(
        archive.nameTemplate ?? `${compactName(config.project.name)}_{version}`, config)
      const id = `${archive.id ?? "archive"}${formats.length > 1
        ? `-${format.replaceAll(".", "-")}` : ""}`
      let declared: OutputDeclaration
      ;[next, declared] = declare(
        next, id, `.release/artifacts/${base}.${format}`, "archive", "process")
      next = { ...next, process: [...next.process, Pack.make({
        id: operationId(`archive:${id}`), inputs: selected.map((item) => item.id),
        outputs: [declared], description: `Create ${format} archive ${basename(declared.path)}.`,
        format, ...(archive.files === undefined ? {} : { files: archive.files })
      })] }
    }
  }
  return next
}
const lowerChecksum = (config: CandidateConfig, rows: LegacyStageRows): LegacyStageRows => {
  if (config.checksum === undefined) return rows
  const inputs = [...rows.outputs.values()].filter((item) =>
    !["directory", "package", "digest", "checksum-file", "catalog-file"].includes(item.kind))
    .sort((left, right) => basename(left.path).localeCompare(basename(right.path)))
  const algorithm = config.checksum.algorithm ?? "sha256"
  let [next, digest] = declare(
    rows, "checksum-digests", `.release/facts/checksum-${algorithm}`, "digest", "internal")
  next = { ...next, process: [...next.process, DigestOp.make({
    id: operationId("checksum:digest"), inputs: inputs.map((item) => item.id),
    outputs: [digest], description: `Compute ${algorithm} release digests.`, algorithm
  })] }
  const fileName = render(
    config.checksum.nameTemplate ?? "{name}_{version}_checksums.txt", config)
  let declared: OutputDeclaration
  ;[next, declared] = declare(
    next, "checksum", `.release/artifacts/${fileName}`, "checksum-file", "process")
  next = { ...next, process: [...next.process, Write.make({
    id: operationId("checksum:write"), inputs: [digest.id], outputs: [declared], description: `Write ${algorithm} checksum file ${fileName}.`, path: declared.path,
    content: inputs.flatMap((item) => [
      ContentHole.make({ fact: "sha256", outputId: item.id }), `  ${basename(item.path)}\n`
    ])
  })] }
  return next
}
export const lowerLegacyBuild = (config: CandidateConfig, rows: LegacyStageRows): LegacyStageRows => {
  let next = lowerImports(config, rows)
  next = lowerBuilds(config, next)
  next = lowerNpm(config, next)
  next = lowerArchives(config, next)
  return lowerChecksum(config, next)
}
