import type {
  BuildOp, CatalogOp, OutputDeclaration, ProcessOp, PublishOp, ValidateOp, VerifyOp
} from "../model/operation.js"
import { CredentialName, OperationId, OutputId, SafeRelativePath } from "../model/primitives.js"
import type { CandidateConfig, CandidatePlatform } from "./config.js"

export interface CurrentRows {
  readonly build: Array<BuildOp>
  readonly process: Array<ProcessOp>
  readonly catalog: Array<CatalogOp>
  readonly validate: Array<ValidateOp>
  readonly publish: Array<PublishOp>
  readonly announce: Array<import("../model/operation.js").AnnounceOp>
  readonly verify: Array<VerifyOp>
  readonly outputs: Map<string, OutputDeclaration>
}
export const emptyRows = (): CurrentRows => ({
  build: [], process: [], catalog: [], validate: [], publish: [], announce: [], verify: [], outputs: new Map()
})
export const operationId = (value: string): OperationId => OperationId.make(value)
export const outputId = (value: string): OutputId => OutputId.make(value)
export const path = (value: string): SafeRelativePath => SafeRelativePath.make(value)
export const credentialName = (value: string): CredentialName => CredentialName.make(value)
export const compactName = (value: string): string => value
  .replace(/^@/u, "").replaceAll("/", "-").replace(/[^A-Za-z0-9._-]+/gu, "-")
  .replace(/^-+|-+$/gu, "")
export const basename = (value: string): string => value.replaceAll("\\", "/").split("/").at(-1) ?? value

export const render = (
  template: string, config: CandidateConfig, target?: string, binary?: string
): string => {
  const [os = "", arch = ""] = target?.split("-") ?? []
  return template.replaceAll("{name}", compactName(config.project.name))
    .replaceAll("{version}", config.project.version).replaceAll("{tag}", config.project.tag)
    .replaceAll("{targetTriple}", target ?? "").replaceAll("{target}", target ?? "")
    .replaceAll("{os}", os).replaceAll("{arch}", arch)
    .replaceAll("{binary}", binary ?? compactName(config.project.name))
    .replaceAll("{ext}", os === "windows" ? ".exe" : "")
}
export const targetPlatform = (
  target: string, binary: string, compile: boolean
): CandidatePlatform => {
  const [os, arch, libcToken] = target.split("-")
  if (!["linux", "darwin", "windows"].includes(os ?? "") || !["x64", "arm64"].includes(arch ?? "")) {
    throw new Error(`Unsupported platform target ${target}.`)
  }
  return {
    os: os as CandidatePlatform["os"], arch: arch as CandidatePlatform["arch"],
    ...(os === "linux"
      ? { libc: (libcToken === "musl" ? "musl" : "glibc") as CandidatePlatform["libc"] }
      : {}),
    binaryName: binary, targetTriple: compile ? `bun-${target}` : target
  } as CandidatePlatform
}
export const recordOutput = (
  rows: CurrentRows, output: OutputDeclaration
): OutputDeclaration => {
  if (rows.outputs.has(output.id)) throw new Error(`Duplicate output id ${output.id}.`)
  rows.outputs.set(output.id, output)
  return output
}
export const selectedOutputs = (
  rows: CurrentRows, ids: ReadonlyArray<string> | undefined,
  fallback: (output: OutputDeclaration) => boolean
): ReadonlyArray<OutputDeclaration> => ids === undefined
  ? [...rows.outputs.values()].filter(fallback)
  : ids.map((id) => {
      const output = rows.outputs.get(id)
      if (output === undefined) throw new Error(`Missing selected output ${id}.`)
      return output
    })
export const command = (value: string | ReadonlyArray<string>): ReadonlyArray<string> =>
  typeof value === "string" ? value.trim().split(/\s+/u).filter(Boolean) : value
export const nonEmptyCommand = (value: ReadonlyArray<string>): readonly [string, ...string[]] => {
  const [first, ...rest] = value
  if (first === undefined || first.length === 0) throw new Error("Command argv must be nonempty.")
  return [first, ...rest]
}
