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
  }
]

interface StaticArtifactFixture {
  readonly id: string
  readonly path: string
  readonly format: string
  readonly consumers: ReadonlyArray<string>
}

const releaseStaticArtifacts = (): Array<StaticArtifactFixture> => []

const pypiWheelRecipe = (input: {
  readonly id: string
  readonly path: string
  readonly wheelTag: string
  readonly os: string
  readonly arch: string
  readonly sourcePath: string
  readonly wheelPath: string
}) => ({
  id: input.id,
  path: input.path,
  wheelTag: input.wheelTag,
  packageName: "ts-release",
  moduleName: "ts_release",
  consoleScript: "ts-release",
  summary: "Portable artifact and package-manager distribution planning for TypeScript projects.",
  homepage: "https://github.com/mannyc2/ts-release",
  license: "MIT",
  requiresPython: ">=3.8",
  binaries: [
    {
      os: input.os,
      arch: input.arch,
      sourcePath: input.sourcePath,
      wheelPath: input.wheelPath
    }
  ],
  consumers: ["pypi"]
})

const releasePyPiWheelRecipes = () => [
  pypiWheelRecipe({
    id: "pypi-wheel-linux-x64",
    path: ".release/artifacts/ts_release-{version}-py3-none-manylinux2014_x86_64.whl",
    wheelTag: "py3-none-manylinux2014_x86_64",
    os: "linux",
    arch: "x64",
    sourcePath: ".release/artifacts/ts-release-{version}-linux-x64",
    wheelPath: "ts_release/bin/ts-release-linux-x64"
  }),
  pypiWheelRecipe({
    id: "pypi-wheel-linux-arm64",
    path: ".release/artifacts/ts_release-{version}-py3-none-manylinux2014_aarch64.whl",
    wheelTag: "py3-none-manylinux2014_aarch64",
    os: "linux",
    arch: "arm64",
    sourcePath: ".release/artifacts/ts-release-{version}-linux-arm64",
    wheelPath: "ts_release/bin/ts-release-linux-arm64"
  }),
  pypiWheelRecipe({
    id: "pypi-wheel-darwin-x64",
    path: ".release/artifacts/ts_release-{version}-py3-none-macosx_10_15_x86_64.whl",
    wheelTag: "py3-none-macosx_10_15_x86_64",
    os: "darwin",
    arch: "x64",
    sourcePath: ".release/artifacts/ts-release-{version}-darwin-x64",
    wheelPath: "ts_release/bin/ts-release-darwin-x64"
  }),
  pypiWheelRecipe({
    id: "pypi-wheel-darwin-arm64",
    path: ".release/artifacts/ts_release-{version}-py3-none-macosx_11_0_arm64.whl",
    wheelTag: "py3-none-macosx_11_0_arm64",
    os: "darwin",
    arch: "arm64",
    sourcePath: ".release/artifacts/ts-release-{version}-darwin-arm64",
    wheelPath: "ts_release/bin/ts-release-darwin-arm64"
  }),
  pypiWheelRecipe({
    id: "pypi-wheel-windows-x64",
    path: ".release/artifacts/ts_release-{version}-py3-none-win_amd64.whl",
    wheelTag: "py3-none-win_amd64",
    os: "windows",
    arch: "x64",
    sourcePath: ".release/artifacts/ts-release-{version}-windows-x64.exe",
    wheelPath: "ts_release/bin/ts-release-windows-x64.exe"
  })
]

const releaseBunRecipe = () => ({
  id: "release-ts-cli",
  entry: "apps/release-ts/src/cli/main.ts",
  outputs: [
    {
      id: "cli-linux-x64",
      target: "bun-linux-x64-baseline",
      path: ".release/artifacts/ts-release-{version}-linux-x64",
      downloadUrl: "https://github.com/mannyc2/ts-release/releases/download/v{version}/ts-release-{version}-linux-x64",
      consumers: ["github"]
    },
    {
      id: "cli-linux-arm64",
      target: "bun-linux-arm64",
      path: ".release/artifacts/ts-release-{version}-linux-arm64",
      downloadUrl: "https://github.com/mannyc2/ts-release/releases/download/v{version}/ts-release-{version}-linux-arm64",
      consumers: ["github"]
    },
    {
      id: "cli-darwin-x64",
      target: "bun-darwin-x64",
      path: ".release/artifacts/ts-release-{version}-darwin-x64",
      downloadUrl: "https://github.com/mannyc2/ts-release/releases/download/v{version}/ts-release-{version}-darwin-x64",
      consumers: ["github", "homebrew"]
    },
    {
      id: "cli-darwin-arm64",
      target: "bun-darwin-arm64",
      path: ".release/artifacts/ts-release-{version}-darwin-arm64",
      downloadUrl: "https://github.com/mannyc2/ts-release/releases/download/v{version}/ts-release-{version}-darwin-arm64",
      consumers: ["github", "homebrew"]
    },
    {
      id: "cli-windows-x64",
      target: "bun-windows-x64-baseline",
      path: ".release/artifacts/ts-release-{version}-windows-x64.exe",
      downloadUrl: "https://github.com/mannyc2/ts-release/releases/download/v{version}/ts-release-{version}-windows-x64.exe",
      consumers: ["github", "scoop"]
    }
  ]
})

