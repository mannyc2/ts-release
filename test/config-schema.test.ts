import { describe, expect, it, layer, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  RELEASE_CONFIG_SCHEMA_ID,
  releaseConfigJsonSchemaDocument,
  renderReleaseConfigJsonSchema
} from "../src/config/schema.js"
import {
  ValidateReleaseConfigFileOptions,
  validateReleaseConfigFile
} from "../src/workflows/config.js"
import { expectTaggedError, minimalConfig, pypiConfig } from "./helpers.js"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

describe("config schema", () => {
  it.effect("decodes a minimal release config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(minimalConfig)
      expect("name" in intent.identity ? intent.identity.name : undefined).toBe("release")
      expect(intent.targets.map((target) => target._tag).sort()).toEqual([
        "GitHubReleaseTarget",
        "NpmRegistryTarget"
      ])
    }))

  it.effect("decodes package-manifest identity", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(JSON.stringify({
        identity: {
          _tag: "PackageManifestReleaseIdentitySource",
          commit: "HEAD",
          tagTemplate: "v{version}"
        },
        artifacts: [],
        targets: [],
        strict: true,
        evidenceDirectory: ".release/evidence/{version}"
      }))

      expect("_tag" in intent.identity ? intent.identity._tag : undefined).toBe("PackageManifestReleaseIdentitySource")
    }))

  it.effect("decodes structured npm trusted publishing config", () =>
    Effect.gen(function*() {
      const config = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
      )
      const intent = yield* parseReleaseIntent(config)
      const npm = intent.targets.find((target) => target.id === "npm")

      expect(npm?._tag).toBe("NpmRegistryTarget")
      if (npm?._tag === "NpmRegistryTarget") {
        expect(npm.trustedPublishing?.provider).toBe("github-actions")
        expect(npm.trustedPublishing?.workflow).toBe("release.yml")
        expect(npm.trustedPublishing?.packageExists).toBe(true)
      }
    }))

  it.effect("rejects bare trusted publishing boolean", () =>
    Effect.gen(function*() {
      const config = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":true,"
      )
      const error = yield* parseReleaseIntent(config).pipe(Effect.flip)

      expectTaggedError(error, "ConfigValidationError")
    }))

  it.effect("requires trusted publishing package existence acknowledgement", () =>
    Effect.gen(function*() {
      const config = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":false},"
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
      const pypi = intent.targets.find((target) => target.id === "pypi")

      expect(pypi?._tag).toBe("PyPiRegistryTarget")
      if (pypi?._tag === "PyPiRegistryTarget") {
        expect(pypi.trustedPublishing?.provider).toBe("github-actions")
        expect(pypi.trustedPublishing?.workflow).toBe("release.yml")
        expect(pypi.trustedPublishing?.publisherConfigured).toBe(true)
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

  const invalidDomainScalarConfigs: ReadonlyArray<readonly [string, string]> = [
    ["release name", minimalConfig.replace("\"name\":\"release\"", "\"name\":\"\"")],
    ["release version", minimalConfig.replace("\"version\":\"0.1.0\"", "\"version\":\"\"")],
    ["git commit", minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"\"")],
    ["git tag", minimalConfig.replace("\"tag\":\"v0.1.0\"", "\"tag\":\"\"")],
    ["artifact id", minimalConfig.replace("\"id\":\"package\"", "\"id\":\"\"")],
    ["target id", minimalConfig.replace("\"id\":\"npm\"", "\"id\":\"\"")]
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
          expect(properties.identity).toBeDefined()
          expect(properties.artifacts).toBeDefined()
          expect(properties.targets).toBeDefined()
          expect(properties.$schema).toBeDefined()
        }
      }
    }

    const serialized = JSON.stringify(schema)
    expect(serialized).toContain("NpmRegistryTarget")
    expect(serialized).toContain("GitHubReleaseTarget")
    expect(serialized).toContain("\"minLength\":1")
  })

  layer(BunServices.layer)((it) => {
    it.effect("validates config files without planning target operations", () =>
      Effect.acquireRelease(
        Effect.promise(() => mkdtemp(join(tmpdir(), "ts-release-config-validation-"))),
        (root) => Effect.promise(() => rm(root, { recursive: true, force: true })).pipe(Effect.orDie)
      ).pipe(
        Effect.flatMap((root) =>
          Effect.gen(function*() {
            yield* Effect.promise(() => writeFile(join(root, "release.config.json"), minimalConfig))
            const result = yield* validateReleaseConfigFile(ValidateReleaseConfigFileOptions.make({
              root,
              configPath: "release.config.json"
            }))

            expect(result.valid).toBe(true)
            expect(result.path).toBe("release.config.json")
          })
        )
      ))

    it.effect("config-only validation preserves parse and validation error semantics", () =>
      Effect.acquireRelease(
        Effect.promise(() => mkdtemp(join(tmpdir(), "ts-release-config-validation-errors-"))),
        (root) => Effect.promise(() => rm(root, { recursive: true, force: true })).pipe(Effect.orDie)
      ).pipe(
        Effect.flatMap((root) =>
          Effect.gen(function*() {
            yield* Effect.promise(() => writeFile(join(root, "invalid-json.config.json"), "{"))
            const parseError = yield* validateReleaseConfigFile(ValidateReleaseConfigFileOptions.make({
              root,
              configPath: "invalid-json.config.json"
            })).pipe(Effect.flip)
            expectTaggedError(parseError, "ConfigParseError")

            const invalidTrustedPublishing = minimalConfig.replace(
              "\"tokenEnv\":\"NPM_TOKEN\",",
              "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":false},"
            )
            yield* Effect.promise(() => writeFile(join(root, "invalid-schema.config.json"), invalidTrustedPublishing))
            const validationError = yield* validateReleaseConfigFile(ValidateReleaseConfigFileOptions.make({
              root,
              configPath: "invalid-schema.config.json"
            })).pipe(Effect.flip)
            expectTaggedError(validationError, "ConfigValidationError")
          })
        )
      ))
  })
})
