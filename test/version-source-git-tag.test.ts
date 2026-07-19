import { describe, expect, it, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { makeTestCommandRunnerLayer, commandKey } from "./host-fakes.js"
import { resolveGitTagIdentity } from "../src/engine/resolved-release.js"
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
    readonly version?: string | undefined
    readonly commit?: string | undefined
    readonly tag?: string | undefined
  } | undefined
  readonly snapshot?: boolean | undefined
} = {}) =>
  resolveGitTagIdentity({
    project: {
      name: "release",
      ...(input.project ?? {})
    },
    root: ".",
    snapshot: input.snapshot ?? false
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
          versionSource: "git-tag"
        })
      }))

    it.effect("derives version from the tag even when project version and commit are explicit", () =>
      Effect.gen(function*() {
        const identity = yield* resolveGitTag({ project: { version: "9.9.9", commit: "abc123" } })

        expect(identity).toMatchObject({ version: "1.2.3", commit: "abc123", tag: "v1.2.3" })
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
    const cases = [
      ["lets the environment override discovered tags", {}, "2.0.0-beta.1", "v2.0.0-beta.1"],
      ["prefers an explicit tag over the environment", { tag: "v3.4.5" }, "3.4.5", "v3.4.5"]
    ] as const
    for (const [label, project, version, tag] of cases) {
      it.effect(label, () =>
        Effect.gen(function*() {
          const identity = yield* resolveGitTag({ project: { commit: "abc123", ...project } })
          expect(identity).toMatchObject({ version, tag, commit: "abc123" })
        }))
    }
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

      expect(identity.version).toBe("0.0.0-SNAPSHOT-abc123")
      expect(identity.tag).toBe("v0.0.0")
    }))
})
