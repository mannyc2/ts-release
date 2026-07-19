import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { decodeReleaseIntent } from "../src/config/load.js"
import { resolveRelease } from "../src/resolve/resolved-release.js"
import { buildPlanner } from "../src/features/build/build.js"
import { checksumPlanner } from "../src/features/process/checksum.js"
import { catalogHomebrewPlanner } from "../src/features/catalog/homebrew.js"
import { catalogScoopPlanner } from "../src/features/catalog/scoop.js"
import { emptyPlanAccumulator } from "../src/grammar/accumulator.js"
import { makePipelineIdentity } from "./helpers.js"
const identity = makePipelineIdentity({
  name: "manifest-name", normalizedName: "manifest-name", version: "1.2.3", tag: "v1.2.3"
})
const wheel = {
  id: "wheel-a", path: "dist/a.whl", wheelTag: "py3-none-any", packageName: "pkg",
  moduleName: "pkg", consoleScript: "pkg", summary: "pkg", homepage: "https://example.test", license: "MIT",
  requiresPython: ">=3.9", binaries: []
}
const resolved = (input: unknown) =>
  decodeReleaseIntent(input).pipe(Effect.map((intent) => resolveRelease(intent, identity)))
const some = Option.getOrUndefined
const isNone = (option: Option.Option<unknown>) => Option.isNone(option)
const isSome = (option: Option.Option<unknown>) => Option.isSome(option)
describe("resolved release", () => {
  it.effect("preserves every absence, empty array, and empty-section enable", () =>
    Effect.gen(function*() {
      const absent = yield* resolved({ project: {}, publish: {} })
      const empty = yield* resolved({ project: {}, builds: [], pypiWheel: [],
        artifacts: [], archives: [], catalogs: [], publish: {} })
      const shorthand = yield* resolved({
        project: {}, npmPackage: {}, pypiWheel: wheel, checksum: {},
        publish: { npm: {}, pypi: {}, github: {} }, evidence: "proof/{version}"
      })
      const pair = yield* resolved({ project: {},
        pypiWheel: [wheel, { ...wheel, id: "wheel-b", path: "dist/b.whl" }], publish: {} })
      expect([absent.builds, absent.npmPackage, absent.pypiWheels, absent.artifacts, absent.archives,
        absent.checksum, absent.npm, absent.pypi, absent.github, absent.homebrew, absent.scoop, absent.catalogs]
        .map(isNone)).toEqual(Array(12).fill(true))
      expect([empty.builds, empty.npmPackage, empty.npm, empty.pypi, empty.github].map(isNone))
        .toEqual(Array(5).fill(true))
      expect([some(empty.pypiWheels), some(empty.artifacts), some(empty.archives), some(empty.catalogs)]).toEqual([[], [], [], []])
      expect(some(shorthand.npmPackage)).toEqual({ path: "." })
      expect(some(shorthand.pypiWheels)?.map(({ id }) => id)).toEqual(["wheel-a"])
      expect(some(pair.pypiWheels)?.map(({ id }) => id)).toEqual(["wheel-a", "wheel-b"])
      expect(some(shorthand.checksum))
        .toEqual({ algorithm: "sha256", nameTemplate: "{name}_{version}_checksums.txt" })
      expect([shorthand.npm, shorthand.pypi, shorthand.github].map(isSome)).toEqual([true, true, true])
      expect(shorthand.evidenceDirectory).toBe("proof/1.2.3")
    }))
  it.effect("totalizes defaults once", () =>
    Effect.gen(function*() {
      const release = yield* resolved({
        project: { name: "wire-name", packageName: "@scope/wire-name", repository: "owner/release" },
        builds: [{ builder: "bun", entry: "src/cli.ts" }],
        npmPackage: {}, archives: [{}], checksum: {},
        catalogs: [{ id: "index", repository: "owner/catalog", file: "index.json", content: "{version}" }],
        publish: {
          npm: {}, pypi: {}, github: {},
          homebrew: { repository: "owner/homebrew-tap", artifactIds: ["darwin"] },
          scoop: { repository: "owner/scoop-bucket", artifactId: "windows" }
        }
      })
      const plannedBuild = yield* buildPlanner(some(release.builds)!, emptyPlanAccumulator(identity))
      const plannedChecksum = yield* checksumPlanner(some(release.checksum)!, emptyPlanAccumulator(identity))
      expect(some(release.builds)?.[0]).toEqual({
        builder: "bun", entry: "src/cli.ts", targets: ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"]
      })
      expect(plannedBuild.artifacts[0]).toMatchObject({
        id: "cli-linux-x64", path: ".release/artifacts/manifest-name_1.2.3_linux_amd64",
        platform: { binaryName: "manifest-name", targetTriple: "bun-linux-x64" }, extra: { binary: "manifest-name" }
      })
      expect(plannedBuild.operations[0]).toMatchObject({
        id: "build:bun:cli-linux-x64", action: { intent: {
          entry: "src/cli.ts", target: "linux-x64", compileTarget: "bun-linux-x64",
          outfile: ".release/artifacts/manifest-name_1.2.3_linux_amd64" } }
      })
      expect(plannedBuild.operations[0]?.action).not.toHaveProperty("intent.minify")
      expect(some(release.npmPackage)).toEqual({ path: "." })
      expect(some(release.archives)?.[0]).toMatchObject({
        id: "archive", formats: ["tar.gz"], files: ["license*", "LICENSE*", "readme*", "README*", "changelog*", "CHANGELOG*"]
      })
      expect(some(release.npm)).toMatchObject({
        registry: "https://registry.npmjs.org", packageName: "@scope/wire-name", packagePath: ".",
        tokenEnv: undefined, trustedPublishing: undefined, access: undefined, provenance: undefined })
      expect(some(release.pypi)).toEqual({
        repositoryUrl: "https://upload.pypi.org/legacy/", pythonExecutable: "python" })
      expect(some(release.github)).toEqual(
        { repository: "owner/release", tokenEnv: undefined, draft: true, prerelease: false })
      expect(some(release.homebrew)).toMatchObject({
        formulaName: "wire-name", formulaPath: ".release/generated/wire-name.rb",
        tapDirectory: ".", githubRepository: "owner/release" })
      expect(some(release.scoop)).toMatchObject({
        manifestName: "wire-name", manifestPath: ".release/generated/wire-name.json",
        bucketDirectory: ".", githubRepository: "owner/release" })
      expect(some(release.catalogs)?.[0]).toEqual({ id: "index", repository: "owner/catalog",
        file: "index.json", content: "{version}", commitMessage: "Update {name} to {version}",
        submit: "push", githubRepository: "owner/release" })
      expect(plannedChecksum.artifacts.map(({ id }) => id)).toEqual(["checksum"])
      expect(plannedChecksum.operations.map(({ id }) => id)).toEqual(["checksum:write"])
      expect(plannedChecksum.artifacts[0]?.path)
        .toBe(".release/artifacts/manifest-name_1.2.3_checksums.txt")
      expect(release.evidenceDirectory).toBe(".release/evidence")
    }))
  it.effect("carries explicit selectors, aliases, authentication, and precedence", () =>
    Effect.gen(function*() {
      const release = yield* resolved({
        project: { name: "project-name", packageName: "@scope/project", packagePath: "project-pkg",
          repository: "owner/project" },
        pypiWheel: [wheel, { ...wheel, id: "wheel-b", path: "dist/b.whl" }],
        artifacts: [{ id: "manual", path: "dist/manual", format: "executable",
          checksum: { algorithm: "sha256", value: "abc" },
          variant: { os: "linux", arch: "x64", libc: "glibc", binaryName: "tool", executableExtension: ".bin" } }],
        archives: [{ id: "bundle", ids: ["manual"], nameTemplate: "bundle-{version}", formats: ["zip"],
          formatOverrides: { linux: ["tar.gz"] }, files: ["LICENSE"], wrapInDirectory: "pkg" }],
        checksum: { algorithm: "sha512", nameTemplate: "SUMS-{version}" },
        publish: {
          npm: { registry: "https://registry.example", packageName: "explicit-npm", packagePath: "npm-pkg",
            tokenEnv: "NPM_TOKEN", access: "restricted", provenance: true },
          pypi: { repositoryUrl: "https://pypi.example", pythonExecutable: "python3",
            usernameEnv: "TWINE_USERNAME", passwordEnv: "TWINE_PASSWORD", artifactIds: ["wheel-b"] },
          github: { repository: "owner/explicit", tokenEnv: "GH_TOKEN", draft: false, prerelease: "auto" },
          homebrew: { repository: "owner/tap", formulaName: "brew-alias", formulaPath: "Formula/tool.rb",
            artifactIds: ["manual"], homepage: "https://brew.example", description: "brew", url: "https://cdn/brew",
            tapDirectory: "tap", installPath: "bin/tool", tokenEnv: "TAP_TOKEN" },
          scoop: { repository: "owner/bucket", manifestName: "scoop-alias", manifestPath: "bucket/tool.json",
            artifactId: "manual", homepage: "https://scoop.example", description: "scoop", license: "MIT",
            url: "https://cdn/scoop", bin: "tool.exe", bucketDirectory: "bucket", tokenEnv: "BUCKET_TOKEN" }
        },
        evidence: { directory: ".proof/{version}" }
      })
      const trusted = yield* resolved({ project: {}, publish: {
        npm: { trustedPublishing: { verifyPackageExists: true } }, pypi: { trustedPublishing: {} } } })
      expect(some(release.npm)).toMatchObject({
        registry: "https://registry.example", packageName: "explicit-npm", packagePath: "npm-pkg",
        tokenEnv: "NPM_TOKEN", trustedPublishing: undefined, access: "restricted", provenance: true })
      expect(some(trusted.npm)).toMatchObject({
        packageName: "manifest-name", trustedPublishing: {
          provider: "github-actions", workflow: "release.yml", verifyPackageExists: true } })
      expect(some(release.pypi)).toMatchObject({
        repositoryUrl: "https://pypi.example", pythonExecutable: "python3",
        usernameEnv: "TWINE_USERNAME", passwordEnv: "TWINE_PASSWORD", artifactIds: ["wheel-b"] })
      expect(some(trusted.pypi)?.trustedPublishing)
        .toEqual({ provider: "github-actions", workflow: "release.yml" })
      expect(some(release.github))
        .toEqual({ repository: "owner/explicit", tokenEnv: "GH_TOKEN", draft: false, prerelease: "auto" })
      expect(some(release.homebrew)).toMatchObject({
        repository: "owner/tap", formulaName: "brew-alias", formulaPath: "Formula/tool.rb",
        artifactIds: ["manual"], url: "https://cdn/brew", tapDirectory: "tap", installPath: "bin/tool",
        tokenEnv: "TAP_TOKEN", githubRepository: "owner/explicit"
      })
      expect(some(release.scoop)).toMatchObject({
        repository: "owner/bucket", manifestName: "scoop-alias", manifestPath: "bucket/tool.json",
        artifactId: "manual", url: "https://cdn/scoop", bin: "tool.exe", bucketDirectory: "bucket",
        tokenEnv: "BUCKET_TOKEN", githubRepository: "owner/explicit"
      })
      expect(some(release.artifacts)?.[0]).toMatchObject({
        id: "manual", format: "executable", checksum: { algorithm: "sha256", value: "abc" },
        variant: { os: "linux", arch: "x64", libc: "glibc", binaryName: "tool", executableExtension: ".bin" }
      })
      expect(some(release.archives)?.[0]).toMatchObject({
        id: "bundle", ids: ["manual"], nameTemplate: "bundle-{version}", formats: ["zip"],
        formatOverrides: { linux: ["tar.gz"] }, files: ["LICENSE"], wrapInDirectory: "pkg"
      })
      expect(some(release.pypiWheels)?.map(({ id }) => id)).toEqual(["wheel-a", "wheel-b"])
      expect(some(release.checksum)).toEqual({ algorithm: "sha512", nameTemplate: "SUMS-{version}" })
      expect(release.evidenceDirectory).toBe(".proof/1.2.3")
    }))
  it.effect("preserves the manifest-only catalog name wart as literal release", () =>
    Effect.gen(function*() {
      const release = yield* resolved({
        project: {},
        publish: {
          homebrew: { repository: "owner/tap", artifactIds: ["darwin"] },
          scoop: { repository: "owner/bucket", artifactId: "windows" }
        }
      })
      expect(some(release.homebrew)).toMatchObject({
        formulaName: "release", formulaPath: ".release/generated/release.rb"
      })
      expect(some(release.scoop)).toMatchObject({
        manifestName: "release", manifestPath: ".release/generated/release.json"
      })
    }))
  it.effect("rejects unsafe default catalog paths derived from explicit catalog names", () =>
    Effect.gen(function*() {
      const release = yield* resolved({
        project: {},
        publish: {
          homebrew: { repository: "owner/tap", formulaName: "../escape", artifactIds: ["darwin"] },
          scoop: { repository: "owner/bucket", manifestName: "../escape", artifactId: "windows" }
        }
      })
      for (const effect of [
        catalogHomebrewPlanner(some(release.homebrew)!, emptyPlanAccumulator(identity)),
        catalogScoopPlanner(some(release.scoop)!, emptyPlanAccumulator(identity))
      ]) {
        const error = yield* effect.pipe(Effect.flip)
        expect(error).toMatchObject({ _tag: "PlanError" })
      }
    }))
})
