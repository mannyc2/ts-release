import * as Effect from "effect/Effect"
import type { InstallableArtifactVariant } from "./artifact.js"
import { PlanError } from "./errors.js"
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

export class UnresolvedTemplateToken {
  readonly _tag = "UnresolvedTemplateToken"
  constructor(readonly token: string, readonly value: string) {}
}

const vocabularyTokens = [
  "{name}",
  "{normalizedName}",
  "{version}",
  "{tag}",
  "{commit}",
  "{shortCommit}",
  "{os}",
  "{arch}",
  "{libc}",
  "{ext}",
  "{targetTriple}",
  "{binary}"
] as const

export const renderArtifactName = (
  value: string,
  context: TemplateContext
): string | UnresolvedTemplateToken => {
  const platform = context.platform
  const substitutions: ReadonlyArray<readonly [string, string | undefined]> = [
    ["{name}", context.identity.name],
    ["{normalizedName}", context.identity.normalizedName],
    ["{version}", context.identity.version],
    ["{tag}", context.identity.tag],
    ["{commit}", context.identity.commit],
    ["{shortCommit}", context.identity.shortCommit],
    ["{os}", platform?.os],
    ["{arch}", platform === undefined ? undefined : distributionArchToken(platform.arch)],
    ["{libc}", platform?.libc],
    ["{ext}", platform === undefined ? undefined : platform.executableExtension ?? ""],
    ["{targetTriple}", context.targetTriple ?? platform?.targetTriple],
    ["{binary}", context.binary]
  ]
  let rendered = value
  for (const [token, substitution] of substitutions) {
    if (substitution !== undefined) {
      rendered = rendered.split(token).join(substitution)
    }
  }
  for (const token of vocabularyTokens) {
    if (rendered.includes(token)) {
      return new UnresolvedTemplateToken(token, value)
    }
  }
  return rendered
}

export const renderArtifactNameEffect = (
  value: string,
  context: TemplateContext,
  source: { readonly pipeId: string; readonly field: string }
): Effect.Effect<string, PlanError> => {
  const rendered = renderArtifactName(value, context)
  return typeof rendered === "string"
    ? Effect.succeed(rendered)
    : Effect.fail(PlanError.make({
      pipeId: source.pipeId,
      field: source.field,
      reason: `Template ${rendered.token} cannot be resolved here; remove it or provide a platform context.`
    }))
}

export const normalizedName = (name: string): string => {
  const withoutScopePrefix = name.startsWith("@") ? name.slice(1) : name
  return withoutScopePrefix.replaceAll("/", "-")
}
