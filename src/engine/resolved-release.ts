import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { ReleaseIntent } from "../config/schema.js"
import { gitTagSource } from "../pipeline/identity/git-tag.js"
import { manifestSource } from "../pipeline/identity/manifest.js"
import { completeIdentity, ResolvedIdentity } from "../pipeline/identity/source.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import { resolveArchives } from "../pipes/archive.js"
import { resolveBuilds } from "../pipes/build.js"
import { resolveCatalogs } from "../pipes/catalog-generic.js"
import { resolveHomebrew } from "../pipes/catalog-homebrew.js"
import { resolveScoop } from "../pipes/catalog-scoop.js"
import { resolveChecksum } from "../pipes/checksum.js"
import { resolveManualArtifacts } from "../pipes/import-artifacts.js"
import { resolveNpmPackage } from "../pipes/npm-pack.js"
import { resolveGitHubPublish } from "../pipes/publish-github.js"
import { resolveNpmPublish } from "../pipes/publish-npm.js"
import { resolvePyPiPublish } from "../pipes/publish-pypi.js"
import { resolvePyPiWheels } from "../pipes/pypi-wheel.js"
import { githubRepository } from "../pipes/shared.js"

const applySnapshotModifier = (resolved: ResolvedIdentity): ResolvedIdentity => {
  const shortCommit = resolved.commit.slice(0, 7) || "snapshot"
  return ResolvedIdentity.make({
    name: resolved.name,
    version: `${resolved.version}-SNAPSHOT-${shortCommit}`,
    commit: resolved.commit,
    tag: resolved.tag,
    notes: resolved.notes,
    sourceId: resolved.sourceId
  })
}

const evidenceDirectory = (intent: ReleaseIntent, identity: ReleaseIdentity): string => {
  const template = typeof intent.evidence === "string"
    ? intent.evidence
    : intent.evidence?.directory ?? ".release/evidence"
  return template.split("{version}").join(identity.version)
}

export const resolveRelease = (
  intent: ReleaseIntent,
  identity: ReleaseIdentity
) => ({
  identity,
  builds: resolveBuilds(intent.builds),
  npmPackage: resolveNpmPackage(intent.npmPackage, identity.name),
  pypiWheels: resolvePyPiWheels(intent.pypiWheel),
  artifacts: resolveManualArtifacts(intent.artifacts),
  archives: resolveArchives(intent.archives),
  checksum: resolveChecksum(intent.checksum),
  npm: Option.fromUndefinedOr(resolveNpmPublish(intent, identity)),
  pypi: Option.fromUndefinedOr(resolvePyPiPublish(intent.publish.pypi)),
  github: Option.fromUndefinedOr(resolveGitHubPublish(intent)),
  homebrew: Option.fromUndefinedOr(resolveHomebrew(intent)),
  scoop: Option.fromUndefinedOr(resolveScoop(intent)),
  catalogs: Option.fromUndefinedOr(resolveCatalogs(intent.catalogs, githubRepository(intent))),
  evidenceDirectory: evidenceDirectory(intent, identity)
})

export type ResolvedRelease = Readonly<ReturnType<typeof resolveRelease>>

export const resolveReleaseWorkflow = Effect.fn("release.resolve")(function*(
  intent: ReleaseIntent,
  root: string,
  snapshot: boolean
) {
  const source = intent.versionFrom ?? "manifest"
  const resolved = source === "git-tag"
    ? yield* gitTagSource.resolve({ project: intent.project, root, snapshot })
    : yield* manifestSource.resolve({ project: intent.project, root })
  const identity = completeIdentity(snapshot ? applySnapshotModifier(resolved) : resolved, { snapshot })
  return resolveRelease(intent, identity)
})
