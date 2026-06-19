import { describe, expect, test } from "bun:test"
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
import { minimalConfig } from "./helpers.js"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

describe("config schema", () => {
  test("decodes a minimal release config", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(minimalConfig))
    expect(intent.identity.name).toBe("release")
    expect(intent.targets.map((target) => target._tag).sort()).toEqual([
      "GitHubReleaseTarget",
      "NpmRegistryTarget"
    ])
  })

  test("decodes structured npm trusted publishing config", async () => {
    const config = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\",",
      "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
    )
    const intent = await Effect.runPromise(parseReleaseIntent(config))
    const npm = intent.targets.find((target) => target.id === "npm")

    expect(npm?._tag).toBe("NpmRegistryTarget")
    if (npm?._tag === "NpmRegistryTarget") {
      expect(npm.trustedPublishing?.provider).toBe("github-actions")
      expect(npm.trustedPublishing?.workflow).toBe("release.yml")
      expect(npm.trustedPublishing?.packageExists).toBe(true)
    }
  })

  test("rejects bare trusted publishing boolean", async () => {
    const config = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\",",
      "\"trustedPublishing\":true,"
    )
    const exit = await Effect.runPromiseExit(parseReleaseIntent(config))

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ConfigValidationError")
    }
  })

  test("requires trusted publishing package existence acknowledgement", async () => {
    const config = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\",",
      "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":false},"
    )
    const exit = await Effect.runPromiseExit(parseReleaseIntent(config))

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ConfigValidationError")
    }
  })

  test("reports invalid JSON as a typed parse error", async () => {
    const exit = await Effect.runPromiseExit(parseReleaseIntent("{"))
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ConfigParseError")
    }
  })

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
  })

  test("validates config files without planning target operations", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-config-validation-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const result = await Effect.runPromise(
        validateReleaseConfigFile(ValidateReleaseConfigFileOptions.make({
          root,
          configPath: "release.config.json"
        })).pipe(Effect.provide(BunServices.layer))
      )

      expect(result.valid).toBe(true)
      expect(result.path).toBe("release.config.json")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("config-only validation preserves parse and validation error semantics", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-config-validation-errors-"))
    try {
      await writeFile(join(root, "invalid-json.config.json"), "{")
      const parseExit = await Effect.runPromiseExit(
        validateReleaseConfigFile(ValidateReleaseConfigFileOptions.make({
          root,
          configPath: "invalid-json.config.json"
        })).pipe(Effect.provide(BunServices.layer))
      )
      expect(parseExit._tag).toBe("Failure")
      if (parseExit._tag === "Failure") {
        expect(String(parseExit.cause)).toContain("ConfigParseError")
      }

      const invalidTrustedPublishing = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":false},"
      )
      await writeFile(join(root, "invalid-schema.config.json"), invalidTrustedPublishing)
      const validationExit = await Effect.runPromiseExit(
        validateReleaseConfigFile(ValidateReleaseConfigFileOptions.make({
          root,
          configPath: "invalid-schema.config.json"
        })).pipe(Effect.provide(BunServices.layer))
      )
      expect(validationExit._tag).toBe("Failure")
      if (validationExit._tag === "Failure") {
        expect(String(validationExit.cause)).toContain("ConfigValidationError")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
