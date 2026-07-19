import { describe, expect, test } from "@effect/bun-test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { makeTempDirectory, runBunProcess, writeJsonFile } from "./helpers.js"
import { join, resolve } from "node:path"
import selfReleaseConfig from "../apps/release-ts/release.config.json" with { type: "json" }

const scriptPath = resolve(
  import.meta.dir,
  "..",
  "apps",
  "release-ts",
  "scripts",
  "check-self-release-config.ts"
)

const run = (args: ReadonlyArray<string>, cwd: string) => runBunProcess(args, { cwd })

const baseManifest = (version: string = "0.0.0") => ({
  name: "@mannyc1/ts-release",
  version
})

const baseAppManifest = (version: string = "0.0.0") => ({
  name: "@mannyc1/release-ts-app",
  version,
  private: true
})

const baseConfig = () => structuredClone(selfReleaseConfig)

const releaseCliBuildFixture = (config: ReturnType<typeof baseConfig>) => {
  const build = config.builds[0]
  if (build === undefined) {
    throw new Error("expected self-release CLI build fixture")
  }
  return build
}

const prepareWorkspace = async (
  options: {
    readonly envExample?: string | undefined
    readonly dirty?: boolean
    readonly manifest?: Record<string, unknown>
    readonly appManifest?: Record<string, unknown>
    readonly config?: Record<string, unknown>
  } = {}
): Promise<string> => {
  const root = await makeTempDirectory("ts-release-self-config-")
  const manifest = options.manifest ?? baseManifest()
  const packageVersion = typeof manifest.version === "string" ? manifest.version : "0.0.0"
  await writeJsonFile(join(root, "package.json"), manifest)
  await mkdir(join(root, "apps", "release-ts"), { recursive: true })
  await writeJsonFile(
    join(root, "apps", "release-ts", "package.json"),
    options.appManifest ?? baseAppManifest(packageVersion)
  )
  await writeJsonFile(join(root, "apps", "release-ts", "release.config.json"), options.config ?? baseConfig())
  await writeFile(join(root, "README.md"), "clean\n")
  if (options.envExample !== undefined) {
    await writeFile(join(root, ".env.example"), options.envExample)
  }

  await run(["git", "init"], root)
  await run(["git", "config", "user.email", "release@example.com"], root)
  await run(["git", "config", "user.name", "Release Test"], root)
  await run(["git", "add", "."], root)
  await run(["git", "commit", "-m", "initial"], root)

  if (options.dirty === true) {
    await writeFile(join(root, "README.md"), "dirty\n")
  }

  return root
}

const checkWorkspace = async (options: Parameters<typeof prepareWorkspace>[0] = {}) => {
  const root = await prepareWorkspace(options)
  try {
    return await run(["bun", scriptPath], root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe("self-release config script", () => {
  test("passes when configured token env is documented", async () => {
    const result = await checkWorkspace({ envExample: "GH_TOKEN=\n" })
    expect(result.exitCode).toBe(0)
  })

  test("fails when token env is missing from .env.example", async () => {
    const result = await checkWorkspace()
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain(".env.example must document")
  })

  test("allows HEAD release with dirty tracked files", async () => {
    const result = await checkWorkspace({ envExample: "GH_TOKEN=\n", dirty: true })
    expect(result.exitCode).toBe(0)
  })

  test("fails when package and app package versions disagree", async () => {
    const result = await checkWorkspace({
      envExample: "GH_TOKEN=\n",
      manifest: baseManifest("1.0.0"),
      appManifest: baseAppManifest("2.0.0")
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("apps/release-ts/package.json version 2.0.0 must match package version 1.0.0")
  })

  test("fails when generated artifact paths drift", async () => {
    const config = baseConfig()
    const build = releaseCliBuildFixture(config)
    build.output = ".release/artifacts/wrong-{version}-{targetTriple}{ext}"
    const result = await checkWorkspace({ envExample: "GH_TOKEN=\n", config })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("build cli output for linux-x64 expands")
  })

  test("fails when expected CLI build targets are missing", async () => {
    const config = baseConfig()
    const build = releaseCliBuildFixture(config)
    build.targets = build.targets.filter((target) => target !== "windows-x64")
    const result = await checkWorkspace({ envExample: "GH_TOKEN=\n", config })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("build cli targets must equal")
  })

  test("fails when CLI artifacts are declared statically", async () => {
    const config = {
      ...baseConfig(),
      artifacts: [{
        id: "cli-linux-x64",
        path: ".release/artifacts/ts-release-{version}-linux-x64",
        format: "file"
      }]
    }
    const result = await checkWorkspace({ envExample: "GH_TOKEN=\n", config })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("artifact cli-linux-x64 must be declared by builds")
  })

  test("fails when npm provenance is disabled", async () => {
    const config = baseConfig()
    config.publish.npm.provenance = false
    const result = await checkWorkspace({ envExample: "GH_TOKEN=\n", config })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("npm self-release target must enable provenance")
  })

  test("fails when npm package verification is disabled", async () => {
    const config = baseConfig()
    config.publish.npm.trustedPublishing.verifyPackageExists = false
    const result = await checkWorkspace({ envExample: "GH_TOKEN=\n", config })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("npm self-release target must use GitHub Actions trusted publishing")
  })

  test("fails when npm package name drifts from package manifest", async () => {
    const config = baseConfig()
    config.publish.npm.packageName = "@mannyc1/other-package"
    const result = await checkWorkspace({ envExample: "GH_TOKEN=\n", config })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("npm self-release target packageName")
  })
})
