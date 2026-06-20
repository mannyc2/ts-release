import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { validatePlan } from "../src/planner/executor.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { pypiConfig, releaseConfig, runEffect } from "./helpers.js"

const PyPiLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    files: new Map([["dist/release-0.1.0-py3-none-any.whl", "pypi wheel"]]),
    directories: new Set(["."]),
    env: new Map([
      ["TWINE_USERNAME", "__token__"],
      ["TWINE_PASSWORD", "pypi_secret"]
    ])
  }),
  LiveTargetRegistryLayer
)

const createPlan = (config: string) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config)
    return yield* createReleasePlan(intent)
  })

const expectValidationRecord = (
  records: ReadonlyArray<{ readonly id: string; readonly status: string; readonly severity?: string; readonly skipped?: boolean }>,
  id: string,
  expected: { readonly status: string; readonly severity: string; readonly skipped: boolean }
) => {
  const record = records.find((item) => item.id === id)
  expect(record?.status).toBe(expected.status)
  expect(record?.severity).toBe(expected.severity)
  if (record !== undefined && "skipped" in record) {
    expect(record.skipped).toBe(expected.skipped)
  }
}

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
        "--repository-url",
        "https://test.pypi.org/legacy/",
        "dist/release-0.1.0-py3-none-any.whl"
      ])
      expect(publish.command.requiredEnv).toEqual(["TWINE_USERNAME", "TWINE_PASSWORD"])
      expect(publish.command.redactedEnv).toEqual(["TWINE_USERNAME", "TWINE_PASSWORD"])
    }
  })

  test("records simulated validation note evidence with current adapter severities", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(pypiConfig({ dryRunSupport: "simulated" }))
        return yield* validatePlan(plan)
      }),
      PyPiLayer
    )

    expectValidationRecord(evidence.records, "pypi:twine-check:validation", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
  })

  test("records skipped PyPI validation in non-strict mode", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(pypiConfig({ dryRunSupport: "none" }).replace("\"strict\":true", "\"strict\":false"))
        return yield* validatePlan(plan)
      }),
      PyPiLayer
    )

    expect(evidence.records.filter((record) => record.status === "skipped").map((record) => record.id)).toEqual([
      "pypi:twine-check:validation"
    ])
    expectValidationRecord(evidence.records, "pypi:twine-check:validation", {
      status: "skipped",
      skipped: true,
      severity: "warning"
    })
  })

  test("rejects unsafe PyPI target shapes", async () => {
    const noDryRun = await runEffect(createPlan(pypiConfig({ dryRunSupport: "none" })).pipe(Effect.flip), PyPiLayer)
    const halfAuth = await runEffect(
      createPlan(pypiConfig({ passwordEnv: undefined })).pipe(Effect.flip),
      PyPiLayer
    )
    const customAuth = await runEffect(
      createPlan(pypiConfig({ usernameEnv: "PYPI_USERNAME", passwordEnv: "PYPI_PASSWORD" })).pipe(Effect.flip),
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

    expect(noDryRun._tag).toBe("PlanConstructionError")
    expect(halfAuth._tag).toBe("PlanConstructionError")
    expect(customAuth._tag).toBe("PlanConstructionError")
    if (customAuth._tag === "PlanConstructionError") {
      expect(customAuth.reason).toContain("TWINE_USERNAME")
      expect(customAuth.reason).toContain("TWINE_PASSWORD")
    }
    expect(directoryArtifact._tag).toBe("PlanConstructionError")
    expect(noArtifact._tag).toBe("PlanConstructionError")
  })
})
