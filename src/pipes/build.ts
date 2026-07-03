import * as Effect from "effect/Effect"
import type { ReleaseConfigBuildItem } from "../domain/release.js"
import { bunBuilder, type BunBuildOptions } from "../builders/bun.js"
import { commandBuilder, type CommandBuildOptions } from "../builders/command.js"
import { prebuiltBuilder, type PrebuiltBuildOptions } from "../builders/prebuilt.js"
import type { PlatformTarget } from "../builders/targets.js"
import { PlanError } from "../pipeline/errors.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"

export type * from "../types/effect-internal.js"

export type BuildOptions = BunBuildOptions | CommandBuildOptions | PrebuiltBuildOptions

const buildSections = (config: {
  readonly builds?: ReadonlyArray<ReleaseConfigBuildItem> | undefined
}): ReadonlyArray<BuildOptions> => config.builds ?? []

const targetsFor = (options: BuildOptions): ReadonlyArray<PlatformTarget> => {
  if (options.builder === "bun") {
    if (options.outputs !== undefined) {
      return options.outputs.map((output) => output.target)
    }
    return options.targets ?? ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"]
  }
  return options.targets
}

const unsupportedTargetError = (
  builderId: string,
  target: PlatformTarget,
  supportedTargets: ReadonlyArray<PlatformTarget>
): PlanError =>
  PlanError.make({
    pipeId: "build",
    field: "builds[].targets",
    reason: `Builder ${builderId} does not support target ${target}. Supported targets: ${supportedTargets.join(", ")}.`
  })

const defaultSection = (section: BuildOptions, identity: ReleaseIdentity): BuildOptions => {
  switch (section.builder) {
    case "bun":
      return bunBuilder.defaults(section, identity)
    case "command":
      return commandBuilder.defaults(section, identity)
    case "prebuilt":
      return prebuiltBuilder.defaults(section, identity)
  }
}

const applyDefaults = (sections: ReadonlyArray<BuildOptions>, identity: ReleaseIdentity): ReadonlyArray<BuildOptions> =>
  sections.map((section) => defaultSection(section, identity))

export const buildPipe: Pipe<ReadonlyArray<BuildOptions>> = {
  id: "build",
  phase: "build",
  section: (config) => {
    const sections = buildSections(config)
    return sections.length === 0 ? undefined : sections
  },
  defaults: applyDefaults,
  plan: (sections, state) =>
    Effect.gen(function*() {
      const artifacts = []
      const operations = []
      for (const section of sections) {
        for (const target of targetsFor(section)) {
          switch (section.builder) {
            case "bun": {
              if (!bunBuilder.supportedTargets.includes(target)) {
                return yield* Effect.fail(unsupportedTargetError(bunBuilder.id, target, bunBuilder.supportedTargets))
              }
              const planned = yield* bunBuilder.plan(section, state.identity, target)
              artifacts.push(...planned.artifacts)
              operations.push(...planned.operations)
              break
            }
            case "command": {
              if (!commandBuilder.supportedTargets.includes(target)) {
                return yield* Effect.fail(
                  unsupportedTargetError(commandBuilder.id, target, commandBuilder.supportedTargets)
                )
              }
              const planned = yield* commandBuilder.plan(section, state.identity, target)
              artifacts.push(...planned.artifacts)
              operations.push(...planned.operations)
              break
            }
            case "prebuilt": {
              if (!prebuiltBuilder.supportedTargets.includes(target)) {
                return yield* Effect.fail(
                  unsupportedTargetError(prebuiltBuilder.id, target, prebuiltBuilder.supportedTargets)
                )
              }
              const planned = yield* prebuiltBuilder.plan(section, state.identity, target)
              artifacts.push(...planned.artifacts)
              operations.push(...planned.operations)
              break
            }
          }
        }
      }
      return {
        ...emptyContribution,
        artifacts,
        operations
      }
    })
}
