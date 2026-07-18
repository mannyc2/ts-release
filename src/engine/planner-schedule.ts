import * as Option from "effect/Option"
import { schedule } from "../pipeline/pipe.js"
import { archivePlanner } from "../pipes/archive.js"
import { buildPlanner } from "../pipes/build.js"
import { catalogHomebrewPlanner } from "../pipes/catalog-homebrew.js"
import { catalogScoopPlanner } from "../pipes/catalog-scoop.js"
import { catalogGenericPlanner } from "../pipes/catalog-generic.js"
import { checksumPlanner } from "../pipes/checksum.js"
import { importArtifactsPlanner } from "../pipes/import-artifacts.js"
import { npmPackPlanner } from "../pipes/npm-pack.js"
import { publishGitHubPlanner } from "../pipes/publish-github.js"
import { publishHomebrewPlanner } from "../pipes/publish-homebrew.js"
import { publishCatalogGenericPlanner } from "../pipes/publish-catalog-generic.js"
import { publishNpmPlanner } from "../pipes/publish-npm.js"
import { publishPyPiPlanner } from "../pipes/publish-pypi.js"
import { publishScoopPlanner } from "../pipes/publish-scoop.js"
import { pypiWheelPlanner } from "../pipes/pypi-wheel.js"
import type { ResolvedRelease } from "./resolved-release.js"

export const buildPlannerSchedule = (release: ResolvedRelease) => [
  schedule(buildPlanner, release.builds),
  schedule(npmPackPlanner, release.npmPackage),
  schedule(pypiWheelPlanner, release.pypiWheels),
  schedule(importArtifactsPlanner, release.artifacts),
  schedule(archivePlanner, release.archives),
  schedule(checksumPlanner, release.checksum)
]

export const distributionPlannerSchedule = (release: ResolvedRelease) => [
  schedule(catalogHomebrewPlanner, release.homebrew),
  schedule(catalogScoopPlanner, release.scoop),
  ...(Option.isSome(release.catalogs) ? [schedule(catalogGenericPlanner, release.catalogs)] : []),
  schedule(publishNpmPlanner, release.npm),
  schedule(publishPyPiPlanner, release.pypi),
  schedule(publishGitHubPlanner, release.github),
  schedule(publishHomebrewPlanner, release.homebrew),
  schedule(publishScoopPlanner, release.scoop),
  ...(Option.isSome(release.catalogs) ? [schedule(publishCatalogGenericPlanner, release.catalogs)] : [])
]
