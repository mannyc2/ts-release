// Invariant: each resolved build target is delegated to exactly one builder adapter in declared order.
import * as Effect from "effect/Effect"
import type { BuilderPlan } from "./builder.js"
import { bunBuilder, type BunBuildOptions } from "./bun.js"
import { commandBuilder, type CommandBuildOptions } from "./command.js"
import { prebuiltBuilder, type PrebuiltBuildOptions } from "./prebuilt.js"
import type { PlatformTarget } from "../grammar/platform.js"
import { PlanError } from "../grammar/errors.js"
import { featurePlanner } from "../grammar/pipe.js"
import type { ReleaseIdentity } from "../grammar/state.js"

export type BuildOptions = BunBuildOptions | CommandBuildOptions | PrebuiltBuildOptions

const planSection = (
  section: BuildOptions,
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

export const buildPlanner = featurePlanner<ReadonlyArray<BuildOptions>>("build", (sections, state) =>
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
