import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { Builder, BuilderPlan } from "../builders/builder.js"
import { bunBuilder, type BunBuildOptions } from "../builders/bun.js"
import { commandBuilder, type CommandBuildOptions } from "../builders/command.js"
import { prebuiltBuilder, type PrebuiltBuildOptions } from "../builders/prebuilt.js"
import type { PlatformTarget } from "../pipeline/platform.js"
import { PlanError } from "../pipeline/errors.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
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

const checkAndPlan = <Options extends { readonly builder: string }>(
  builder: Builder<Options>,
  options: Options,
  identity: ReleaseIdentity,
  target: PlatformTarget
): Effect.Effect<BuilderPlan, PlanError> =>
  builder.supportedTargets.includes(target)
    ? builder.plan(options, identity, target)
    : Effect.fail(PlanError.make({
      pipeId: "build",
      field: "builds[].targets",
      reason:
        `Builder ${builder.id} does not support target ${target}. Supported targets: ${builder.supportedTargets.join(", ")}.`
    }))

const planSection = (
  section: ResolvedBuild,
  identity: ReleaseIdentity,
  target: PlatformTarget
): Effect.Effect<BuilderPlan, PlanError> => {
  switch (section.builder) {
    case "bun":
      return checkAndPlan(bunBuilder, section, identity, target)
    case "command":
      return checkAndPlan(commandBuilder, section, identity, target)
    case "prebuilt":
      return checkAndPlan(prebuiltBuilder, section, identity, target)
  }
}

export const buildPlanner: FeaturePlanner<ReadonlyArray<ResolvedBuild>> = {
  id: "build",
  plan: (sections, state) =>
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
        ...emptyContribution,
        artifacts,
        operations
      }
    })
}
