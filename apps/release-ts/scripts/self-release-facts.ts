import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd } from "node:process"
import * as Schema from "effect/Schema"
import type { ReleaseIntent } from "../../../src/config/schema.js"
import { ReleaseIntent as ReleaseIntentSchema } from "../../../src/config/schema.js"
import { platformTargetVariant } from "../../../src/grammar/platform.js"
import { ReleaseIdentity } from "../../../src/grammar/state.js"
import { normalizedName, renderTemplate } from "../../../src/grammar/template.js"

export const packagePath = "package.json"
export const appPackagePath = "apps/release-ts/package.json"
export const releaseConfigPath = "apps/release-ts/release.config.json"
export const releaseWorkflowFileName = "release.yml"
export const releaseWorkflowPath = `.github/workflows/${releaseWorkflowFileName}`
export const installSmokeWorkflowPath = ".github/workflows/install-smoke.yml"
export const root = cwd()

export type JsonObject = Record<string, unknown>
export interface Check { readonly id: string; readonly ok: boolean; readonly message: string }
export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)
export const stringField = (record: JsonObject, key: string): string | undefined => {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}
export const readJson = (path: string): unknown => JSON.parse(readFileSync(resolve(root, path), "utf8"))
export const readText = (path: string): string => readFileSync(resolve(root, path), "utf8")
export const readOptionalText = (path: string): string | undefined => existsSync(resolve(root, path)) ? readText(path) : undefined
export const check = (id: string, ok: boolean, okMessage: string, failMessage = okMessage): Check =>
  ({ id, ok, message: ok ? okMessage : failMessage })
