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
  "check-self-release-artifacts.ts"
)

const run = (cwd: string) => runBunProcess(["bun", scriptPath], {
    cwd,
    env: {
      ...process.env,
      SELF_RELEASE_SKIP_TWINE_CHECK: "1"
    }
  })

const fakeWheel = (wheelTag: string): string => [
  "Wheel-Version: 1.0",
  "Generator: ts-release",
  "Root-Is-Purelib: false",
  `Tag: ${wheelTag}`,
  ""
].join("\n")

const releaseConfig = () => ({
  project: {},
  builds: [{ ...selfReleaseConfig.builds[0]!, targets: ["darwin-arm64", "windows-x64"] }],
  pypiWheel: [{ ...selfReleaseConfig.pypiWheel[0]!, binaries: [] }],
  publish: {
    homebrew: {
      repository: selfReleaseConfig.publish.homebrew.repository,
      formulaPath: selfReleaseConfig.publish.homebrew.formulaPath
    },
    scoop: {
      repository: selfReleaseConfig.publish.scoop.repository,
      manifestPath: selfReleaseConfig.publish.scoop.manifestPath
    },
    pypi: { pythonExecutable: selfReleaseConfig.publish.pypi.pythonExecutable }
  }
})

const prepareWorkspace = async (): Promise<string> => {
  const root = await makeTempDirectory("ts-release-artifacts-check-")
  await mkdir(join(root, "apps", "release-ts"), { recursive: true })
  await mkdir(join(root, ".release", "artifacts"), { recursive: true })
  await mkdir(join(root, ".release", "catalogs", "homebrew-ts-release", "Formula"), { recursive: true })
  await mkdir(join(root, ".release", "catalogs", "scoop-ts-release", "bucket"), { recursive: true })
  await writeJsonFile(join(root, "package.json"), {
    name: "@mannyc1/ts-release",
    version: "1.2.3"
  })
  await writeJsonFile(join(root, "apps", "release-ts", "release.config.json"), releaseConfig())
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
  await writeJsonFile(join(root, ".release", "catalogs", "scoop-ts-release", "bucket", "ts-release.json"), {
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
