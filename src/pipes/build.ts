import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { BuilderPlan } from "../builders/builder.js"
import { bunBuilder, type BunBuildOptions } from "../builders/bun.js"
import { commandBuilder, type CommandBuildOptions } from "../builders/command.js"
import { prebuiltBuilder, type PrebuiltBuildOptions } from "../builders/prebuilt.js"
import type { PlatformTarget } from "../pipeline/platform.js"
import { PlanError } from "../pipeline/errors.js"
import { featurePlanner } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"

export type BuildOptions = BunBuildOptions | CommandBuildOptions | PrebuiltBuildOptions

export type ResolvedBunBuildOptions = Omit<BunBuildOptions, "targets"> & {
  readonly targets: ReadonlyArray<PlatformTarget>
}

export type ResolvedBuild =
  | ResolvedBunBuildOptions
  | CommandBuildOptions
  | PrebuiltBuildOptions

const defaultBunTargets: ReadonlyArray<PlatformTarget> =
  ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"]

export const resolveBuilds = (
  raw: ReadonlyArray<BuildOptions> | undefined
): Option.Option<ReadonlyArray<ResolvedBuild>> => {
  if (raw === undefined || raw.length === 0) {
    return Option.none()
  }
  return Option.some(raw.map((build): ResolvedBuild =>
    build.builder === "bun"
      ? {
        ...build,
        targets: build.targets ?? defaultBunTargets
      }
      : build
  ))
}

const planSection = (
  section: ResolvedBuild,
  identity: ReleaseIdentity,
  target: PlatformTarget
): Effect.Effect<BuilderPlan, PlanError> => {
  switch (section.builder) {
    case "bun":
      return bunBuilder(section, identity, target)
    case "command":
      return commandBuilder(section, identity, target)
    case "prebuilt":
      return prebuiltBuilder(section, identity, target)
  }
}

export const buildPlanner = featurePlanner<ReadonlyArray<ResolvedBuild>>("build", (sections, state) =>
    Effect.gen(function*() {
      const artifacts = []
      const operations = []
      for (const section of sections) {
        for (const target of section.targets) {
          const planned = yield* planSection(section, state.identity, target)
          artifacts.push(...planned.artifacts)
          operations.push(...planned.operations)
        }
      }
      return {
        artifacts,
        operations
      }
    }))
