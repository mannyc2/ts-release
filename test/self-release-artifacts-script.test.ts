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
  "check-self-release-artifacts.ts"
)

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const run = async (cwd: string): Promise<{
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> => {
  const subprocess = Bun.spawn(["bun", scriptPath], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      SELF_RELEASE_SKIP_TWINE_CHECK: "1"
    }
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

const fakeWheel = (wheelTag: string): string => [
  "Wheel-Version: 1.0",
  "Generator: ts-release",
  "Root-Is-Purelib: false",
  `Tag: ${wheelTag}`,
  ""
].join("\n")

const releaseConfig = () => ({
  build: {
    bun: {
      id: "release-ts-cli",
      entry: "apps/release-ts/src/cli/main.ts",
      outputs: [
        {
          id: "cli-darwin-arm64",
          target: "bun-darwin-arm64",
          path: ".release/artifacts/ts-release-{version}-darwin-arm64",
          consumers: ["github", "homebrew"]
        },
        {
          id: "cli-windows-x64",
          target: "bun-windows-x64-baseline",
          path: ".release/artifacts/ts-release-{version}-windows-x64.exe",
          consumers: ["github", "scoop"]
        }
      ]
    },
    pypiWheel: [
      {
        id: "pypi-wheel-linux-x64",
        path: ".release/artifacts/ts_release-{version}-py3-none-manylinux2014_x86_64.whl",
        wheelTag: "py3-none-manylinux2014_x86_64",
        packageName: "ts-release",
        moduleName: "ts_release",
        consoleScript: "ts-release",
        summary: "Portable artifact and package-manager distribution planning for TypeScript projects.",
        homepage: "https://github.com/mannyc2/ts-release",
        license: "MIT",
        requiresPython: ">=3.8",
        binaries: [],
        consumers: ["pypi"]
      }
    ]
  },
  publish: {
    homebrew: {
      formulaPath: ".release/catalogs/homebrew-ts-release/Formula/ts-release.rb"
    },
    scoop: {
      manifestPath: ".release/catalogs/scoop-ts-release/bucket/ts-release.json"
    },
    pypi: {
      pythonExecutable: "python3"
    }
  }
})

const prepareWorkspace = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "ts-release-artifacts-check-"))
  await mkdir(join(root, "apps", "release-ts"), { recursive: true })
  await mkdir(join(root, ".release", "artifacts"), { recursive: true })
  await mkdir(join(root, ".release", "catalogs", "homebrew-ts-release", "Formula"), { recursive: true })
  await mkdir(join(root, ".release", "catalogs", "scoop-ts-release", "bucket"), { recursive: true })
  await writeJson(join(root, "package.json"), {
    name: "@mannyc1/ts-release",
    version: "1.2.3"
  })
  await writeJson(join(root, "apps", "release-ts", "release.config.json"), releaseConfig())
  await writeFile(join(root, ".release", "artifacts", "ts-release-1.2.3-darwin-arm64"), "darwin")
  await writeFile(join(root, ".release", "artifacts", "ts-release-1.2.3-windows-x64.exe"), "windows")
  await writeFile(
    join(root, ".release", "artifacts", "ts_release-1.2.3-py3-none-manylinux2014_x86_64.whl"),
    fakeWheel("py3-none-manylinux2014_x86_64")
  )
  await writeFile(
    join(root, ".release", "catalogs", "homebrew-ts-release", "Formula", "ts-release.rb"),
    [
      "class TsRelease < Formula",
      "  version \"1.2.3\"",
      "  url \"https://github.com/mannyc2/ts-release/releases/download/v1.2.3/ts-release-1.2.3-darwin-arm64\"",
      "  def install",
      "    chmod 0755, bin/\"ts-release\"",
      "  end",
      "  test do",
      "    assert File.exist?(bin/\"ts-release\")",
      "    assert File.executable?(bin/\"ts-release\")",
      "  end",
      "end",
      ""
    ].join("\n")
  )
  await writeJson(join(root, ".release", "catalogs", "scoop-ts-release", "bucket", "ts-release.json"), {
    version: "1.2.3",
    url: "https://github.com/mannyc2/ts-release/releases/download/v1.2.3/ts-release-1.2.3-windows-x64.exe",
    hash: "a".repeat(64)
  })
  return root
}

describe("self-release artifact script", () => {
  test("passes for staged binaries, wheels, and catalog metadata", async () => {
    const root = await prepareWorkspace()
    try {
      const result = await run(root)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("ok   github:binary:0")
      expect(result.stdout).toContain("ok   pypi:wheel:0")
      expect(result.stdout).toContain("ok   pypi:wheel-root-is-purelib:0")
      expect(result.stdout).toContain("ok   pypi:wheel-tag:0")
      expect(result.stdout).toContain("ok   homebrew:formula-executable-bit")
      expect(result.stdout).toContain("ok   homebrew:formula-test")
      expect(result.stdout).toContain("ok   scoop:manifest-sha256")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when a catalog file is missing", async () => {
    const root = await prepareWorkspace()
    try {
      await rm(join(root, ".release", "catalogs", "scoop-ts-release", "bucket", "ts-release.json"))
      const result = await run(root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toContain("fail scoop:manifest-file")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
