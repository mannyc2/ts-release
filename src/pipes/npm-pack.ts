import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Artifact, PackageExtra, SafeRelativePath } from "../pipeline/artifact.js"
import { renderArtifactNameEffect } from "../pipeline/template.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"

export class ReleaseConfigNpmPackageBuild extends Schema.Class<ReleaseConfigNpmPackageBuild>(
  "ReleaseConfigNpmPackageBuild"
)({
  path: Schema.optionalKey(SafeRelativePath)
}) {}

export interface ResolvedNpmPackage {
  readonly path: string
  readonly packageName: string
}

export const resolveNpmPackage = (
  raw: boolean | ReleaseConfigNpmPackageBuild | undefined,
  packageName: string
): Option.Option<ResolvedNpmPackage> => {
  if (raw === undefined || raw === false) {
    return Option.none()
  }
  return Option.some({
    path: raw === true ? "." : raw.path ?? ".",
    packageName
  })
}

export const npmPackPlanner: FeaturePlanner<ResolvedNpmPackage> = {
  id: "build:npm-pack",
  plan: (section, state) =>
    Effect.gen(function*() {
      const path = yield* renderArtifactNameEffect(section.path, { identity: state.identity }, { pipeId: "build:npm-pack", field: "npmPackage.path" })
      return {
        ...emptyContribution,
        artifacts: [
          Artifact.make({
            id: "npm-package",
            kind: "package",
            path,
            producedBy: "build:npm-pack",
            extra: PackageExtra.make({
              packageManager: "npm",
              packageName: section.packageName
            })
          })
        ]
      }
    })
}
