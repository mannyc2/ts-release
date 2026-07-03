import * as Effect from "effect/Effect"
import { Artifact, PackageExtra } from "../pipeline/artifact.js"
import { renderTemplate } from "../pipeline/template.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseConfigNpmPackageBuild } from "../domain/release.js"

export type NpmPackageSection = true | ReleaseConfigNpmPackageBuild

const sectionFromConfig = (config: {
  readonly npmPackage?: boolean | ReleaseConfigNpmPackageBuild | undefined
  readonly build?: { readonly npmPackage?: boolean | ReleaseConfigNpmPackageBuild | undefined } | undefined
}): NpmPackageSection | undefined => {
  const section = config.npmPackage ?? config.build?.npmPackage
  return section === false ? undefined : section
}

export const npmPackPipe: Pipe<NpmPackageSection> = {
  id: "build:npm-pack",
  phase: "build",
  section: sectionFromConfig,
  defaults: (section) => section,
  plan: (section, state) => {
    const config = section === true ? undefined : section
    const packageName = state.identity.name
    const path = renderTemplate(config?.path ?? ".", { identity: state.identity })
    return Effect.succeed({
      ...emptyContribution,
      artifacts: [
        Artifact.make({
          id: config?.id ?? "npm-package",
          kind: "package",
          path,
          producedBy: "build:npm-pack",
          extra: PackageExtra.make({
            packageManager: "npm",
            packageName
          })
        })
      ]
    })
  }
}
