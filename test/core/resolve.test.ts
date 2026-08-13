// The resolver is the only place authored-to-canonical semantics live, so what
// these cases pin is its totality: every field either comes from the author,
// comes from an observation, or produces a refusal that names both sides.
import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { encodeResolvedConfig } from "../../src/resolve/encode.js"
import { MISSING_COMMIT, resolveConfig } from "../../src/resolve/resolve.js"
import { canonicalizeNpmRegistryEndpoint } from "../../src/recipes/config.js"

const canonical = {
  project: {
    name: "@scope/pkg", packageName: "@scope/pkg", version: "1.2.3", tag: "v1.2.3"
  },
  npmPackage: { path: "." },
  publish: {}
}
// An omitted field is an ABSENT key, not an undefined one: the authored schema
// is as strict about that as the canonical schema is.
const without = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
const authored = (project: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  ...canonical, ...extra, project: without({ ...canonical.project, ...project })
})
const facts = (value: Record<string, unknown> = {}) => without({
  commit: "0123456789abcdef",
  ...value
})

describe("resolveConfig", () => {
  test("a canonical config with agreeing facts resolves to itself", () => {
    const resolved = resolveConfig(canonical, facts({
      commit: "0123456789abcdef", manifestName: "@scope/pkg", manifestVersion: "1.2.3"
    }))
    expect(encodeResolvedConfig(resolved)).toBe(encodeResolvedConfig(canonical))
  })

  test("every output is accepted by the canonical decoder", async () => {
    const resolved = resolveConfig(
      authored({ version: undefined, tag: undefined }, { versionFrom: "manifest" }),
      facts({ commit: "abc123", manifestVersion: "4.5.6" })
    )
    const decoded = await Effect.runPromise(decodeConfig(resolved))
    expect(String(decoded.project.version)).toBe("4.5.6")
    // The tag was derived from the default template, and the directive itself
    // never reaches the canonical value.
    expect(String(decoded.project.tag)).toBe("v4.5.6")
    expect("versionFrom" in (resolved as object)).toBe(false)
    expect("tagTemplate" in resolved.project).toBe(false)
  })

  test("the same inputs always encode to the same bytes", () => {
    const inputs = [
      authored({ version: undefined }, { versionFrom: "git-tag" }),
      facts({ headTagVersion: "2.0.0" })
    ] as const
    expect(encodeResolvedConfig(resolveConfig(...inputs)))
      .toBe(encodeResolvedConfig(resolveConfig(...inputs)))
    expect(encodeResolvedConfig({ b: 1, a: { d: 2, c: 3 } })).toBe(
      "{\n  \"a\": {\n    \"c\": 3,\n    \"d\": 2\n  },\n  \"b\": 1\n}\n"
    )
  })

  test("a tag template renders only {version}", () => {
    expect(String(resolveConfig(
      authored({ tag: undefined, tagTemplate: "release-{version}" }), facts()
    ).project.tag)).toBe("release-1.2.3")
    expect(() =>
      resolveConfig(authored({ tag: undefined, tagTemplate: "{name}-{version}" }), facts())
    ).toThrow(/only the \{version\} token/u)
  })

  test("a fact that contradicts the author is refused, naming both values", () => {
    expect(() => resolveConfig(
      authored({ repository: "owner/package" }),
      facts({ repository: "other/package" })
    )).toThrow(/"owner\/package".*"other\/package".*observed repository/su)
    expect(() =>
      resolveConfig(authored({}, { versionFrom: "manifest" }), facts({ manifestVersion: "9.9.9" }))
    ).toThrow(/"1.2.3".*"9.9.9".*package manifest/su)
    expect(() => resolveConfig(canonical, facts({ manifestName: "@other/pkg" })))
      .toThrow(/"@scope\/pkg".*"@other\/pkg"/su)
  })

  test("an unfillable field refuses and teaches how to observe it", () => {
    expect(() => resolveConfig(canonical, {})).toThrow(MISSING_COMMIT)
    expect(() => resolveConfig(authored({ version: undefined }), facts()))
      .toThrow(/versionFrom to "manifest" or "git-tag"/u)
    expect(() =>
      resolveConfig(authored({ version: undefined }, { versionFrom: "git-tag" }), facts())
    ).toThrow(/no version was observed on the tag at HEAD/u)
  })

  test("a manifest name fills both names when the author states neither", () => {
    const resolved = resolveConfig(
      { ...canonical, project: { version: "1.2.3", tag: "v1.2.3" } },
      facts({ manifestName: "@scope/observed" })
    )
    expect(String(resolved.project.name)).toBe("@scope/observed")
    expect(resolved.project.packageName).toBe("@scope/observed")
  })

  const tokenAuthentication = { strategy: "token", credential: "CUSTOM_NPM_TOKEN" } as const
  const npmAuthored = (npm: Record<string, unknown>, version = "1.2.3") => ({
    project: {
      name: "@scope/pkg", packageName: "@scope/pkg", version, tag: `v${version}`,
      repository: "owner/pkg"
    },
    npmPackage: { path: "." },
    publish: { npm: { authentication: tokenAuthentication, ...npm } }
  })

  test("resolves stable npm defaults into one complete canonical intent", () => {
    const resolved = resolveConfig(npmAuthored({
      registry: "https://REGISTRY.example.test/tenant///"
    }), facts())
    expect(resolved.publish?.npm).toEqual({
      packageArtifact: "npm-package",
      packageName: "@scope/pkg",
      registry: "https://registry.example.test/tenant/",
      distTag: "latest",
      access: "public",
      authentication: tokenAuthentication,
      provenance: "disabled"
    } as never)
  })

  test("requires a non-latest npm channel for prerelease versions", () => {
    expect(() => resolveConfig(npmAuthored({}, "1.2.3-beta.1"), facts()))
      .toThrow(/explicit non-latest distTag/u)
    expect(() => resolveConfig(npmAuthored({ distTag: "latest" }, "1.2.3-beta.1"), facts()))
      .toThrow(/cannot publish under the latest/u)
    expect(() => resolveConfig(npmAuthored({ distTag: "^1.2.3" }, "1.2.3-beta.1"), facts()))
      .toThrow(/must not be a valid SemVer range/u)
    expect(String(resolveConfig(npmAuthored({ distTag: "next" }, "1.2.3-beta.1"), facts()).publish?.npm?.distTag))
      .toBe("next")
  })

  test("accepts only an exact direct npm trusted-publisher attestation", () => {
    const authentication = {
      strategy: "trusted-publishing",
      attestation: {
        provider: "github-actions", runner: "github-hosted", repository: "owner/pkg",
        workflow: "publish.yml", workflowRef: "refs/heads/main", allowedAction: "npm-publish-direct"
      }
    } as const
    const resolved = resolveConfig(npmAuthored({ authentication }), facts())
    expect(resolved.publish?.npm).toMatchObject({
      registry: "https://registry.npmjs.org/", authentication,
      provenance: "automatic"
    } as never)
    expect(() => resolveConfig(npmAuthored({
      registry: "https://registry.example.test/", authentication
    }), facts())).toThrow(/certified only for https:\/\/registry\.npmjs\.org\//u)
    expect(() => resolveConfig(npmAuthored({
      authentication: {
        ...authentication,
        attestation: { ...authentication.attestation, repository: "other/pkg" }
      }
    }), facts())).toThrow(/does not match/u)
  })

  test("rejects disconnected paths, contradictory auth, stage-only trust, and unsafe registries at config boundaries", async () => {
    const base = npmAuthored({})
    await expect(Effect.runPromise(decodeConfig({
      ...base,
      publish: { npm: { authentication: tokenAuthentication, packagePath: "." } }
    }))).rejects.toThrow()
    await expect(Effect.runPromise(decodeConfig({
      ...base,
      publish: { npm: {
        authentication: { ...tokenAuthentication, attestation: { provider: "github-actions" } }
      } }
    }))).rejects.toThrow()
    await expect(Effect.runPromise(decodeConfig({
      ...base,
      publish: { npm: {
        authentication: {
          strategy: "trusted-publishing",
          attestation: {
            provider: "github-actions", runner: "github-hosted", repository: "owner/pkg",
            workflow: "publish.yml", workflowRef: "refs/heads/main", allowedAction: "npm-stage-publish"
          }
        }
      } }
    }))).rejects.toThrow()
    await expect(Effect.runPromise(decodeConfig({
      ...base,
      publish: { npm: { authentication: tokenAuthentication, unsupportedMode: "staged" } }
    }))).rejects.toThrow()
    expect(() => resolveConfig(npmAuthored({ registry: "http://registry.example.test/" }), facts()))
      .toThrow(/must be HTTPS/u)
    expect(() => resolveConfig({ ...base, npmPackage: undefined }, facts())).toThrow()
  })

  test("token mode rejects the misleading automatic-provenance policy", () => {
    expect(() => resolveConfig(npmAuthored({ provenance: "automatic" }), facts()))
      .toThrow(/trusted-publishing behavior/u)
  })

  test("registry canonicalization binds the base path and gates HTTP to explicit loopback tests", () => {
    expect(canonicalizeNpmRegistryEndpoint("https://REGISTRY.example.test/tenant///"))
      .toBe("https://registry.example.test/tenant/")
    expect(() => canonicalizeNpmRegistryEndpoint("https://registry.example.test/?tenant=other"))
      .toThrow(/query or fragment/u)
    expect(() => canonicalizeNpmRegistryEndpoint("https://user:secret@registry.example.test/"))
      .toThrow(/must not contain credentials/u)
    expect(() => canonicalizeNpmRegistryEndpoint("http://localhost:4873/"))
      .toThrow(/must be HTTPS/u)
    expect(canonicalizeNpmRegistryEndpoint("http://localhost:4873/tenant", {
      allowInsecureLoopback: true
    })).toBe("http://localhost:4873/tenant/")
  })
})
