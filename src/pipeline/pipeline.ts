import type { Pipe } from "./pipe.js"
import { archivePipe } from "../pipes/archive.js"
import { buildPipe } from "../pipes/build.js"
import { catalogHomebrewPipe } from "../pipes/catalog-homebrew.js"
import { catalogScoopPipe } from "../pipes/catalog-scoop.js"
import { checksumPipe } from "../pipes/checksum.js"
import { importArtifactsPipe } from "../pipes/import-artifacts.js"
import { npmPackPipe } from "../pipes/npm-pack.js"
import { publishGitHubPipe } from "../pipes/publish-github.js"
import { publishHomebrewPipe } from "../pipes/publish-homebrew.js"
import { publishNpmPipe } from "../pipes/publish-npm.js"
import { publishPyPiPipe } from "../pipes/publish-pypi.js"
import { publishScoopPipe } from "../pipes/publish-scoop.js"
import { pypiWheelPipe } from "../pipes/pypi-wheel.js"


export const buildPipeline: ReadonlyArray<Pipe<unknown>> = [
  buildPipe,
  npmPackPipe,
  pypiWheelPipe,
  importArtifactsPipe,
  archivePipe,
  checksumPipe
]

export const publishPipeline: ReadonlyArray<Pipe<unknown>> = [
  catalogHomebrewPipe,
  catalogScoopPipe,
  publishNpmPipe,
  publishPyPiPipe,
  publishGitHubPipe,
  publishHomebrewPipe,
  publishScoopPipe
]
