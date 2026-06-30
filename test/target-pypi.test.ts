import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { pypiConfig, releaseConfig, runEffect } from "./helpers.js"

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
  LiveTargetRegistryLayer
)

const createPlan = (config: string) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config)
    return yield* createReleasePlan(intent)
  })

describe("PyPI target", () => {
  test("plans PyPI registry capabilities and Twine commands", async () => {
    const plan = await runEffect(createPlan(pypiConfig()), PyPiLayer)
    const pypi = plan.targetCapabilities.find((capability) => capability.targetId === "pypi")
    const pythonVersion = plan.operations.find((operation) => operation.id === "pypi:python-version")
    const twineVersion = plan.operations.find((operation) => operation.id === "pypi:twine-version")
    const twineCheck = plan.operations.find((operation) => operation.id === "pypi:twine-check")
    const publish = plan.operations.find((operation) => operation.id === "pypi:twine-upload")

    expect(pypi?.targetTag).toBe("PyPiRegistryTarget")
    expect(pypi?.authRequirement).toBe("env-token")
    expect(pypi?.validationStrategy).toBe("native-command")
    expect(pypi?.mutability).toBe("immutable")
    expect(pypi?.recovery).toBe("publish-new-version")
    expect(pythonVersion?._tag).toBe("ValidateCommandOperation")
    expect(twineVersion?._tag).toBe("ValidateCommandOperation")
    expect(twineCheck?._tag).toBe("ValidateCommandOperation")
    expect(publish?._tag).toBe("PublishCommandOperation")
    if (pythonVersion?._tag === "ValidateCommandOperation") {
      expect(pythonVersion.command.executable).toBe("python")
      expect(pythonVersion.command.args).toEqual(["--version"])
    }
    if (twineVersion?._tag === "ValidateCommandOperation") {
      expect(twineVersion.command.args).toEqual(["-m", "twine", "--version"])
    }
    if (twineCheck?._tag === "ValidateCommandOperation") {
      expect(twineCheck.command.args).toEqual(["-m", "twine", "check", "dist/release-0.1.0-py3-none-any.whl"])
      expect(twineCheck.command.requiredEnv).toEqual([])
    }
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.risk).toBe("irreversible")
      expect(publish.command.args).toEqual([
        "-m",
        "twine",
        "upload",
        "--non-interactive",
        "--repository-url",
        "https://test.pypi.org/legacy/",
        "dist/release-0.1.0-py3-none-any.whl"
      ])
      expect(publish.command.requiredEnv).toEqual(["TWINE_USERNAME", "TWINE_PASSWORD"])
      expect(publish.command.redactedEnv).toEqual(["TWINE_USERNAME", "TWINE_PASSWORD"])
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
    const pypi = plan.targetCapabilities.find((capability) => capability.targetId === "pypi")
    const authNote = plan.operations.find((operation) => operation.id === "pypi:twine-trusted-publishing-auth")
    const publish = plan.operations.find((operation) => operation.id === "pypi:twine-upload")

    expect(pypi?.authRequirement).toBe("trusted-publishing")
    expect(pypi?.authSetup).toEqual({
      runsIn: "ci",
      provider: "github-actions",
      workflow: "release.yml",
      requiredPermissions: [{ name: "id-token", value: "write" }],
      prerequisites: ["pypi-trusted-publisher-configured"]
    })
    expect(authNote?._tag).toBe("ValidationNoteOperation")
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.command.requiredEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
      expect(publish.command.redactedEnv).toEqual([
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

    if (pythonVersion?._tag === "ValidateCommandOperation") {
      expect(pythonVersion.command.executable).toBe("python3")
    }
    if (twineVersion?._tag === "ValidateCommandOperation") {
      expect(twineVersion.command.executable).toBe("python3")
    }
    if (twineCheck?._tag === "ValidateCommandOperation") {
      expect(twineCheck.command.executable).toBe("python3")
    }
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.command.executable).toBe("python3")
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
          format: "directory",
          consumers: ["pypi"]
        }
      ],
      targets: [
        {
          _tag: "PyPiRegistryTarget",
          id: "pypi",
          repositoryUrl: "https://test.pypi.org/legacy/",
          dryRunSupport: "native",
          mutability: "immutable",
          recovery: "publish-new-version"
        }
      ]
    })
    const directoryArtifact = await runEffect(createPlan(directoryConfig).pipe(Effect.flip), PyPiLayer)
    const noArtifact = await runEffect(
      createPlan(pypiConfig().replace("\"consumers\":[\"pypi\"]", "\"consumers\":[\"other\"]")).pipe(Effect.flip),
      PyPiLayer
    )

    expect(halfAuth._tag).toBe("PlanConstructionError")
    expect(customAuth._tag).toBe("PlanConstructionError")
    expect(trustedWithToken._tag).toBe("PlanConstructionError")
    expect(trustedWorkflowPath._tag).toBe("ReleaseNormalizationError")
    if (customAuth._tag === "PlanConstructionError") {
      expect(customAuth.reason).toContain("TWINE_USERNAME")
      expect(customAuth.reason).toContain("TWINE_PASSWORD")
    }
    if (trustedWithToken._tag === "PlanConstructionError") {
      expect(trustedWithToken.reason).toContain("trusted publishing")
    }
    if (trustedWorkflowPath._tag === "ReleaseNormalizationError") {
      expect(trustedWorkflowPath.field).toBe("targets.pypi.trustedPublishing.workflow")
    }
    expect(directoryArtifact._tag).toBe("PlanConstructionError")
    expect(noArtifact._tag).toBe("PlanConstructionError")
  })
})
