import { describe, expect, test } from "@effect/bun-test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { makeTempDirectory, runBunProcess, writeJsonFile } from "./helpers.js"
import { join, resolve } from "node:path"
import selfReleaseConfig from "../apps/release-ts/release.config.json" with { type: "json" }

const scriptPath = resolve(
  import.meta.dir,
  "..",
  "apps",
  "release-ts",
  "scripts",
  "check-self-release-live-readiness.ts"
)

const run = (cwd: string, apiBase: string) => runBunProcess(["bun", scriptPath], {
    cwd,
    env: {
      ...process.env,
      SELF_RELEASE_GITHUB_API_BASE: apiBase,
      SELF_RELEASE_NPM_REGISTRY: apiBase,
      SELF_RELEASE_PYPI_API_BASE: apiBase,
      SELF_RELEASE_SKIP_GITHUB_SECRET_CHECK: "1"
    }
  })

const releaseConfig = () => ({
  project: {},
  pypiWheel: [{ ...selfReleaseConfig.pypiWheel[0]!, binaries: [] }],
  publish: {
    github: { repository: selfReleaseConfig.publish.github.repository },
    homebrew: { repository: selfReleaseConfig.publish.homebrew.repository },
    scoop: { repository: selfReleaseConfig.publish.scoop.repository },
    pypi: { trustedPublishing: selfReleaseConfig.publish.pypi.trustedPublishing }
  }
})

const [workflow, installSmokeWorkflow] = await Promise.all([
  readFile(resolve(import.meta.dir, "../.github/workflows/release.yml"), "utf8"),
  readFile(resolve(import.meta.dir, "../.github/workflows/install-smoke.yml"), "utf8")
])

const prepareWorkspace = async (
  options: { readonly installSmokeWorkflow?: boolean } = {}
): Promise<string> => {
  const root = await makeTempDirectory("ts-release-live-readiness-")
  await mkdir(join(root, "apps", "release-ts"), { recursive: true })
  await mkdir(join(root, ".github", "workflows"), { recursive: true })
  await writeJsonFile(join(root, "package.json"), {
    name: "@mannyc1/ts-release",
    version: "1.2.3"
  })
  await writeJsonFile(join(root, "apps", "release-ts", "release.config.json"), releaseConfig())
  await writeFile(join(root, ".github", "workflows", "release.yml"), workflow)
  if (options.installSmokeWorkflow !== false) {
    await writeFile(join(root, ".github", "workflows", "install-smoke.yml"), installSmokeWorkflow)
  }
  return root
}

const makeServer = (options: { readonly emptyHomebrew?: boolean; readonly missingHomebrew?: boolean } = {}) =>
  Bun.serve({
    port: 0,
    fetch: (request) => {
      const path = decodeURIComponent(new URL(request.url).pathname)
      if (path === "/repos/mannyc2/homebrew-ts-release" && options.emptyHomebrew === true) {
        return Response.json({ default_branch: "" })
      }
      const okPaths = new Set([
        "/repos/mannyc2/ts-release",
        "/repos/mannyc2/scoop-ts-release"
      ])
      if (options.missingHomebrew !== true) {
        okPaths.add("/repos/mannyc2/homebrew-ts-release")
      }
      if (okPaths.has(path)) {
        return Response.json({ default_branch: "main" })
      }
      return new Response("not found", { status: 404 })
    }
  })
const checkReadiness = async (
  workspace: { readonly installSmokeWorkflow?: boolean } = {},
  serverOptions: { readonly emptyHomebrew?: boolean; readonly missingHomebrew?: boolean } = {}
) => {
  const root = await prepareWorkspace(workspace)
  const server = makeServer(serverOptions)
  try {
    return await run(root, server.url.origin)
  } finally {
    server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
}

describe("self-release live readiness script", () => {
  test("passes when live release prerequisites are reachable and versions are unused", async () => {
    const result = await checkReadiness()
    expect(result.exitCode).toBe(0)
    for (const check of [
      "npm:version-available", "github:release-tag-available", "smoke:workflow-file",
      "smoke:github-asset-windows-x64", "smoke:scoop-bucket",
      "pypi:trusted-publisher-configured", "pypi:version-available"
    ]) expect(result.stdout).toContain(`ok   ${check}`)
  })

  test("fails when the post-release install smoke workflow is missing", async () => {
    const result = await checkReadiness({ installSmokeWorkflow: false })
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toContain("fail smoke:workflow-file")
  })

  test("fails when a catalog repository is not reachable", async () => {
    const result = await checkReadiness({}, { missingHomebrew: true })
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toContain("fail homebrew:tap:public")
  })

  test("fails when a catalog repository has no default branch", async () => {
    const result = await checkReadiness({}, { emptyHomebrew: true })
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toContain("fail homebrew:tap:default-branch")
  })
})
