import { describe, expect, it, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import { CommandSpec } from "../src/pipeline/operation.js"
import { manifestSource } from "../src/pipeline/identity/manifest.js"
import { completeIdentity, ResolvedIdentity } from "../src/pipeline/identity/source.js"
import { ReleaseCommandRunner } from "../src/host/host.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"

const gitHeadCommand = (root: string): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: ["rev-parse", "--short", "HEAD"],
    cwd: root,
    requiredEnv: [],
    redactedEnv: []
  })

const resolveManifest = (project: {
  readonly name?: string | undefined
  readonly package?: string | undefined
  readonly packageName?: string | undefined
  readonly version?: string | undefined
  readonly packagePath?: string | undefined
  readonly commit?: string | undefined
  readonly tag?: string | undefined
  readonly tagTemplate?: string | undefined
  readonly notes?: string | undefined
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const commandRunner = yield* ReleaseCommandRunner
    return yield* manifestSource.resolve(
      { project, root: "." },
      { fileSystem, path, commandRunner }
    )
  })

describe("manifest identity source", () => {
  layer(
    makeTestCommandRunnerLayer({
      files: new Map([
        ["package.json", JSON.stringify({ name: "@scope/pkg", version: "1.2.3" })]
      ]),
      commands: new Map([
        [commandKey(gitHeadCommand(".")), {
          exitCode: 0,
          stdout: "81587b5\n",
          stderr: ""
        }]
      ])
    })
  )((it) => {
    it.effect("uses explicit project identity when version is configured", () =>
      Effect.gen(function*() {
        const identity = yield* resolveManifest({
          name: "configured",
          packageName: "package-name",
          version: "2.0.0",
          commit: "abc123",
          tag: "release-2.0.0",
          notes: "notes"
        })

        expect(identity).toMatchObject({
          name: "configured",
          version: "2.0.0",
          commit: "abc123",
          tag: "release-2.0.0",
          notes: "notes",
          sourceId: "manifest"
        })
      }))

    it.effect("falls back to package manifest identity", () =>
      Effect.gen(function*() {
        const identity = yield* resolveManifest({
          commit: "abc123",
          tagTemplate: "v{version}"
        })

        expect(identity).toMatchObject({
          name: "@scope/pkg",
          version: "1.2.3",
          commit: "abc123",
          tag: "v1.2.3",
          sourceId: "manifest"
        })
      }))

    it.effect("reports the existing static identity missing-name error", () =>
      Effect.gen(function*() {
        const error = yield* resolveManifest({
          version: "2.0.0",
          commit: "abc123"
        }).pipe(Effect.flip)

        expect(error._tag).toBe("IdentityError")
        if (error._tag === "IdentityError") {
          expect(error.field).toBe("project.name")
          expect(error.reason).toBe("Static project identity requires project.name or project.packageName.")
        }
      }))

    it.effect("resolves HEAD through the injected command runner", () =>
      Effect.gen(function*() {
        const identity = yield* resolveManifest({
          name: "configured",
          version: "2.0.0",
          commit: "HEAD",
          tagTemplate: "v{version}"
        })

        expect(identity).toMatchObject({
          name: "configured",
          version: "2.0.0",
          commit: "81587b5",
          tag: "v2.0.0",
          sourceId: "manifest"
        })
      }))
  })

  layer(
    makeTestCommandRunnerLayer({
      files: new Map([
        ["package.json", "{not json"]
      ])
    })
  )((it) => {
    it.effect("reports invalid package manifest JSON with the existing message", () =>
      Effect.gen(function*() {
        const error = yield* resolveManifest({
          commit: "abc123"
        }).pipe(Effect.flip)

        expect(error._tag).toBe("IdentityError")
        if (error._tag === "IdentityError") {
          expect(error.field).toBe("identity.packagePath")
          expect(error.reason).toBe("Package manifest is not valid JSON.")
          expect(error.cause).toBeDefined()
        }
      }))
  })

  it("completes resolved identity with normalized name, defaults, and source id", () => {
    const identity = completeIdentity(
      ResolvedIdentity.make({
        name: "@scope/pkg",
        version: "1.2.3",
        commit: "abcdef123",
        sourceId: "manifest"
      }),
      { snapshot: false }
    )

    expect(identity).toMatchObject({
      name: "@scope/pkg",
      normalizedName: "scope-pkg",
      version: "1.2.3",
      tag: "1.2.3",
      commit: "abcdef123",
      shortCommit: "abcdef1",
      versionSource: "manifest",
      snapshot: false
    })
  })
})