export const printChecks = (checks: ReadonlyArray<Check>): void => {
  for (const item of checks) console.log(`${item.ok ? "ok  " : "fail"} ${item.id}: ${item.message}`)
}
const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()
export const runCommand = async (args: ReadonlyArray<string>) => {
  const subprocess = Bun.spawn([...args], { cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
  const stdout = streamText(subprocess.stdout)
  const stderr = streamText(subprocess.stderr)
  const exitCode = await subprocess.exited
  return { exitCode, stdout: await stdout, stderr: await stderr }
}
export const decodeReleaseConfig = (strict = false): { readonly config?: ReleaseIntent; readonly error?: string } => {
  try {
    const decode = strict
      ? Schema.decodeUnknownSync(ReleaseIntentSchema, { onExcessProperty: "error" })
      : Schema.decodeUnknownSync(ReleaseIntentSchema)
    return { config: decode(readJson(releaseConfigPath)) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: message.split("\n").map((line) => line.trim()).filter(Boolean).join(" | ") }
  }
}

export const expectedPackageName = "@mannyc1/ts-release"
export const expectedRepositories = {
  github: "mannyc2/ts-release",
  homebrew: "mannyc2/homebrew-ts-release",
  scoop: "mannyc2/scoop-ts-release"
} as const
export const expectedCliTargets = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"] as const
export const expectedCliOutput = ".release/artifacts/ts-release-{version}-{targetTriple}{ext}"
export const requiredGitHubSecrets = ["TS_RELEASE_CATALOG_TOKEN"] as const

export const releaseWorkflowNeedles = [
  ["workflow:release-env", "environment: release", "Release execution is protected by the release environment."],
  ["workflow:github-token", "GH_TOKEN: ${{ github.token }}", "Workflow provides GH_TOKEN for GitHub release commands."],
  ["workflow:catalog-token", "secrets.TS_RELEASE_CATALOG_TOKEN", "Workflow references TS_RELEASE_CATALOG_TOKEN for catalog checkouts."],
  ["workflow:id-token", "id-token: write", "Workflow grants id-token: write for trusted publishing."],
  ["workflow:twine-version", "twine>=6.2.0", "Workflow installs a Twine version with trusted-publishing support."],
  ["workflow:catalog-render", "bun run release:catalogs", "Workflow renders package manager catalogs before artifact validation."],
  ["workflow:artifact-check", "bun run check:self-release-artifacts", "Workflow validates release artifacts before publication."]
] as const

export const releaseWorkflowBans = [
  ["workflow:no-twine-username-secret", "secrets.TWINE_USERNAME", "Workflow does not require TWINE_USERNAME for PyPI upload."],
  ["workflow:no-twine-password-secret", "secrets.TWINE_PASSWORD", "Workflow does not require TWINE_PASSWORD for PyPI upload."]
] as const

export const identityFor = (packageName: string, packageVersion: string): ReleaseIdentity =>
  ReleaseIdentity.make({
    name: packageName,
    normalizedName: normalizedName(packageName),
    version: packageVersion,
    tag: "",
    commit: "",
    shortCommit: "",
    versionSource: "manifest",
    snapshot: false
  })

type ReleaseBuild = NonNullable<ReleaseIntent["builds"]>[number]
export type SelfReleaseBuild = Extract<ReleaseBuild, { readonly builder: "bun" }>

export const configuredCliBuild = (config: ReleaseIntent): SelfReleaseBuild | undefined => {
  const build = (config.builds ?? []).find((item) => item.id === "cli")
  return build?.builder === "bun" ? build : undefined
}

export const binaryArtifactFacts = (
  build: SelfReleaseBuild,
  identity: ReleaseIdentity,
  output = build.output
) => {
  if (output === undefined) return []
  const binary = build.binary ?? identity.normalizedName
  return (build.targets ?? []).map((target) => ({
    id: `${build.id ?? "cli"}-${target}`,
    target,
    path: renderTemplate(output, {
      identity,
      platform: platformTargetVariant(target),
      targetTriple: target,
      binary
    })
  }))
}
export type BinaryArtifactFact = ReturnType<typeof binaryArtifactFacts>[number]

export const wheelArtifactFacts = (
  config: ReleaseIntent,
  identity: ReleaseIdentity
) =>
  (config.pypiWheel?.wheels ?? []).map((wheel) => {
    const binary = wheel.binaries[0]
    return {
      id: wheel.id,
      wheelTag: wheel.wheelTag,
      path: renderTemplate(wheel.path, { identity }),
      binary: binary === undefined ? undefined : {
        os: binary.os,
        arch: binary.arch,
        wheelPath: binary.wheelPath,
        sourcePath: renderTemplate(binary.sourcePath, { identity })
      }
    }
  })
export type WheelArtifactFact = ReturnType<typeof wheelArtifactFacts>[number]

export const installSmokeNeedles = (
  config: ReleaseIntent,
  packageName: string,
  packageVersion: string
): ReadonlyArray<readonly [string, string, string]> => {
  const build = configuredCliBuild(config)
  const binaries = build === undefined ? [] : binaryArtifactFacts(build, identityFor(packageName, packageVersion))
  const pypiPackageName = config.pypiWheel?.packageName ?? "ts-release"
  return [
    ["smoke:workflow-dispatch", "workflow_dispatch:", "Install smoke workflow can be dispatched manually after publication."],
    ["smoke:permissions-read", "contents: read", "Install smoke workflow uses read-only repository permissions."],
    ["smoke:npm-package", `${packageName}@$VERSION`, "Install smoke workflow installs the published npm package."],
    ...binaries.map(({ path, target }) => [
      `smoke:github-asset-${target}`,
      path.replace(/^\.release\/artifacts\//, "").replace(packageVersion, "$VERSION"),
      `Install smoke workflow downloads the ${target} GitHub Release asset.`
    ] as const),
    ["smoke:pypi-package", `${pypiPackageName}==$VERSION`, "Install smoke workflow installs the PyPI CLI wrapper."],
    ["smoke:homebrew-tap", expectedRepositories.homebrew.split("/")[1]!, "Install smoke workflow installs from the Homebrew tap."],
    ["smoke:homebrew-trust", `brew trust ${expectedRepositories.github}`, "Install smoke workflow trusts the custom Homebrew tap before installing."],
    ["smoke:scoop-bucket", expectedRepositories.scoop.split("/")[1]!, "Install smoke workflow installs from the Scoop bucket."],
    ["smoke:version-assertion", "v$VERSION", "Install smoke workflow asserts the installed CLI version."]
  ]
}
