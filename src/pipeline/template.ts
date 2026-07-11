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

// One token vocabulary for both renderers: renderTemplate substitutes
// absent-context tokens as "", renderArtifactName leaves them and fails.
const tokenValues = (context: TemplateContext): ReadonlyArray<readonly [string, string | undefined]> => {
  const platform = context.platform
  return [
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
}

export const renderTemplate = (
  value: string,
  context: TemplateContext
): string =>
  tokenValues(context).reduce(
    (rendered, [token, substitution]) => rendered.split(token).join(substitution ?? ""),
    value
  )

export class UnresolvedTemplateToken {
  readonly _tag = "UnresolvedTemplateToken"
  constructor(readonly token: string, readonly value: string) {}
}

export const renderArtifactName = (
  value: string,
  context: TemplateContext
): string | UnresolvedTemplateToken => {
  const substitutions = tokenValues(context)
  let rendered = value
  for (const [token, substitution] of substitutions) {
    if (substitution !== undefined) {
      rendered = rendered.split(token).join(substitution)
    }
  }
  for (const [token] of substitutions) {
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
