import { describe, expect, test } from "@effect/bun-test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const scriptPath = resolve(
  import.meta.dir,
  "..",
  "apps",
  "release-ts",
  "scripts",
  "check-self-release-config.ts"
)

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const run = async (args: ReadonlyArray<string>, cwd: string): Promise<{
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> => {
  const subprocess = Bun.spawn([...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  const stdout = streamText(subprocess.stdout)
  const stderr = streamText(subprocess.stderr)
  const exitCode = await subprocess.exited
  return {
    exitCode,
    stdout: await stdout,
    stderr: await stderr
  }
}

const writeJson = (path: string, value: unknown): Promise<void> =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`)

const baseManifest = (version: string = "0.0.0") => ({
  name: "@mannyc1/ts-release",
  version
})

const baseAppManifest = (version: string = "0.0.0") => ({
  name: "@mannyc1/release-ts-app",
  version,
  private: true
})

const releaseArtifacts = () => [
  {
    id: "npm-package",
    path: ".",
    format: "directory",
    consumers: ["npm"]
  },
  {
    id: "package-tarball",
    path: ".release/artifacts/{normalizedName}-{version}.tgz",
    format: "tarball",
    consumers: ["github"]
  },
  {
    id: "cli-linux-x64",
    path: ".release/artifacts/ts-release-{version}-linux-x64",
    format: "file",
    consumers: ["github"]
  },
  {
    id: "cli-linux-arm64",
    path: ".release/artifacts/ts-release-{version}-linux-arm64",
    format: "file",
    consumers: ["github"]
  },
  {
    id: "cli-darwin-x64",
    path: ".release/artifacts/ts-release-{version}-darwin-x64",
    format: "file",
    consumers: ["github"]
  },
  {
    id: "cli-darwin-arm64",
    path: ".release/artifacts/ts-release-{version}-darwin-arm64",
    format: "file",
    consumers: ["github"]
  },
  {
    id: "cli-windows-x64",
    path: ".release/artifacts/ts-release-{version}-windows-x64.exe",
    format: "file",
    consumers: ["github"]
  }
]

const baseConfig = (version: string = "0.0.0") => ({
  identity: {
    _tag: "PackageManifestReleaseIdentitySource",
    commit: "HEAD",
    tagTemplate: "v{version}"
  },
  artifacts: releaseArtifacts(),
  targets: [
    {
      _tag: "NpmRegistryTarget",
      id: "npm",
      registry: "https://registry.npmjs.org",
      packageName: "@mannyc1/ts-release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN",
      access: "public",
      provenance: true,
      dryRunSupport: "native",
      mutability: "immutable",
      recovery: "publish-new-version"
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

const prepareWorkspace = async (
  options: {
    readonly envExample?: string | undefined
    readonly dirty?: boolean
    readonly manifest?: Record<string, unknown>
    readonly appManifest?: Record<string, unknown>
    readonly config?: Record<string, unknown>
  } = {}
): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "ts-release-self-config-"))
  const manifest = options.manifest ?? baseManifest()
  const packageVersion = typeof manifest.version === "string" ? manifest.version : "0.0.0"
  await writeJson(join(root, "package.json"), manifest)
  await mkdir(join(root, "apps", "release-ts"), { recursive: true })
  await writeJson(
    join(root, "apps", "release-ts", "package.json"),
    options.appManifest ?? baseAppManifest(packageVersion)
  )
  await writeJson(join(root, "apps", "release-ts", "release.config.json"), options.config ?? baseConfig(packageVersion))
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

describe("self-release config script", () => {
  test("passes when configured token env is documented", async () => {
    const root = await prepareWorkspace({ envExample: "NPM_TOKEN=\n" })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when token env is missing from .env.example", async () => {
    const root = await prepareWorkspace()
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain(".env.example must document")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when HEAD release uses dirty tracked files", async () => {
    const root = await prepareWorkspace({ envExample: "NPM_TOKEN=\n", dirty: true })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("release identity commit HEAD requires a clean tracked working tree")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when package and app package versions disagree", async () => {
    const root = await prepareWorkspace({
      envExample: "NPM_TOKEN=\n",
      manifest: baseManifest("1.0.0"),
      appManifest: baseAppManifest("2.0.0")
    })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("apps/release-ts/package.json version 2.0.0 must match package version 1.0.0")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when generated artifact paths drift", async () => {
    const config = baseConfig()
    config.artifacts = releaseArtifacts().map((artifact) =>
      artifact.id === "package-tarball"
        ? { ...artifact, path: ".release/artifacts/wrong-0.0.0.tgz" }
        : artifact
    )
    const root = await prepareWorkspace({ envExample: "NPM_TOKEN=\n", config })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("artifact package-tarball path")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when expected CLI artifact entries are missing", async () => {
    const config = baseConfig()
    config.artifacts = releaseArtifacts().filter((artifact) => artifact.id !== "cli-windows-x64")
    const root = await prepareWorkspace({ envExample: "NPM_TOKEN=\n", config })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("release config must include artifact cli-windows-x64")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when npm provenance is disabled", async () => {
    const config = baseConfig()
    const [target] = config.targets
    if (target !== undefined) {
      target.provenance = false
    }
    const root = await prepareWorkspace({ envExample: "NPM_TOKEN=\n", config })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("npm self-release target must enable provenance")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when npm package name drifts from package manifest", async () => {
    const config = baseConfig()
    const [target] = config.targets
    if (target !== undefined) {
      target.packageName = "@mannyc1/other-package"
    }
    const root = await prepareWorkspace({ envExample: "NPM_TOKEN=\n", config })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("npm self-release target packageName")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
