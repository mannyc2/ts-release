import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { compileReleaseGraph } from "../../src/release/compiler.js"
import {
  VerifiedPackage,
  VerifiedReleaseContext,
  VerifiedSource
} from "../../src/release/context.js"
import { parseSha256Hex } from "../../src/model/digest.js"
import {
  NonEmptyName,
  SafeRelativePath,
  Version,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import { resolveConfig } from "../../src/resolve/resolve.js"

const sourceCommit = "c".repeat(40)
const digest = parseSha256Hex("a".repeat(64))
const context = VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(process.cwd()),
  source: VerifiedSource.make({
    commit: NonEmptyName.make(sourceCommit),
    tree: NonEmptyName.make("tree"),
    clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"),
    packageManifestDigest: digest,
    repository: "owner/repository",
    headTags: []
  }),
  package: VerifiedPackage.make({
    name: NonEmptyName.make("effect-build"),
    version: Version.make("0.3.0"),
    path: SafeRelativePath.make("package.json"),
    digest,
    repository: "owner/repository"
  })
})

const authentication = {
  strategy: "trusted-publishing",
  attestation: {
    provider: "github-actions",
    runner: "github-hosted",
    repository: "owner/repository",
    workflow: "release.yml",
    workflowRef: "refs/heads/main",
    allowedAction: "npm-publish-direct"
  }
} as const

const subject = (id: string, packageName: string, path: string, sha256: string) => ({
  id,
  path,
  packageName,
  version: "0.3.0",
  sha256,
  registry: "https://registry.npmjs.org/",
  distTag: "latest",
  access: "public",
  authentication,
  provenance: "automatic"
})

const authored = (prepackedNpm: ReadonlyArray<ReturnType<typeof subject>>, extra: Record<string, unknown> = {}) => ({
  project: {
    name: "effect-build",
    packageName: "effect-build",
    version: "0.3.0",
    tag: "v0.3.0",
    repository: "owner/repository"
  },
  publish: {
    prepackedNpm,
    github: { repository: "owner/repository" }
  },
  ...extra
})

const facts = {
  commit: sourceCommit,
  manifestName: "effect-build",
  manifestVersion: "0.3.0",
  repository: "owner/repository"
}

describe("ordered prepacked npm authoring", () => {
  test("preserves authored order through resolution and graph compilation instead of sorting ids", async () => {
    const input = authored([
      subject("z-core", "effect-build", ".release/candidate/effect-build.tgz", "1".repeat(64)),
      subject("a-bun", "effect-build-bun", ".release/candidate/effect-build-bun.tgz", "2".repeat(64)),
      subject("m-deno", "effect-build-deno", ".release/candidate/effect-build-deno.tgz", "3".repeat(64))
    ])
    await expect(Effect.runPromise(decodeConfig(input))).resolves.toBeDefined()
    const resolved = resolveConfig(input, facts)
    expect(resolved.publish?.prepackedNpm?.map((item) => item.id.toString()))
      .toEqual(["z-core", "a-bun", "m-deno"])

    const graph = compileReleaseGraph(resolved, context)
    expect(graph.publications.map((publication) => publication._tag)).toEqual([
      "GraphPrepackedNpmPublication",
      "GraphPrepackedNpmPublication",
      "GraphPrepackedNpmPublication",
      "GraphGitHubPublication"
    ])
    expect(graph.publications.map((publication) => publication.id.toString())).toEqual([
      "npm:z-core",
      "npm:a-bun",
      "npm:m-deno",
      "github:github-release"
    ])
  })

  test("rejects empty, duplicate, malformed, and mixed prepacked modes", async () => {
    const valid = subject("core", "effect-build", ".release/candidate/effect-build.tgz", "1".repeat(64))
    await expect(Effect.runPromise(decodeConfig(authored([])))).rejects.toThrow()
    await expect(Effect.runPromise(decodeConfig(authored([{ ...valid, path: "../effect-build.tgz" }]))))
      .rejects.toThrow()
    await expect(Effect.runPromise(decodeConfig(authored([{ ...valid, path: ".release/candidate" }]))))
      .rejects.toThrow()
    await expect(Effect.runPromise(decodeConfig(authored([{ ...valid, sha256: "A".repeat(64) }]))))
      .rejects.toThrow()
    expect(() => resolveConfig(authored([valid, { ...valid }]), facts)).toThrow(/duplicate.*id/iu)
    expect(() => resolveConfig(authored([
      valid,
      { ...valid, id: "other", path: ".release/candidate/other.tgz" }
    ]), facts)).toThrow(/duplicate.*package coordinate/iu)
    expect(() => resolveConfig(authored([{ ...valid, version: "v0.3.0" }]), facts))
      .toThrow(/canonical semantic version/iu)
    expect(() => resolveConfig(authored([valid], { npmPackage: { path: "." } }), facts))
      .toThrow(/source-pack.*prepacked/iu)
    expect(() => resolveConfig({
      ...authored([valid]),
      npmPackage: { path: "." },
      publish: {
        ...authored([valid]).publish,
        npm: { authentication: { strategy: "token", credential: "NPM_TOKEN" } }
      }
    }, facts)).toThrow(/source-pack.*prepacked/iu)
  })
})
