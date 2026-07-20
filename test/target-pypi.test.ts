import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { pypiConfig, releaseConfig, runEffect } from "./helpers.js"
import { createTestPlan } from "./plan-helpers.js"

const PyPiLayer = makeTestCommandRunnerLayer({
    files: new Map([["dist/release-0.1.0-py3-none-any.whl", "pypi wheel"]]),
    directories: new Set(["."]),
    env: new Map([
      ["TWINE_USERNAME", "__token__"],
      ["TWINE_PASSWORD", "pypi_secret"],
      ["ACTIONS_ID_TOKEN_REQUEST_URL", "https://token.actions.githubusercontent.com"],
      ["ACTIONS_ID_TOKEN_REQUEST_TOKEN", "oidc_request_token"]
    ])
  })

const createPlan = (config: string) =>
  createTestPlan(config)
const trustedConfig = (workflow = "release.yml") => pypiConfig({
  trustedPublishing: { provider: "github-actions", workflow, publisherConfigured: true }
})

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
      createPlan(trustedConfig()),
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
    const directoryConfig = releaseConfig({
      artifacts: [{ id: "wheel", path: ".", format: "directory" }],
      publish: {
        pypi: {
          repositoryUrl: "https://test.pypi.org/legacy/",
          artifactIds: ["wheel"]
        }
      }
    })
    const errors = await Promise.all([
      trustedConfig(".github/workflows/release.yml"),
      directoryConfig,
      pypiConfig().replace("\"id\":\"wheel\"", "\"id\":\"other\"")
    ].map((config) => runEffect(createPlan(config).pipe(Effect.flip), PyPiLayer)))
    const [trustedWorkflowPath, directoryArtifact, noArtifact] = errors

    expect(trustedWorkflowPath?._tag).toBe("ConfigError")
    if (trustedWorkflowPath?._tag === "ConfigError") {
      expect(trustedWorkflowPath.reason).toContain(`["publish"]["pypi"]["trustedPublishing"]["workflow"]`)
    }
    expect(directoryArtifact?._tag).toBe("PlanError")
    expect(noArtifact?._tag).toBe("PlanError")
    if (noArtifact?._tag === "PlanError") {
      expect(noArtifact.field).toBe("publish.pypi.artifactIds")
      expect(noArtifact.reason).toBe("PyPI target references missing artifact wheel.")
    }
  })

  for (const field of ["usernameEnv", "passwordEnv"] as const) {
    test(`rejects removed PyPI ${field} with its migration hint`, async () => {
      const error = await runEffect(createPlan(pypiConfig({ [field]: field === "usernameEnv"
        ? "TWINE_USERNAME"
        : "TWINE_PASSWORD" })).pipe(Effect.flip), PyPiLayer)

      expect(error._tag).toBe("ConfigError")
      if (error._tag === "ConfigError") {
        expect(error.reason).toContain(`removed field $.publish.pypi.${field}`)
        expect(error.reason).toContain("Twine reads TWINE_USERNAME/TWINE_PASSWORD directly")
      }
    })
  }

  test("does not select a generic file solely because its id is wheel", async () => {
    const config = releaseConfig({
      artifacts: [
        {
          id: "wheel",
          path: "dist/release-0.1.0-py3-none-any.whl",
          format: "file"
        }
      ],
      publish: {
        pypi: {
          repositoryUrl: "https://test.pypi.org/legacy/"
        }
      }
    })
    const error = await runEffect(createPlan(config).pipe(Effect.flip), PyPiLayer)

    expect(error._tag).toBe("PlanError")
    if (error._tag === "PlanError") {
      expect(error.field).toBe("artifacts")
      expect(error.reason).toBe("PyPI target must have at least one artifact consumer.")
    }
  })
})
