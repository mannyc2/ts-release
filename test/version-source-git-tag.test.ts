import { describe, expect, it, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import { makeTestCommandRunnerLayer, commandKey } from "./host-fakes.js"
import { ReleaseCommandRunner } from "../src/host/host.js"
import { gitTagSource } from "../src/pipeline/identity/git-tag.js"
import { CommandSpec } from "../src/pipeline/operation.js"

const gitCommand = (args: ReadonlyArray<string>): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: [...args],
    cwd: ".",
    requiredEnv: [],
    redactedEnv: []
  })

const gitHeadCommand = gitCommand(["rev-parse", "--short", "HEAD"])
const tagsAtHeadCommand = gitCommand(["tag", "--points-at", "HEAD", "--sort=-version:refname"])
const describeCommand = gitCommand(["describe", "--tags", "--abbrev=0"])

const resolveGitTag = (input: {
  readonly project?: {
    readonly name?: string | undefined
    readonly packageName?: string | undefined
    readonly commit?: string | undefined
    readonly tag?: string | undefined
  } | undefined
  readonly snapshot?: boolean | undefined
} = {}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const commandRunner = yield* ReleaseCommandRunner
    return yield* gitTagSource.resolve(
      {
        project: {
          name: "release",
          ...(input.project ?? {})
        },
        root: ".",
        snapshot: input.snapshot ?? false
      },
      { fileSystem, path, commandRunner }
    )
  })

describe("git-tag identity source", () => {
  layer(
    makeTestCommandRunnerLayer({
      commands: new Map([
        [commandKey(gitHeadCommand), { exitCode: 0, stdout: "abcdef1\n", stderr: "" }],
        [commandKey(tagsAtHeadCommand), { exitCode: 0, stdout: "v1.2.3\nv1.0.0\n", stderr: "" }],
        [commandKey(describeCommand), { exitCode: 0, stdout: "v1.1.0\n", stderr: "" }]
      ])
    })
  )((it) => {
    it.effect("uses the highest version tag pointing at HEAD", () =>
      Effect.gen(function*() {
        const identity = yield* resolveGitTag()

        expect(identity).toMatchObject({
          name: "release",
          version: "1.2.3",
          commit: "abcdef1",
          tag: "v1.2.3",
          sourceId: "git-tag"
        })
      }))

    it.effect("does not need a commit command when commit is configured", () =>
      Effect.gen(function*() {
        const identity = yield* resolveGitTag({ project: { commit: "abc123" } })

        expect(identity.version).toBe("1.2.3")
      }))
  })

  layer(
    makeTestCommandRunnerLayer({
      env: new Map([["TS_RELEASE_CURRENT_TAG", "v2.0.0-beta.1"]]),
      commands: new Map([
        [commandKey(tagsAtHeadCommand), { exitCode: 0, stdout: "v1.2.3\n", stderr: "" }]
      ])
    })
  )((it) => {
    it.effect("lets the environment override discovered tags", () =>
      Effect.gen(function*() {
        const identity = yield* resolveGitTag({ project: { commit: "abc123" } })

        expect(identity.version).toBe("2.0.0-beta.1")
        expect(identity.tag).toBe("v2.0.0-beta.1")
      }))
  })

  layer(
    makeTestCommandRunnerLayer({
      commands: new Map([
        [commandKey(tagsAtHeadCommand), { exitCode: 0, stdout: "", stderr: "" }],
        [commandKey(describeCommand), { exitCode: 0, stdout: "v1.1.0\n", stderr: "" }]
      ])
    })
  )((it) => {
    it.effect("falls back to the nearest ancestor tag", () =>
      Effect.gen(function*() {
        const identity = yield* resolveGitTag({ project: { commit: "abc123" } })

        expect(identity.version).toBe("1.1.0")
        expect(identity.tag).toBe("v1.1.0")
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
        const error = yield* resolveGitTag({
          project: {
            name: "",
            commit: "abc123"
          }
        }).pipe(Effect.flip)

        expect(error._tag).toBe("IdentityError")
        if (error._tag === "IdentityError") {
          expect(error.field).toBe("project.name")
          expect(error.reason).toBe("Package manifest is not valid JSON.")
          expect(error.cause).toBeDefined()
        }
      }))
  })

  it.effect("strips one leading v from an explicit configured tag", () =>
    Effect.gen(function*() {
      const identity = yield* resolveGitTag({
        project: {
          commit: "abc123",
          tag: "v3.4.5"
        }
      }).pipe(Effect.provide(makeTestCommandRunnerLayer()))

      expect(identity.version).toBe("3.4.5")
      expect(identity.tag).toBe("v3.4.5")
    }))

  it.effect("reports invalid semver tags by name", () =>
    Effect.gen(function*() {
      const error = yield* resolveGitTag({
        project: {
          commit: "abc123",
          tag: "release-1"
        }
      }).pipe(Effect.provide(makeTestCommandRunnerLayer()), Effect.flip)

      expect(error._tag).toBe("IdentityError")
      if (error._tag === "IdentityError") {
        expect(error.reason).toContain("release-1")
      }
    }))

  it.effect("reports missing tags and names snapshot as the escape hatch", () =>
    Effect.gen(function*() {
      const error = yield* resolveGitTag({ project: { commit: "abc123" } }).pipe(
        Effect.provide(makeTestCommandRunnerLayer({
          commands: new Map([
            [commandKey(tagsAtHeadCommand), { exitCode: 0, stdout: "", stderr: "" }],
            [commandKey(describeCommand), { exitCode: 1, stdout: "", stderr: "fatal: no tags" }]
          ])
        })),
        Effect.flip
      )

      expect(error._tag).toBe("IdentityError")
      if (error._tag === "IdentityError") {
        expect(error.reason).toContain("--snapshot")
      }
    }))

  it.effect("uses a 0.0.0 base when snapshot has no git tag", () =>
    Effect.gen(function*() {
      const identity = yield* resolveGitTag({
        project: { commit: "abc123" },
        snapshot: true
      }).pipe(
        Effect.provide(makeTestCommandRunnerLayer({
          commands: new Map([
            [commandKey(tagsAtHeadCommand), { exitCode: 0, stdout: "", stderr: "" }],
            [commandKey(describeCommand), { exitCode: 1, stdout: "", stderr: "fatal: no tags" }]
          ])
        }))
      )

      expect(identity.version).toBe("0.0.0")
      expect(identity.tag).toBe("v0.0.0")
    }))
})
