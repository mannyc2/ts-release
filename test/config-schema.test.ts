import { describe, expect, it, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  RELEASE_CONFIG_SCHEMA_ID,
  releaseConfigJsonSchemaDocument,
  renderReleaseConfigJsonSchema
} from "../src/config/schema.js"
import { expectTaggedError, minimalConfig, pypiConfig } from "./helpers.js"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

describe("config schema", () => {
  it.effect("decodes a minimal release config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(minimalConfig)
      expect(intent.project.name).toBe("release")
      expect(intent.build?.npmPackage).toBeDefined()
      expect(intent.publish.github).toBeDefined()
      expect(intent.publish.npm).toBeDefined()
    }))

  it.effect("decodes package-manifest identity", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(JSON.stringify({
        project: {
          commit: "HEAD",
          tagTemplate: "v{version}"
        },
        publish: {},
        strict: true,
        evidence: ".release/evidence/{version}"
      }))

      expect(intent.project.commit).toBe("HEAD")
      expect(intent.project.tagTemplate).toBe("v{version}")
    }))

  it.effect("decodes structured npm trusted publishing config", () =>
    Effect.gen(function*() {
      const config = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\"",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true}"
      )
      const intent = yield* parseReleaseIntent(config)
      const npm = intent.publish.npm

      expect(typeof npm).toBe("object")
      if (npm !== undefined && typeof npm === "object") {
        const trustedPublishing = npm.trustedPublishing
        expect(typeof trustedPublishing).toBe("object")
        if (trustedPublishing !== undefined && typeof trustedPublishing === "object") {
          expect(trustedPublishing.provider).toBe("github-actions")
          expect(trustedPublishing.workflow).toBe("release.yml")
          expect(trustedPublishing.packageExists).toBe(true)
        }
      }
    }))

  it.effect("decodes bare trusted publishing boolean", () =>
    Effect.gen(function*() {
      const config = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\"",
        "\"trustedPublishing\":true"
      )
      const intent = yield* parseReleaseIntent(config)
      const npm = intent.publish.npm

      expect(typeof npm).toBe("object")
      if (npm !== undefined && typeof npm === "object") {
        expect(npm.trustedPublishing).toBe(true)
      }
    }))

  it.effect("requires trusted publishing package existence acknowledgement", () =>
    Effect.gen(function*() {
      const config = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\"",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":false}"
      )
      const error = yield* parseReleaseIntent(config).pipe(Effect.flip)

      expectTaggedError(error, "ConfigValidationError")
    }))

  it.effect("decodes structured PyPI trusted publishing config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(pypiConfig({
        usernameEnv: undefined,
        passwordEnv: undefined,
        trustedPublishing: {
          provider: "github-actions",
          workflow: "release.yml",
          publisherConfigured: true
        }
      }))
      const pypi = intent.publish.pypi

      expect(typeof pypi).toBe("object")
      if (pypi !== undefined && typeof pypi === "object") {
        const trustedPublishing = pypi.trustedPublishing
        expect(typeof trustedPublishing).toBe("object")
        if (trustedPublishing !== undefined && typeof trustedPublishing === "object") {
          expect(trustedPublishing.provider).toBe("github-actions")
          expect(trustedPublishing.workflow).toBe("release.yml")
          expect(trustedPublishing.publisherConfigured).toBe(true)
        }
      }
    }))

  it.effect("requires PyPI trusted publisher setup acknowledgement", () =>
    Effect.gen(function*() {
      const error = yield* parseReleaseIntent(pypiConfig({
        usernameEnv: undefined,
        passwordEnv: undefined,
        trustedPublishing: {
          provider: "github-actions",
          workflow: "release.yml",
          publisherConfigured: false
        }
      })).pipe(Effect.flip)

      expectTaggedError(error, "ConfigValidationError")
    }))

  const legacyFieldConfigs: ReadonlyArray<readonly [string, string]> = [
    ["_tag", minimalConfig.replace("\"project\":{", "\"_tag\":\"NpmRegistryTarget\",\"project\":{")],
    ["dryRunSupport", minimalConfig.replace("\"publish\":{\"npm\":{", "\"publish\":{\"npm\":{\"dryRunSupport\":\"native\",")],
    ["mutability", minimalConfig.replace("\"publish\":{\"npm\":{", "\"publish\":{\"npm\":{\"mutability\":\"immutable\",")],
    ["recovery", minimalConfig.replace("\"publish\":{\"npm\":{", "\"publish\":{\"npm\":{\"recovery\":\"manual\",")]
  ]

  for (const [field, config] of legacyFieldConfigs) {
    it.effect(`rejects removed legacy config field ${field}`, () =>
      Effect.gen(function*() {
        const error = yield* parseReleaseIntent(config).pipe(Effect.flip)

        expectTaggedError(error, "ConfigValidationError")
      }))
  }

  const invalidDomainScalarConfigs: ReadonlyArray<readonly [string, string]> = [
    ["release name", minimalConfig.replace("\"name\":\"release\"", "\"name\":\"\"")],
    ["release version", minimalConfig.replace("\"version\":\"0.1.0\"", "\"version\":\"\"")],
    ["git commit", minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"\"")],
    ["git tag", minimalConfig.replace("\"tag\":\"v0.1.0\"", "\"tag\":\"\"")],
    ["artifact id", minimalConfig.replace("\"id\":\"package\"", "\"id\":\"\"")],
    ["npm package name", minimalConfig.replace("\"packageName\":\"release\",\"packagePath\"", "\"packageName\":\"\",\"packagePath\"")]
  ]

  for (const [label, config] of invalidDomainScalarConfigs) {
    it.effect(`rejects empty ${label}`, () =>
      Effect.gen(function*() {
        const error = yield* parseReleaseIntent(config).pipe(Effect.flip)

        expectTaggedError(error, "ConfigValidationError")
      }))
  }

  it.effect("reports invalid JSON as a typed parse error", () =>
    Effect.gen(function*() {
      const error = yield* parseReleaseIntent("{").pipe(Effect.flip)
      expect(isRecord(error) ? error._tag : undefined).toBe("ConfigParseError")
      if (isRecord(error)) {
        expect(error.reason).toBe("Release config is not valid JSON.")
        expect(error.cause).toBeDefined()
      }
    }))

  test("renders a release config JSON Schema document", () => {
    const schema = releaseConfigJsonSchemaDocument()
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema")
    expect(schema.$id).toBe(RELEASE_CONFIG_SCHEMA_ID)
    expect(renderReleaseConfigJsonSchema()).toContain("\"ReleaseIntent\"")

    const defs = schema.$defs
    expect(isRecord(defs)).toBe(true)
    if (isRecord(defs)) {
      const releaseIntent = defs.ReleaseIntent
      expect(isRecord(releaseIntent)).toBe(true)
      if (isRecord(releaseIntent)) {
        const properties = releaseIntent.properties
        expect(isRecord(properties)).toBe(true)
        if (isRecord(properties)) {
          expect(properties.project).toBeDefined()
          expect(properties.build).toBeDefined()
          expect(properties.publish).toBeDefined()
          expect(properties.$schema).toBeDefined()
        }
      }
    }

    const serialized = JSON.stringify(schema)
    expect(serialized).toContain("ReleaseConfigNpmPublish")
    expect(serialized).toContain("ReleaseConfigGitHubPublish")
    expect(serialized).not.toContain("NpmRegistryTarget")
    expect(serialized).not.toContain("GitHubReleaseTarget")
  })
})
