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
import * as Semver from "semver"
import { MISSING_COMMIT } from "../model/errors.js"
import { NonEmptyName, OutputId, Version } from "../model/primitives.js"
import {
  CandidateConfig,
  type CandidateNpmPublish,
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  canonicalizeNpmRegistryEndpoint
} from "../recipes/config.js"
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
const decodeCandidate = Schema.decodeUnknownSync(CandidateConfig, { onExcessProperty: "error" })

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

const requireObservedCommit = (facts: ObservedFacts): void => {
  if (facts.commit === undefined) refuse("source.commit", MISSING_COMMIT)
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

const repository = (authored: AuthoredConfig, facts: ObservedFacts): string | undefined => {
  if (authored.project.repository !== undefined && facts.repository !== undefined && authored.project.repository !== facts.repository) {
    disagreement("repository", authored.project.repository, facts.repository, "in the observed repository")
  }
  return authored.project.repository ?? facts.repository
}

const canonicalRegistry = (value: string | undefined): CanonicalNpmRegistryEndpoint => {
  try {
    return CanonicalNpmRegistryEndpoint.make(
      canonicalizeNpmRegistryEndpoint(value ?? "https://registry.npmjs.org")
    )
  } catch (cause) {
    return refuse(
      "publish.npm.registry",
      cause instanceof Error ? cause.message : String(cause)
    )
  }
}

const distTag = (versionValue: Version, authored: string | undefined): NpmDistTag => {
  const normalized = Semver.valid(versionValue.toString())
  if (normalized === null || normalized !== versionValue.toString()) {
    return refuse(
      "project.version",
      `npm publication requires a canonical semantic version, got ${JSON.stringify(versionValue)}.`
    )
  }
  const prerelease = Semver.prerelease(normalized) !== null
  if (authored === undefined) {
    if (prerelease) {
      return refuse(
        "publish.npm.distTag",
        "Prerelease npm versions require an explicit non-latest distTag."
      )
    }
    return NpmDistTag.make("latest")
  }
  let tag: NpmDistTag
  try { tag = NpmDistTag.make(authored) } catch (cause) {
    return refuse(
      "publish.npm.distTag",
      cause instanceof Error ? cause.message : String(cause)
    )
  }
  if (prerelease && tag === "latest") {
    return refuse(
      "publish.npm.distTag",
      "Prerelease npm versions cannot publish under the latest dist-tag."
    )
  }
  return tag
}

type ResolvedProject = {
  readonly name: string
  readonly packageName?: string
  readonly version: Version
  readonly repository?: string
}

const npmPublish = (
  authored: AuthoredConfig,
  project: ResolvedProject
): CandidateNpmPublish | undefined => {
  const npm = authored.publish?.npm
  if (npm === undefined) return undefined
  if (authored.npmPackage === undefined) {
    return refuse(
      "npmPackage",
      "publish.npm requires npmPackage to declare the exact package artifact prepared by npm pack."
    )
  }
  const packageName = project.packageName ?? project.name
  if (npm.access === "restricted" && !packageName.startsWith("@")) {
    return refuse(
      "publish.npm.access",
      "npm restricted access is valid only for scoped package names."
    )
  }
  const registry = canonicalRegistry(npm.registry)
  const authentication = npm.authentication
  if (authentication.strategy === "trusted-publishing") {
    if (registry !== "https://registry.npmjs.org/") {
      return refuse(
        "publish.npm.authentication",
        "npm trusted publishing is certified only for https://registry.npmjs.org/."
      )
    }
    if (project.repository === undefined) {
      return refuse(
        "project.repository",
        "npm trusted publishing requires the exact GitHub owner/repository coordinate."
      )
    }
    if (authentication.attestation.repository !== project.repository) {
      return refuse(
        "publish.npm.authentication.attestation.repository",
        `The attested repository ${JSON.stringify(authentication.attestation.repository)} does not match ${
          JSON.stringify(project.repository)
        } resolved for the package.`
      )
    }
  }
  const provenance = npm.provenance ??
    (authentication.strategy === "trusted-publishing" ? "automatic" : "disabled")
  if (authentication.strategy === "token" && provenance === "automatic") {
    return refuse(
      "publish.npm.provenance",
      "Automatic provenance is an npm trusted-publishing behavior; token mode must choose required or disabled."
    )
  }
  return {
    packageArtifact: OutputId.make("npm-package"),
    packageName: NonEmptyName.make(packageName),
    registry,
    distTag: distTag(project.version, npm.distTag),
    access: npm.access ?? "public",
    authentication,
    provenance
  }
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
  const { project, versionFrom: _directive, $schema: _schema, ...rest } = config
  const { tagTemplate: _template, ...projectRest } = project
  const resolvedNames = names(config, observed)
  const resolvedRepository = repository(config, observed)
  // Verified source identity is observation-owned. It must exist, but is not a
  // human-authored config field and is not copied into canonical release intent.
  requireObservedCommit(observed)
  const resolvedProject = {
    ...projectRest,
    ...resolvedNames,
    ...(resolvedRepository === undefined ? {} : { repository: resolvedRepository }),
    version: resolvedVersion,
    tag: tag(config, resolvedVersion)
  }
  const npm = npmPublish(config, resolvedProject)
  const publish = config.publish === undefined ? undefined : {
    ...config.publish,
    ...(config.publish.npm === undefined ? {} : { npm })
  }
  // Plain JSON, not class instances: this value goes straight to `plan`, whose
  // decoder refuses anything with a prototype.
  const plain = toPlainJson({
    ...rest,
    project: resolvedProject,
    ...(publish === undefined ? {} : { publish })
  })
  return toPlainJson(decodeCandidate(plain)) as CandidateConfig
}