const baseConfig = (version: string = "0.0.0") => ({
  project: {
    commit: "HEAD",
    tagTemplate: "v{version}"
  },
  build: {
    artifacts: releaseStaticArtifacts(),
    npmPackage: releaseArtifacts()[0],
    bun: releaseBunRecipe(),
    pypiWheel: releasePyPiWheelRecipes()
  },
  publish: {
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "@mannyc1/ts-release",
      packagePath: ".",
      trustedPublishing: {
        provider: "github-actions",
        workflow: "release.yml",
        packageExists: true,
        verifyPackageExists: true
      },
      access: "public",
      provenance: true
    },
    github: {
      repository: "mannyc2/ts-release",
      tokenEnv: "GH_TOKEN",
      draft: false,
      prerelease: false
    },
    homebrew: {
      repository: "mannyc2/homebrew-ts-release",
      formulaName: "ts-release",
      formulaPath: ".release/catalogs/homebrew-ts-release/Formula/ts-release.rb",
      artifactId: "cli-darwin-arm64",
      artifactIds: ["cli-darwin-arm64", "cli-darwin-x64"],
      homepage: "https://github.com/mannyc2/ts-release",
      description: "Portable artifact and package-manager distribution planning for TypeScript projects.",
      tapDirectory: ".release/catalogs/homebrew-ts-release"
    },
    scoop: {
      repository: "mannyc2/scoop-ts-release",
      manifestName: "ts-release",
      manifestPath: ".release/catalogs/scoop-ts-release/bucket/ts-release.json",
      artifactId: "cli-windows-x64",
      homepage: "https://github.com/mannyc2/ts-release",
      description: "Portable artifact and package-manager distribution planning for TypeScript projects.",
      license: "MIT",
      bucketDirectory: ".release/catalogs/scoop-ts-release"
    },
    pypi: {
      repositoryUrl: "https://upload.pypi.org/legacy/",
      pythonExecutable: "python3",
      trustedPublishing: {
        provider: "github-actions",
        workflow: "release.yml",
        publisherConfigured: true
      }
    }
  },
  strict: true,
  evidence: ".release/evidence"
})

interface MutableReleaseCliRecipeFixture {
  readonly id: string
  outputs: Array<{
    readonly id: string
    readonly target: string
    path: string
    readonly downloadUrl: string
    readonly consumers: ReadonlyArray<string>
  }>
}

const releaseCliRecipeFixture = (
  config: ReturnType<typeof baseConfig>
): MutableReleaseCliRecipeFixture => {
  return config.build.bun
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
    const root = await prepareWorkspace({ envExample: "GH_TOKEN=\n" })
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

  test("allows HEAD release with dirty tracked files", async () => {
    const root = await prepareWorkspace({ envExample: "GH_TOKEN=\n", dirty: true })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when package and app package versions disagree", async () => {
    const root = await prepareWorkspace({
      envExample: "GH_TOKEN=\n",
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
    const recipe = releaseCliRecipeFixture(config)
    const [output] = recipe.outputs
    if (output !== undefined) {
      output.path = ".release/artifacts/wrong-0.0.0"
    }
    const root = await prepareWorkspace({ envExample: "GH_TOKEN=\n", config })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("artifact recipe output cli-linux-x64 path")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when expected CLI recipe outputs are missing", async () => {
    const config = baseConfig()
    const recipe = releaseCliRecipeFixture(config)
    recipe.outputs = recipe.outputs.filter((output) => output.id !== "cli-windows-x64")
    const root = await prepareWorkspace({ envExample: "GH_TOKEN=\n", config })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("artifact recipe release-ts-cli must include output cli-windows-x64")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when CLI artifacts are declared statically", async () => {
    const config = baseConfig()
    config.build.artifacts = [
      {
        id: "cli-linux-x64",
        path: ".release/artifacts/ts-release-{version}-linux-x64",
        format: "file",
        consumers: ["github"]
      }
    ]
    const root = await prepareWorkspace({ envExample: "GH_TOKEN=\n", config })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("artifact cli-linux-x64 must be declared by build.bun outputs")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when npm provenance is disabled", async () => {
    const config = baseConfig()
    config.publish.npm.provenance = false
    const root = await prepareWorkspace({ envExample: "GH_TOKEN=\n", config })
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
    config.publish.npm.packageName = "@mannyc1/other-package"
    const root = await prepareWorkspace({ envExample: "GH_TOKEN=\n", config })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("npm self-release target packageName")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
