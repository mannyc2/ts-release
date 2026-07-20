import { describe, expect, it, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { decodeReleaseIntent, parseReleaseIntent } from "../src/config/load.js"
import { RELEASE_CONFIG_SCHEMA_ID, releaseConfigJsonSchemaDocument, renderReleaseConfigJsonSchema } from "../src/config/schema.js"
import { expectTaggedError, minimalConfig, pypiConfig } from "./helpers.js"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const expectValidationReason = (error: unknown, ...fragments: ReadonlyArray<string>): Record<string, unknown> => {
  expectTaggedError(error, "ConfigError")
  const record = isRecord(error) ? error : {}
  expect(typeof record.reason).toBe("string")
  const reason = typeof record.reason === "string" ? record.reason : ""
  for (const fragment of fragments) expect(reason).toContain(fragment)
  return record
}

const expectValidationFailure = (
  effect: Effect.Effect<unknown, unknown>, fragments: ReadonlyArray<string> = [], source?: string
): Effect.Effect<void, unknown> =>
  effect.pipe(Effect.flip, Effect.map((error) => {
    const record = expectValidationReason(error, ...fragments)
    if (source !== undefined) expect(record.path).toBe(source)
  }))

describe("config schema", () => {
  it.effect("decodes a minimal release config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(minimalConfig)
      expect(intent.project.name).toBe("release")
      expect(intent.npmPackage).toBeDefined()
      expect(intent.publish.github).toBeDefined()
      expect(intent.publish.npm).toBeDefined()
    }))
  it.effect("decodes package-manifest identity", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(JSON.stringify({
        project: { commit: "HEAD", tagTemplate: "v{version}" }, publish: {}, evidence: ".release/evidence/{version}"
      }))
      expect(intent.project.commit).toBe("HEAD")
      expect(intent.project.tagTemplate).toBe("v{version}")
    }))
  it.effect("decodes Plan 126 config additions", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(JSON.stringify({
        project: { name: "release", commit: "abc123", tag: "v1.2.3" },
        versionFrom: "git-tag",
        archives: [{ formats: ["tar.gz", "zip"], wrapInDirectory: true }],
        checksum: { algorithm: "sha512" },
        catalogs: [{ id: "index", repository: "owner/catalog", directory: "checkout", file: "index.json",
          content: ["hash=", { fact: "sha256", artifact: "archive" }], validate: ["catalog-lint", "."] }],
        publish: { github: { repository: "owner/repo", prerelease: "auto" } }
      }))

      expect(intent.versionFrom).toBe("git-tag")
      expect(intent.archives?.[0]?.formats).toEqual(["tar.gz", "zip"])
      expect(intent.checksum?.algorithm).toBe("sha512")
      expect(intent.catalogs?.[0]).toMatchObject({ id: "index", file: "index.json", validate: ["catalog-lint", "."] })
      expect(intent.publish.github).toMatchObject({ prerelease: "auto" })
    }))
  it.effect("decodes structured npm trusted publishing config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\"",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"verifyPackageExists\":true}"
      ))
      expect(intent.publish.npm).toMatchObject({ trustedPublishing: {
        provider: "github-actions", workflow: "release.yml", verifyPackageExists: true } })
    }))
  it.effect("decodes empty trusted publishing section to defaults", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\"",
        "\"trustedPublishing\":{}"
      ))
      expect(intent.publish.npm).toMatchObject({ trustedPublishing: {
        provider: "github-actions", workflow: "release.yml" } })
    }))
  for (const [path, config] of [
    ["npmPackage", { project: {}, npmPackage: true, publish: {} }],
    ["publish.npm", { project: {}, publish: { npm: true } }],
    ["publish.github", { project: {}, publish: { github: true } }],
    ["publish.pypi", { project: {}, publish: { pypi: true } }],
    ["publish.npm.trustedPublishing", { project: {}, publish: { npm: { trustedPublishing: true } } }],
    ["publish.pypi.trustedPublishing", { project: {}, publish: { pypi: { trustedPublishing: true } } }]
  ] as ReadonlyArray<readonly [string, unknown]>)
    it.effect(`rejects the removed boolean spelling at ${path}`, () =>
      expectValidationFailure(
        decodeReleaseIntent(config),
        [`Release config no longer accepts booleans at ${path}.`,
          "Use {} to enable with defaults, or remove the key to disable."]
      ))
  it.effect("rejects removed npm trusted publishing packageExists", () =>
    expectValidationFailure(
      parseReleaseIntent(minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\"",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true}"
      )),
      ["$.publish.npm.trustedPublishing.packageExists", "verifyPackageExists"]
    ))
  it.effect("rejects removed Homebrew artifactId without rejecting Scoop artifactId", () =>
    expectValidationFailure(
      decodeReleaseIntent({
        project: {},
        publish: { homebrew: { artifactId: "archive" }, scoop: { artifactId: "archive" } }
      }),
      ["$.publish.homebrew.artifactId", "artifactIds"]
    ))
  for (const [target, hint] of [
    ["homebrew", "Homebrew tap publishing uses ambient git credentials; tokenEnv was removed."],
    ["scoop", "Scoop bucket publishing uses ambient git credentials; tokenEnv was removed."]
  ] as const) {
    it.effect(`rejects removed ${target} tokenEnv with a migration hint`, () =>
      expectValidationFailure(
        decodeReleaseIntent({ project: {}, publish: { [target]: { tokenEnv: "TOKEN" } } }),
        [`$.publish.${target}.tokenEnv`, hint]
      ))
  }
  const unknownFieldInputs: ReadonlyArray<readonly [string, unknown, string]> = [
    ["top-level", { project: {}, publish: {}, unexpectedTopLevel: true }, `["unexpectedTopLevel"]`],
    ["nested object", { project: { unexpectedProjectField: true }, publish: {} }, `["project"]["unexpectedProjectField"]`],
    ["union arm", {
      project: {},
      publish: { npm: { registry: "https://registry.npmjs.org", unexpectedNpmField: true } }
    }, `["publish"]["npm"]["unexpectedNpmField"]`],
    ["array item", {
      project: {},
      artifacts: [{ id: "archive", path: "artifacts/release.tar.gz", format: "tarball", unexpectedArtifactField: true }],
      publish: {}
    }, `["artifacts"][0]["unexpectedArtifactField"]`]
  ]
  for (const [label, input, expectedPath] of unknownFieldInputs) {
    it.effect(`rejects an unknown ${label} config field`, () =>
      expectValidationFailure(decodeReleaseIntent(input, "inline-release-config"), [expectedPath], "inline-release-config"))
  }
  it.effect("decodes explicit non-empty PyPI artifactIds", () =>
    Effect.gen(function*() {
      const intent = yield* decodeReleaseIntent({ project: {}, publish: { pypi: { artifactIds: ["wheel-artifact"] } } })
      expect(intent.publish.pypi).toMatchObject({ artifactIds: ["wheel-artifact"] })
    }))
  const invalidConfigInputs: ReadonlyArray<readonly [string, unknown, string]> = [
    ["Homebrew artifactIds", { project: {}, publish: {
      homebrew: { repository: "owner/homebrew-tap", artifactIds: [] } } }, `["publish"]["homebrew"]["artifactIds"]`],
    ["PyPI artifactIds", { project: {}, publish: { pypi: { artifactIds: [] } } }, `["publish"]["pypi"]["artifactIds"]`],
    ["catalog directory", { project: {}, catalogs: [{ id: "index", repository: "owner/catalog",
      directory: "../checkout", file: "index.json", content: "{}" }], publish: {} }, `["catalogs"][0]["directory"]`]
  ]
  for (const [label, input, expectedPath] of invalidConfigInputs) {
    it.effect(`rejects invalid ${label} during config decode`, () =>
      expectValidationFailure(decodeReleaseIntent(input), [expectedPath]))
  }
  it.effect("decodes structured PyPI trusted publishing config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(pypiConfig({
        trustedPublishing: { provider: "github-actions", workflow: "release.yml", publisherConfigured: true }
      }))
      expect(intent.publish.pypi).toMatchObject({ trustedPublishing: {
        provider: "github-actions", workflow: "release.yml", publisherConfigured: true } })
    }))
  it.effect("requires PyPI trusted publisher setup acknowledgement", () =>
    expectValidationFailure(
      parseReleaseIntent(pypiConfig({
        trustedPublishing: { provider: "github-actions", workflow: "release.yml", publisherConfigured: false }
      }))
    ))
  const legacyFieldConfigs: ReadonlyArray<readonly [string, string]> = [
    ["_tag", minimalConfig.replace("\"project\":{", "\"_tag\":\"NpmRegistryTarget\",\"project\":{")],
    ["build", JSON.stringify({
      project: { name: "release", packageName: "release", version: "0.1.0", commit: "abc123", tag: "v0.1.0" },
      build: { npmPackage: { id: "package", path: "." } },
      publish: {}
    })],
    ["dryRunSupport", minimalConfig.replace("\"publish\":{\"npm\":{", "\"publish\":{\"npm\":{\"dryRunSupport\":\"native\",")],
    ["mutability", minimalConfig.replace("\"publish\":{\"npm\":{", "\"publish\":{\"npm\":{\"mutability\":\"immutable\",")],
    ["recovery", minimalConfig.replace("\"publish\":{\"npm\":{", "\"publish\":{\"npm\":{\"recovery\":\"manual\",")]
  ]

  for (const [field, config] of legacyFieldConfigs) {
    it.effect(`rejects removed legacy config field ${field}`, () =>
      expectValidationFailure(parseReleaseIntent(config)))
  }

  const invalidDomainScalarConfigs: ReadonlyArray<readonly [string, string]> = [
    ["release name", minimalConfig.replace("\"name\":\"release\"", "\"name\":\"\"")],
    ["release version", minimalConfig.replace("\"version\":\"0.1.0\"", "\"version\":\"\"")],
    ["git commit", minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"\"")],
    ["git tag", minimalConfig.replace("\"tag\":\"v0.1.0\"", "\"tag\":\"\"")],
    ["artifact id", JSON.stringify({
      project: { name: "release", packageName: "release", version: "0.1.0", commit: "abc123", tag: "v0.1.0" },
      artifacts: [{ id: "", path: "artifacts/release.tgz", format: "tarball" }],
      publish: {},
      evidence: ".release/evidence"
    })],
    ["npm package name", minimalConfig.replace("\"packageName\":\"release\",\"packagePath\"", "\"packageName\":\"\",\"packagePath\"")]
  ]

  for (const [label, config] of invalidDomainScalarConfigs) {
    it.effect(`rejects empty ${label}`, () =>
      expectValidationFailure(parseReleaseIntent(config)))
  }

  it.effect("reports invalid JSON as a typed parse error", () =>
    Effect.gen(function*() {
      const error = yield* parseReleaseIntent("{").pipe(Effect.flip)
      expect(isRecord(error) ? error._tag : undefined).toBe("ConfigError")
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
    const releaseIntent = isRecord(defs) ? defs.ReleaseIntent : undefined
    expect(isRecord(releaseIntent)).toBe(true)
    const properties = isRecord(releaseIntent) ? releaseIntent.properties : undefined
    expect(isRecord(properties)).toBe(true)
    for (const property of [
      "project", "versionFrom", "builds", "npmPackage", "archives", "checksum", "catalogs", "hooks", "publish", "retry", "$schema"
    ]) {
      expect(isRecord(properties) ? properties[property] : undefined).toBeDefined()
    }

    const serialized = JSON.stringify(schema)
    for (const name of [
      "ReleaseConfigArchive", "ReleaseConfigChecksum", "ReleaseConfigCatalogEntry", "ReleaseConfigHooks", "ReleaseConfigHook",
      "ReleaseConfigAfterHook", "ReleaseConfigCustomPublish", "ReleaseConfigNpmPublish", "ReleaseConfigGitHubPublish", "RetryPolicy"
    ]) expect(serialized).toContain(name)
    for (const name of ["NpmRegistryTarget", "GitHubReleaseTarget"]) {
      expect(serialized).not.toContain(name)
    }
  })
})
