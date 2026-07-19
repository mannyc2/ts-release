import { afterAll, beforeAll, describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { mkdir, rm } from "node:fs/promises"
import { dirname } from "node:path"
import { pid } from "node:process"
import { BunReleaseWorkflowRuntimeLayer } from "../apps/release-ts/src/runtime.js"
import { runOperations } from "../src/run/executor.js"
import { planRelease } from "../src/engine/engine.js"
import type { ReleasePlan } from "../src/grammar/plan.js"
import { type Operation } from "../src/grammar/operation.js"
import { ExecutionApproval } from "../src/grammar/approval.js"
import { runEffect } from "./helpers.js"

const integrationEnabled = Bun.env.RELEASE_INTEGRATION_TOOLS === "1"
const maybeTest = integrationEnabled ? test : test.skip
const fixtureRoot = Bun.env.RELEASE_INTEGRATION_FIXTURE_DIR ?? `.tmp-release-integration-tools-${pid}`
const npmPackagePath = `${fixtureRoot}/npm-package`
const githubAssetPath = `${fixtureRoot}/github-asset.tgz`
const archiveBinaryPath = `${fixtureRoot}/release`
const archivePath = `${fixtureRoot}/.release/artifacts/release-integration-fixture_0.0.0_linux_amd64.tar.gz`

const IntegrationLayer = BunReleaseWorkflowRuntimeLayer

const writeText = async (path: string, contents: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, contents)
}

const writeJson = async (path: string, value: unknown): Promise<void> =>
  writeText(path, `${JSON.stringify(value, null, 2)}\n`)

const planFromConfig = (name: string, config: unknown, root: string = ".") =>
  Effect.gen(function*() {
    const configFileName = `${name}.config.json`
    const writePath = root === "." ? `${fixtureRoot}/${configFileName}` : `${root}/${configFileName}`
    const configPath = root === "." ? writePath : configFileName
    yield* Effect.promise(() => writeJson(writePath, config))
    return yield* planRelease({ workspace: root, config: configPath })
  })

const runSelectedOperations = (
  plan: ReleasePlan,
  operations: ReadonlyArray<Operation>
) =>
  runOperations(operations, ExecutionApproval.none, {
    root: plan.source.root,
    identity: plan.identity,
    artifacts: plan.artifacts,
    notices: plan.notices,
    ...(plan.source.configPath === undefined ? {} : { configPath: plan.source.configPath })
  })

const runSelectedOperationsWithApproval = (
  plan: ReleasePlan,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval
) =>
  runOperations(operations, approval, {
    root: plan.source.root,
    identity: plan.identity,
    artifacts: plan.artifacts,
    notices: plan.notices,
    ...(plan.source.configPath === undefined ? {} : { configPath: plan.source.configPath })
  })

describe("real tool integrations", () => {
  if (integrationEnabled) {
    beforeAll(async () => {
      await rm(fixtureRoot, { recursive: true, force: true })
      await writeJson(`${npmPackagePath}/package.json`, {
        name: "release-integration-fixture",
        version: "0.0.0",
        type: "module",
        files: ["index.js"]
      })
      await writeText(`${npmPackagePath}/index.js`, "export const fixture = true\n")
      await writeText(githubAssetPath, "github asset fixture\n")
      await writeText(archiveBinaryPath, "#!/usr/bin/env sh\necho fixture\n")
      await writeText(`${fixtureRoot}/LICENSE`, "MIT\n")
    })

    afterAll(async () => {
      await rm(fixtureRoot, { recursive: true, force: true })
    })
  }

  maybeTest("runs npm adapter validators against the real npm CLI", async () => {
    const plan = await runEffect(
      planFromConfig("npm", {
        project: {
          name: "release-integration-fixture",
          version: "0.0.0",
          commit: "integration",
          tag: "v0.0.0"
        },
        artifacts: [
          {
            id: "npm-package",
            path: npmPackagePath,
            format: "directory"
          }
        ],
        publish: {
          npm: {
            registry: "https://registry.npmjs.org",
            packageName: "release-integration-fixture",
            packagePath: npmPackagePath
          }
        },
        evidence: ".release/integration-evidence"
      }),
      IntegrationLayer
    )

    const operations = plan.operations.filter((operation) =>
      operation.id === "npm:npm-version" || operation.id === "npm:npm-pack-dry-run"
    )
    const evidence = await runEffect(runSelectedOperations(plan, operations), IntegrationLayer)

    expect(evidence.records.map((record) => record.operationId).sort()).toEqual([
      "npm:npm-pack-dry-run",
      "npm:npm-version"
    ])
    expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
  })

  maybeTest("plans GitHub adapter validation without shelling out", async () => {
    const plan = await runEffect(
      planFromConfig("github", {
        project: {
          name: "release-integration-fixture",
          version: "0.0.0",
          commit: "integration",
          tag: "v0.0.0"
        },
        artifacts: [
          {
            id: "github-asset",
            path: githubAssetPath,
            format: "tarball"
          }
        ],
        publish: {
          github: {
            repository: "owner/repo",
            ...(Bun.env.GH_TOKEN === undefined ? {} : { tokenEnv: "GH_TOKEN" })
          }
        },
        evidence: ".release/integration-evidence"
      }),
      IntegrationLayer
    )

    const operations = plan.operations.filter((operation) =>
      operation.id === "github:github-release-dry-run"
    )
    const evidence = await runEffect(
      runSelectedOperations(plan, operations),
      IntegrationLayer
    )

    expect(plan.operations.some((operation) => operation.id.startsWith("github:gh-"))).toBe(false)
    expect(evidence.records.map((record) => record.operationId)).toEqual(["github:github-release-dry-run"])
    expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
  })

  maybeTest("stages tar.gz archives that the real tar CLI can list", async () => {
    const plan = await runEffect(
      planFromConfig("archive", {
        project: {
          name: "release-integration-fixture",
          version: "0.0.0",
          commit: "integration",
          tag: "v0.0.0"
        },
        artifacts: [
          {
            id: "cli-linux-x64",
            path: "release",
            format: "executable",
            variant: {
              os: "linux",
              arch: "x64",
              libc: "glibc",
              binaryName: "release-integration-fixture",
              targetTriple: "linux-x64"
            }
          }
        ],
        archives: [{ wrapInDirectory: true }],
        publish: {},
        evidence: ".release/integration-evidence"
      }, fixtureRoot),
      IntegrationLayer
    )

    const operations = plan.operations.filter((operation) => operation.id === "archive:archive-linux-x64")
    const evidence = await runEffect(
      runSelectedOperationsWithApproval(
        plan,
        operations,
        ExecutionApproval.make({ execute: true, approveIrreversible: false })
      ),
      IntegrationLayer
    )
    const process = Bun.spawn(["tar", "-tzf", archivePath], {
      stdout: "pipe",
      stderr: "pipe"
    })
    const stdout = await new Response(process.stdout).text()
    const stderr = await new Response(process.stderr).text()
    const exitCode = await process.exited

    expect(evidence.records.map((record) => record.operationId)).toEqual(["archive:archive-linux-x64"])
    expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain("release-integration-fixture_0.0.0_linux_amd64/release-integration-fixture")
    expect(stdout).toContain("release-integration-fixture_0.0.0_linux_amd64/LICENSE")
  })
})
