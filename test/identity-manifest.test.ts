import { describe, expect, it, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { CommandSpec } from "../src/grammar/operation.js"
import { resolveManifestIdentity } from "../src/resolve/resolved-release.js"
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
  readonly packageName?: string | undefined
  readonly version?: string | undefined
  readonly packagePath?: string | undefined
  readonly commit?: string | undefined
  readonly tag?: string | undefined
  readonly tagTemplate?: string | undefined
  readonly notes?: string | undefined
}) =>
  resolveManifestIdentity({ project, root: "." })

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
          versionSource: "manifest"
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
          versionSource: "manifest"
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

    it.effect("closes the manifest gap: rejects a non-semver static version", () =>
      Effect.gen(function*() {
        const error = yield* resolveManifest({
          name: "configured",
          version: "not-semver",
          commit: "abc123"
        }).pipe(Effect.flip)

        expect(error._tag).toBe("IdentityError")
        if (error._tag === "IdentityError") {
          expect(error.field).toBe("project.version")
          expect(error.reason).toBe("Version not-semver is not a valid semver version.")
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
          versionSource: "manifest"
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

  layer(
    makeTestCommandRunnerLayer({
      files: new Map([
        ["package.json", JSON.stringify({ name: "@scope/pkg", version: "not-semver" })]
      ])
    })
  )((it) => {
    it.effect("closes the manifest gap: rejects a non-semver package manifest version", () =>
      Effect.gen(function*() {
        const error = yield* resolveManifest({
          commit: "abc123"
        }).pipe(Effect.flip)

        expect(error._tag).toBe("IdentityError")
        if (error._tag === "IdentityError") {
          expect(error.field).toBe("identity.version")
          expect(error.reason).toBe("Version not-semver is not a valid semver version.")
        }
      }))
  })

})
