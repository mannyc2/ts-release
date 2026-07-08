import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { pypiConfig, releaseConfig, runEffect } from "./helpers.js"
import { createTestPlan } from "./plan-helpers.js"

const PyPiLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    files: new Map([["dist/release-0.1.0-py3-none-any.whl", "pypi wheel"]]),
    directories: new Set(["."]),
    env: new Map([
      ["TWINE_USERNAME", "__token__"],
      ["TWINE_PASSWORD", "pypi_secret"],
      ["ACTIONS_ID_TOKEN_REQUEST_URL", "https://token.actions.githubusercontent.com"],
      ["ACTIONS_ID_TOKEN_REQUEST_TOKEN", "oidc_request_token"]
    ])
  }),
)

const createPlan = (config: string) =>
  createTestPlan(config)

describe("PyPI target", () => {
  test("plans PyPI registry capabilities and Twine commands", async () => {
    const plan = await runEffect(createPlan(pypiConfig()), PyPiLayer)
    const pythonVersion = plan.operations.find((operation) => operation.id === "pypi:python-version")
    const twineVersion = plan.operations.find((operation) => operation.id === "pypi:twine-version")
    const twineCheck = plan.operations.find((operation) => operation.id === "pypi:twine-check")
    const publish = plan.operations.find((operation) => operation.id === "pypi:twine-upload")

    expect(plan.surfaceIds).toEqual(["pypi"])
    expect(pythonVersion?.action._tag).toBe("command")
    expect(twineVersion?.action._tag).toBe("command")
    expect(twineCheck?.action._tag).toBe("command")
    expect(publish?.action._tag).toBe("command")
    if (pythonVersion?.action._tag === "command") {
      expect(pythonVersion.action.command.executable).toBe("python")
      expect(pythonVersion.action.command.args).toEqual(["--version"])
    }
    if (twineVersion?.action._tag === "command") {
      expect(twineVersion.action.command.args).toEqual(["-m", "twine", "--version"])
    }
    if (twineCheck?.action._tag === "command") {
      expect(twineCheck.action.command.args).toEqual(["-m", "twine", "check", "dist/release-0.1.0-py3-none-any.whl"])
      expect(twineCheck.action.command.requiredEnv).toEqual([])
    }
    if (publish?.action._tag === "command") {
      expect(publish.risk).toBe("irreversible")
      expect(publish.action.command.args).toEqual([
        "-m",
        "twine",
        "upload",
        "--non-interactive",
        "--repository-url",
        "https://test.pypi.org/legacy/",
        "dist/release-0.1.0-py3-none-any.whl"
      ])
      expect(publish.action.command.requiredEnv).toEqual(["TWINE_USERNAME", "TWINE_PASSWORD"])
      expect(publish.action.command.redactedEnv).toEqual(["TWINE_USERNAME", "TWINE_PASSWORD"])
    }
  })

  test("models PyPI trusted publishing without Twine token secrets", async () => {
    const plan = await runEffect(
      createPlan(pypiConfig({
        usernameEnv: undefined,
        passwordEnv: undefined,
        trustedPublishing: {
          provider: "github-actions",
          workflow: "release.yml",
          publisherConfigured: true
        }
      })),
      PyPiLayer
    )
    const authNote = plan.operations.find((operation) => operation.id === "pypi:twine-trusted-publishing-auth")
    const publish = plan.operations.find((operation) => operation.id === "pypi:twine-upload")

    expect(authNote?.action._tag).toBe("note")
    if (authNote?.action._tag === "note") {
      expect(authNote.action.message).toContain("trusted publishing")
      expect(authNote.action.message).toContain("release.yml")
    }
    if (publish?.action._tag === "command") {
      expect(publish.action.command.requiredEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
      expect(publish.action.command.redactedEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
    }
  })

  test("uses a configured Python executable for Twine commands", async () => {
    const plan = await runEffect(createPlan(pypiConfig({ pythonExecutable: "python3" })), PyPiLayer)
    const pythonVersion = plan.operations.find((operation) => operation.id === "pypi:python-version")
    const twineVersion = plan.operations.find((operation) => operation.id === "pypi:twine-version")
    const twineCheck = plan.operations.find((operation) => operation.id === "pypi:twine-check")
    const publish = plan.operations.find((operation) => operation.id === "pypi:twine-upload")

    if (pythonVersion?.action._tag === "command") {
      expect(pythonVersion.action.command.executable).toBe("python3")
    }
    if (twineVersion?.action._tag === "command") {
      expect(twineVersion.action.command.executable).toBe("python3")
    }
    if (twineCheck?.action._tag === "command") {
      expect(twineCheck.action.command.executable).toBe("python3")
    }
    if (publish?.action._tag === "command") {
      expect(publish.action.command.executable).toBe("python3")
    }
  })

  test("rejects unsafe PyPI target shapes", async () => {
    const halfAuth = await runEffect(
      createPlan(pypiConfig({ passwordEnv: undefined })).pipe(Effect.flip),
      PyPiLayer
    )
    const customAuth = await runEffect(
      createPlan(pypiConfig({ usernameEnv: "PYPI_USERNAME", passwordEnv: "PYPI_PASSWORD" })).pipe(Effect.flip),
      PyPiLayer
    )
    const trustedWithToken = await runEffect(
      createPlan(pypiConfig({
        trustedPublishing: {
          provider: "github-actions",
          workflow: "release.yml",
          publisherConfigured: true
        }
      })).pipe(Effect.flip),
      PyPiLayer
    )
    const trustedWorkflowPath = await runEffect(
      createPlan(pypiConfig({
        usernameEnv: undefined,
        passwordEnv: undefined,
        trustedPublishing: {
          provider: "github-actions",
          workflow: ".github/workflows/release.yml",
          publisherConfigured: true
        }
      })).pipe(Effect.flip),
      PyPiLayer
    )
    const directoryConfig = releaseConfig({
      artifacts: [
        {
          id: "wheel",
          path: ".",
          format: "directory"
        }
      ],
      publish: {
        pypi: {
          repositoryUrl: "https://test.pypi.org/legacy/"
        }
      }
    })
    const directoryArtifact = await runEffect(createPlan(directoryConfig).pipe(Effect.flip), PyPiLayer)
    const noArtifact = await runEffect(
      createPlan(pypiConfig().replace("\"id\":\"wheel\"", "\"id\":\"other\"")).pipe(Effect.flip),
      PyPiLayer
    )

    expect(halfAuth._tag).toBe("PlanError")
    expect(customAuth._tag).toBe("PlanError")
    expect(trustedWithToken._tag).toBe("PlanError")
    expect(trustedWorkflowPath._tag).toBe("ConfigValidationError")
    if (customAuth._tag === "PlanError") {
      expect(customAuth.reason).toContain("TWINE_USERNAME")
      expect(customAuth.reason).toContain("TWINE_PASSWORD")
    }
    if (trustedWithToken._tag === "PlanError") {
      expect(trustedWithToken.reason).toContain("trusted publishing")
    }
    if (trustedWorkflowPath._tag === "ConfigValidationError") {
      expect(trustedWorkflowPath.reason).toContain(`["publish"]["pypi"]["trustedPublishing"]["workflow"]`)
    }
    expect(directoryArtifact._tag).toBe("PlanError")
    expect(noArtifact._tag).toBe("PlanError")
  })
})
