import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, PackageExtra, SafeRelativePath } from "../pipeline/artifact.js"
import { renderArtifactNameEffect } from "../pipeline/template.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"

export class ReleaseConfigNpmPackageBuild extends Schema.Class<ReleaseConfigNpmPackageBuild>(
  "ReleaseConfigNpmPackageBuild"
)({
  path: Schema.optionalKey(SafeRelativePath)
}) {}

export type NpmPackageSection = true | ReleaseConfigNpmPackageBuild

const sectionFromConfig = (config: {
  readonly npmPackage?: boolean | ReleaseConfigNpmPackageBuild | undefined
}): NpmPackageSection | undefined => {
  const section = config.npmPackage
  return section === false ? undefined : section
}

export const npmPackPipe: Pipe<NpmPackageSection> = {
  id: "build:npm-pack",
  phase: "build",
  section: sectionFromConfig,
  defaults: (section) => section,
  plan: (section, state) =>
    Effect.gen(function*() {
      const config = section === true ? undefined : section
      const packageName = state.identity.name
      const path = yield* renderArtifactNameEffect(config?.path ?? ".", { identity: state.identity }, { pipeId: "build:npm-pack", field: "npmPackage.path" })
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
              packageName
            })
          })
        ]
      }
    })
}
