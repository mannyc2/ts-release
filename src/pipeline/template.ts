import type { InstallableArtifactVariant } from "./artifact.js"
import type { ReleaseIdentity } from "./state.js"

export interface TemplateContext {
  readonly identity: ReleaseIdentity
  readonly platform?: InstallableArtifactVariant | undefined
  readonly targetTriple?: string | undefined
  readonly binary?: string | undefined
}

export const distributionArchToken = (arch: "x64" | "arm64"): "amd64" | "arm64" =>
  arch === "x64" ? "amd64" : "arm64"

export const defaultArtifactBaseName = (
  binary: string,
  platform: InstallableArtifactVariant
): string => {
  const libcSuffix = platform.libc === "musl" ? "_musl" : ""
  const extension = platform.executableExtension ?? ""
  return `${binary}_{version}_${platform.os}_${distributionArchToken(platform.arch)}${libcSuffix}${extension}`
}

export const renderTemplate = (
  value: string,
  context: TemplateContext
): string => {
  const platform = context.platform
  return value
    .split("{name}").join(context.identity.name)
    .split("{normalizedName}").join(context.identity.normalizedName)
    .split("{version}").join(context.identity.version)
    .split("{tag}").join(context.identity.tag)
    .split("{commit}").join(context.identity.commit)
    .split("{shortCommit}").join(context.identity.shortCommit)
    .split("{os}").join(platform?.os ?? "")
    .split("{arch}").join(platform === undefined ? "" : distributionArchToken(platform.arch))
    .split("{libc}").join(platform?.libc ?? "")
    .split("{ext}").join(platform?.executableExtension ?? "")
    .split("{targetTriple}").join(context.targetTriple ?? platform?.targetTriple ?? "")
    .split("{binary}").join(context.binary ?? "")
}

export const normalizedName = (name: string): string => {
  const withoutScopePrefix = name.startsWith("@") ? name.slice(1) : name
  return withoutScopePrefix.replaceAll("/", "-")
}
