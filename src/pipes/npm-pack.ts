// Invariant: npmPackage contributes one directory-shaped package artifact and no operations.
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Artifact, PackageExtra, SafeRelativePath } from "../pipeline/artifact.js"
import { featurePlanner } from "../pipeline/pipe.js"
import { renderArtifactNameEffect } from "../pipeline/template.js"

export class ReleaseConfigNpmPackageBuild extends Schema.Class<ReleaseConfigNpmPackageBuild>(
  "ReleaseConfigNpmPackageBuild"
)({ path: Schema.optionalKey(SafeRelativePath) }) {}

export interface ResolvedNpmPackage { readonly path: string; readonly packageName: string }
export const resolveNpmPackage = (
  raw: boolean | ReleaseConfigNpmPackageBuild | undefined,
  packageName: string
): Option.Option<ResolvedNpmPackage> => raw === undefined || raw === false
  ? Option.none()
  : Option.some({ path: raw === true ? "." : raw.path ?? ".", packageName })

export const npmPackPlanner = featurePlanner<ResolvedNpmPackage>("build:npm-pack", (section, state) =>
  renderArtifactNameEffect(section.path, { identity: state.identity }, {
    pipeId: "build:npm-pack", field: "npmPackage.path"
  }).pipe(Effect.map((path) => ({
    artifacts: [Artifact.make({
      id: "npm-package",
      kind: "package",
      path,
      producedBy: "build:npm-pack",
      extra: PackageExtra.make({ packageManager: "npm", packageName: section.packageName })
    })]
  }))))
