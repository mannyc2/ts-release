// Invariant: all release placeholders share one renderer and unknown or unsafe expansions fail explicitly.
import * as Effect from "effect/Effect"
import {
  type InstallableArtifactVariant,
  type SafeRelativePath,
  validateSafeRelativePathEffect
} from "./artifact.js"
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

// One token vocabulary and renderer: ordinary templates erase missing
// context; artifact paths preserve missing tokens so the Effect wrapper fails.
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
  context: TemplateContext,
  unresolved: "empty" | "preserve" = "empty"
): string => {
  let rendered = value
  for (const [token, substitution] of tokenValues(context)) {
    if (substitution !== undefined || unresolved === "empty") {
      rendered = rendered.split(token).join(substitution ?? "")
    }
  }
  return rendered
}

export const renderArtifactNameEffect = (
  value: string,
  context: TemplateContext,
  source: { readonly pipeId: string; readonly field: string }
): Effect.Effect<SafeRelativePath, PlanError> => {
  const substitutions = tokenValues(context)
  const rendered = renderTemplate(value, context, "preserve")
  const unresolved = substitutions.find(([token]) => rendered.includes(token))
  if (unresolved !== undefined) {
    return Effect.fail(PlanError.make({
      pipeId: source.pipeId,
      field: source.field,
      reason: `Template ${unresolved[0]} cannot be resolved here; remove it or provide a platform context.`
    }))
  }
  return validateSafeRelativePathEffect(rendered, source)
}

export const normalizedName = (name: string): string => {
  const withoutScopePrefix = name.startsWith("@") ? name.slice(1) : name
  return withoutScopePrefix.replaceAll("/", "-")
}
