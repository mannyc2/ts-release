// Invariant: npmPackage contributes one directory-shaped package artifact and no operations.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, PackageExtra, SafeRelativePath } from "../grammar/artifact.js"
import { featurePlanner } from "../grammar/pipe.js"
import { renderArtifactNameEffect } from "../grammar/template.js"
import { defaulted } from "../grammar/defaulted.js"

export class ReleaseConfigNpmPackageBuild extends Schema.Class<ReleaseConfigNpmPackageBuild>(
  "ReleaseConfigNpmPackageBuild"
)({ path: defaulted(SafeRelativePath, ".") }) {}

export const npmPackPlanner = featurePlanner<ReleaseConfigNpmPackageBuild>("build:npm-pack", (section, state) =>
  renderArtifactNameEffect(section.path, { identity: state.identity }, {
    pipeId: "build:npm-pack", field: "npmPackage.path"
  }).pipe(Effect.map((path) => ({
    artifacts: [Artifact.make({
      id: "npm-package",
      kind: "package",
      path,
      producedBy: "build:npm-pack",
      extra: PackageExtra.make({ packageManager: "npm", packageName: state.identity.name })
    })]
  }))))
