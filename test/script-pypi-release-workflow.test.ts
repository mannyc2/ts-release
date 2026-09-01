import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolveConfig } from "../src/resolve/resolve.js"

interface WorkflowStep {
  readonly name?: string
  readonly uses?: string
  readonly run?: string
  readonly with?: Readonly<Record<string, unknown>>
}

interface WorkflowJob {
  readonly if?: string
  readonly needs?: string
  readonly environment?: string
  readonly permissions?: Readonly<Record<string, string>>
  readonly "runs-on"?: string
  readonly steps?: ReadonlyArray<WorkflowStep>
}

interface Workflow {
  readonly permissions?: Readonly<Record<string, string>>
  readonly jobs?: Readonly<Record<string, WorkflowJob>>
}

interface PyPiConfig {
  readonly builds: ReadonlyArray<{ readonly entry: string }>
  readonly preparations: ReadonlyArray<{
    readonly id: string
    readonly outputs: ReadonlyArray<{ readonly id: string, readonly path: string }>
  }>
  readonly publish: {
    readonly pypi: {
      readonly artifacts: ReadonlyArray<string>
      readonly authentication: {
        readonly strategy: string
        readonly owner: string
        readonly action: string
        readonly environment: string
        readonly projects: ReadonlyArray<string>
        readonly repository: string
        readonly workflow: string
        readonly workflowRef: string
      }
    }
  }
}

const workflow = Bun.YAML.parse(readFileSync(".github/workflows/pypi-release.yml", "utf8")) as Workflow
const config = JSON.parse(readFileSync("apps/release-ts/pypi-release.config.json", "utf8")) as PyPiConfig

describe("official PyPA trusted-publishing workflow", () => {
  test("keeps OIDC in a minimal isolated publication job", () => {
    expect(workflow.permissions).toEqual({})
    expect(Object.keys(workflow.jobs ?? {})).toEqual(["build", "publish"])
    const build = workflow.jobs?.build
    const publish = workflow.jobs?.publish
    expect(build?.if).toBe("${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha }}")
    expect(build?.["runs-on"]).toBe("ubuntu-24.04")
    expect(build?.permissions).toEqual({ contents: "read" })
    expect(build?.environment).toBeUndefined()
    expect(build?.steps?.map(({ uses }) => uses).filter(Boolean)).toEqual([
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
      "actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830",
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
    ])
    const upload = build?.steps?.find(({ uses }) => uses?.startsWith("actions/upload-artifact@"))
    expect(upload?.with).not.toHaveProperty("retention-days")

    expect(publish?.needs).toBe("build")
    expect(publish?.["runs-on"]).toBe("ubuntu-24.04")
    expect(publish?.environment).toBe("pypi")
    expect(publish?.permissions).toEqual({ "id-token": "write" })
    expect(publish?.steps?.map(({ uses }) => uses)).toEqual([
      "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
      "pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33"
    ])
    expect(JSON.stringify(publish?.steps)).not.toMatch(/password|username|api-token|secret/iu)
  })

  test("binds the prepared four-wheel set to the exact external publisher identity", () => {
    const resolved = resolveConfig(config, {
      commit: "c".repeat(40),
      manifestName: "@mannyc1/ts-release",
      manifestVersion: "0.3.0",
      repository: "mannyc2/ts-release"
    })
    expect(resolved.project).toMatchObject({
      name: "ts-release",
      packageName: "@mannyc1/ts-release",
      version: "0.3.0"
    })
    expect(config.builds.map(({ entry }) => entry)).toEqual(["apps/release-ts/src/cli/main.ts"])
    const pypi = config.publish.pypi
    expect(pypi.authentication).toEqual({
      strategy: "trusted-publishing",
      owner: "external",
      action: "pypa/gh-action-pypi-publish@release/v1",
      repository: "mannyc2/ts-release",
      workflow: "pypi-release.yml",
      workflowRef: "refs/heads/main",
      environment: "pypi",
      projects: ["ts-release"]
    })
    expect(pypi.artifacts).toHaveLength(4)
    const outputs = config.preparations.find(({ id }) => id === "pypi-wheels")?.outputs ?? []
    expect(outputs.map(({ id }) => id)).toEqual([...pypi.artifacts])
    expect(outputs.map(({ path }) => path)).toEqual([
      ".release/pypi-wheels/ts_release-{version}-py3-none-manylinux_2_17_x86_64.whl",
      ".release/pypi-wheels/ts_release-{version}-py3-none-manylinux_2_17_aarch64.whl",
      ".release/pypi-wheels/ts_release-{version}-py3-none-macosx_13_0_x86_64.whl",
      ".release/pypi-wheels/ts_release-{version}-py3-none-macosx_13_0_arm64.whl"
    ])
  })
})
