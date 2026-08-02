// The resolver is the only place authored-to-canonical semantics live, so what
// these cases pin is its totality: every field either comes from the author,
// comes from an observation, or produces a refusal that names both sides.
import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { encodeResolvedConfig } from "../../src/resolve/encode.js"
import { MISSING_COMMIT, resolveConfig } from "../../src/resolve/resolve.js"

const canonical = {
  project: {
    name: "@scope/pkg", packageName: "@scope/pkg", version: "1.2.3", tag: "v1.2.3",
    commit: "0123456789abcdef"
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
const facts = (value: Record<string, unknown> = {}) => value

describe("resolveConfig", () => {
  test("a canonical config with agreeing facts resolves to itself", () => {
    const resolved = resolveConfig(canonical, facts({
      commit: "0123456789abcdef", manifestName: "@scope/pkg", manifestVersion: "1.2.3"
    }))
    expect(resolved).toEqual(canonical as never)
  })

  test("every output is accepted by the canonical decoder", async () => {
    const resolved = resolveConfig(
      authored({ version: undefined, tag: undefined, commit: undefined }, { versionFrom: "manifest" }),
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
    expect(() => resolveConfig(canonical, facts({ commit: "deadbeef" })))
      .toThrow(/"0123456789abcdef".*"deadbeef".*at HEAD/su)
    expect(() =>
      resolveConfig(authored({}, { versionFrom: "manifest" }), facts({ manifestVersion: "9.9.9" }))
    ).toThrow(/"1.2.3".*"9.9.9".*package manifest/su)
    expect(() => resolveConfig(canonical, facts({ manifestName: "@other/pkg" })))
      .toThrow(/"@scope\/pkg".*"@other\/pkg"/su)
  })

  test("an unfillable field refuses and teaches how to observe it", () => {
    expect(() => resolveConfig(authored({ commit: undefined }), facts())).toThrow(MISSING_COMMIT)
    expect(() => resolveConfig(authored({ version: undefined }), facts()))
      .toThrow(/versionFrom to "manifest" or "git-tag"/u)
    expect(() =>
      resolveConfig(authored({ version: undefined }, { versionFrom: "git-tag" }), facts())
    ).toThrow(/no version was observed on the tag at HEAD/u)
  })

  test("a manifest name fills both names when the author states neither", () => {
    const resolved = resolveConfig(
      { ...canonical, project: { version: "1.2.3", tag: "v1.2.3", commit: "abc123" } },
      facts({ manifestName: "@scope/observed" })
    )
    expect(String(resolved.project.name)).toBe("@scope/observed")
    expect(resolved.project.packageName).toBe("@scope/observed")
  })
})
