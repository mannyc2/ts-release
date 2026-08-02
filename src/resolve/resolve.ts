// Authored configuration plus observed facts → the canonical config, by total
// rules and nothing else. This is the ONLY place authored-to-canonical
// semantics may live: no recipe and no compiler may infer anything, because
// plan bytes are a function of the canonical value alone.
//
// Every rule is one of three shapes: the authored value wins, a fact fills an
// omission, or the two disagree and the resolver REFUSES naming both values and
// where each came from. Silence is never an option — a release that guesses its
// own identity is the defect this module exists to prevent.
import * as Schema from "effect/Schema"
import { MISSING_COMMIT } from "../model/errors.js"
import { NonEmptyName, Version } from "../model/primitives.js"
import type { CandidateConfig } from "../recipes/config.js"
import { AuthoredConfig } from "./authored.js"
import { toPlainJson } from "./encode.js"
import { ResolveError } from "./errors.js"
import { ObservedFacts } from "./facts.js"

const refuse = (field: string, reason: string): never => {
  throw new ResolveError(field, reason)
}
const disagreement = (
  field: string, authored: string, observed: string, source: string
): never =>
  refuse(
    `project.${field}`,
    `project.${field} is ${JSON.stringify(authored)} in the config but ${
      JSON.stringify(observed)
    } ${source}. Remove the authored value or correct the source; the resolver never picks.`
  )

const decodeAuthored = Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })
const decodeFacts = Schema.decodeUnknownSync(ObservedFacts, { onExcessProperty: "error" })

const version = (
  authored: AuthoredConfig, facts: ObservedFacts
): Version => {
  const directive = authored.versionFrom
  const observed = directive === "manifest"
    ? facts.manifestVersion
    : directive === "git-tag"
    ? facts.headTagVersion
    : undefined
  const source = directive === "manifest" ? "in the package manifest" : "on the tag at HEAD"
  if (authored.project.version !== undefined) {
    if (observed !== undefined && observed !== authored.project.version) {
      disagreement("version", authored.project.version, observed, source)
    }
    return authored.project.version
  }
  if (directive === undefined) {
    return refuse(
      "project.version",
      "project.version is required. State it, or set versionFrom to \"manifest\" or \"git-tag\" so it can be observed."
    )
  }
  if (observed === undefined) {
    return refuse(
      "project.version",
      `versionFrom is ${JSON.stringify(directive)} but no version was observed ${source}.`
    )
  }
  return observed
}

// `{version}` is the whole grammar. An unrecognized token is a refusal, exactly
// as the checksum name filter treats one.
const tag = (authored: AuthoredConfig, resolved: Version): NonEmptyName => {
  if (authored.project.tag !== undefined) return authored.project.tag
  const template = authored.project.tagTemplate ?? "v{version}"
  const rendered = template.replaceAll("{version}", resolved)
  if (rendered.includes("{") || rendered.includes("}")) {
    return refuse(
      "project.tagTemplate",
      `project.tagTemplate supports only the {version} token, got ${JSON.stringify(template)}.`
    )
  }
  return NonEmptyName.make(rendered)
}

const commit = (authored: AuthoredConfig, facts: ObservedFacts): string => {
  if (authored.project.commit !== undefined) {
    if (facts.commit !== undefined && facts.commit !== authored.project.commit) {
      disagreement("commit", authored.project.commit, facts.commit, "at HEAD")
    }
    return authored.project.commit
  }
  if (facts.commit === undefined) return refuse("project.commit", MISSING_COMMIT)
  return facts.commit
}

const names = (
  authored: AuthoredConfig, facts: ObservedFacts
): { readonly name: string, readonly packageName?: string } => {
  const manifest = facts.manifestName
  if (manifest !== undefined && authored.project.packageName !== undefined &&
    manifest !== authored.project.packageName) {
    disagreement("packageName", authored.project.packageName, manifest, "in the package manifest")
  }
  const name = authored.project.name ?? manifest
  if (name === undefined) {
    return refuse("project.name", "project.name is required when no package manifest is observed.")
  }
  const packageName = authored.project.packageName ?? manifest
  return { name, ...(packageName === undefined ? {} : { packageName }) }
}

/**
 * Resolve an authored configuration and observed facts into the canonical
 * configuration. Pure and total: the same inputs always produce the same value,
 * and every unfillable or contradicted field raises `ResolveError`.
 */
export { MISSING_COMMIT }

export const resolveConfig = (authored: unknown, facts: unknown): CandidateConfig => {
  const config = decodeAuthored(authored)
  const observed = decodeFacts(facts)
  const resolvedVersion = version(config, observed)
  // The directives are CONSUMED here: they describe how to resolve, and the
  // canonical world has never heard of them.
  const { project, versionFrom: _directive, ...rest } = config
  const { tagTemplate: _template, ...projectRest } = project
  // Plain JSON, not class instances: this value goes straight to `plan`, whose
  // decoder refuses anything with a prototype.
  return toPlainJson({
    ...rest,
    project: {
      ...projectRest,
      ...names(config, observed),
      version: resolvedVersion,
      tag: tag(config, resolvedVersion),
      commit: commit(config, observed)
    }
  }) as CandidateConfig
}
