import { readFileSync } from "node:fs"
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { parseCanonicalJsonBytes } from "../src/canonical-document.js"
import { ArchitectureGateInvocationV2 } from "../src/schema/harness-protocol.js"
import { ArtifactId } from "../src/schema/primitives.js"
import {
  encodeGateCommandInput,
  makeGateCommandInput
} from "../src/schema/trial-result.js"
import { decodeArchitectureTrialSpec } from "../src/schema/trial-spec.js"
import { gateDefinitionSha256 } from "../src/schema/trial-spec.js"
import {
  TRIAL_GATE_COMMAND_TIMEOUT_MILLISECONDS,
  makeTrialGateCommandExecutor,
  type GateCommandExecution
} from "../src/trial-gate-command.js"
import { sha256Bytes } from "../src/trial-hash.js"
import { inventoryCanonicalTree } from "../src/trial-inventory.js"
import {
  TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
  TrialProcessIoError,
  TrialProcessOutputLimitError,
  TrialProcessSignalError,
  TrialProcessSpawnError,
  TrialProcessTimeoutError,
  makeTrialProcessStreamCapture,
  type TrialProcessError,
  type TrialProcessRequest,
  type TrialProcessResult,
  type TrialProcessService
} from "../src/trial-process.js"

const spec = Effect.runSync(decodeArchitectureTrialSpec(parseCanonicalJsonBytes(
  new Uint8Array(readFileSync(new URL(
    "../../../docs/refactor/architecture-program/inputs/trial-spec.json",
    import.meta.url
  )))
)))
const gate = spec.gateRequirements[0]!
const bunBytes = new TextEncoder().encode("fixture Bun executable\n")
const empty = new Uint8Array()
const success = (exitCode = 0): TrialProcessResult => ({
  exitCode,
  stdout: new TextEncoder().encode("gate stdout\n"),
  stderr: empty
})

interface Fixture {
  readonly root: string
  readonly bunPath: string
  readonly packageManifestPath: string
  readonly packageManifestBytes: Uint8Array
  readonly runnerSourceRoot: string
  readonly runnerSourceTreeSha256: ReturnType<typeof sha256Bytes>
  readonly typescriptConfigPath: string
  readonly typescriptConfigBytes: Uint8Array
  readonly inspectionRoot: string
}

const commandRequest = (
  fixture: Fixture,
  inputGate = gate
) => {
  const candidateTreeSha256 = sha256Bytes(new TextEncoder().encode("candidate-tree"))
  return {
    gate: inputGate,
    commandInput: makeGateCommandInput(new ArchitectureGateInvocationV2({
      schemaVersion: "architecture-gate-invocation-v2" as const,
      runContextSha256: sha256Bytes(new TextEncoder().encode("run-context")),
      candidateId: "M1-extracted-fold" as const,
      candidateTreeSha256,
      definitionSha256: gateDefinitionSha256(inputGate),
      gateId: inputGate.id,
      lawIds: inputGate.lawIds.map((id) => ArtifactId.make(id)),
      caseIds: inputGate.caseIds,
      probeIds: inputGate.probeIds
    }), candidateTreeSha256),
    inspectionRoot: fixture.inspectionRoot
  }
}

const withFixture = async <A>(use: (fixture: Fixture) => Promise<A>): Promise<A> => {
  const root = await mkdtemp("/tmp/ts-release-gate-command-test-")
  const bunPath = join(root, "bun")
  const packageManifestPath = join(root, "tools/architecture-program/package.json")
  const packageManifestBytes = new TextEncoder().encode('{"name":"fixture-runner"}\n')
  const runnerSourceRoot = join(root, "tools/architecture-program/src")
  const typescriptConfigPath = join(root, "tools/architecture-program/tsconfig.json")
  const typescriptConfigBytes = new TextEncoder().encode('{"compilerOptions":{}}\n')
  const inspectionRoot = join(root, "candidate")
  try {
    await writeFile(bunPath, bunBytes, { mode: 0o755 })
    await chmod(bunPath, 0o755)
    await mkdir(join(root, "tools/architecture-program"), { recursive: true })
    await writeFile(packageManifestPath, packageManifestBytes)
    await mkdir(runnerSourceRoot)
    await writeFile(join(runnerSourceRoot, "gate.ts"), "export const gate = true\n")
    await writeFile(typescriptConfigPath, typescriptConfigBytes)
    await mkdir(inspectionRoot)
    const runnerSourceTreeSha256 = (await Effect.runPromise(
      inventoryCanonicalTree(runnerSourceRoot)
    )).treeSha256
    return await use({
      root,
      bunPath,
      packageManifestPath,
      packageManifestBytes,
      runnerSourceRoot,
      runnerSourceTreeSha256,
      typescriptConfigPath,
      typescriptConfigBytes,
      inspectionRoot
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const execute = async (
  fixture: Fixture,
  trialProcess: TrialProcessService,
  inputGate = gate,
  expectedSha256 = sha256Bytes(bunBytes)
): Promise<GateCommandExecution> => await Effect.runPromise(
  makeTrialGateCommandExecutor({
    repositoryRoot: fixture.root,
    runnerSourceRoot: fixture.runnerSourceRoot,
    expectedRunnerSourceTreeSha256: fixture.runnerSourceTreeSha256,
    runnerPackageManifestPath: fixture.packageManifestPath,
    expectedRunnerPackageManifestSha256: sha256Bytes(fixture.packageManifestBytes),
    runnerTypeScriptConfigPath: fixture.typescriptConfigPath,
    expectedRunnerTypeScriptConfigSha256: sha256Bytes(fixture.typescriptConfigBytes),
    bunExecutablePath: fixture.bunPath,
    expectedBunExecutableSha256: expectedSha256,
    inheritedPath: "/fixture/path",
    trialProcess
  }).execute(commandRequest(fixture, inputGate))
) as GateCommandExecution

const service = (
  effect: Effect.Effect<TrialProcessResult, TrialProcessError>
): TrialProcessService => ({ run: () => effect })

describe("TrialGateCommandExecutor", () => {
  it("runs the exact declared command through the retained Bun path and preserves nonzero exit", async () =>
    withFixture(async (fixture) => {
      const requests: Array<TrialProcessRequest> = []
      const trialProcess: TrialProcessService = {
        run: (request) => {
          requests.push(request)
          return Effect.succeed(success(7))
        }
      }
      const result = await execute(fixture, trialProcess)

      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({
        argv: [fixture.bunPath, ...gate.command.slice(1)],
        cwd: fixture.root,
        timeoutMilliseconds: TRIAL_GATE_COMMAND_TIMEOUT_MILLISECONDS,
        closedEnvironment: { PATH: "/fixture/path" }
      })
      const envelope = parseCanonicalJsonBytes(requests[0]!.stdin) as {
        readonly commandInput: ReturnType<typeof encodeGateCommandInput>
        readonly executionLocal: { readonly inspectionRoot: string }
      }
      expect(envelope.commandInput).toMatchObject({
        schemaVersion: "architecture-gate-command-input-v2",
        invocation: {
          gateId: gate.id,
          definitionSha256: gateDefinitionSha256(gate),
          candidateId: "M1-extracted-fold"
        },
        inspectionAuthority: "runner-no-follow-snapshot-v1",
        inspectionRootChannel: "execution-local-envelope-v1"
      })
      expect(envelope.executionLocal.inspectionRoot).toBe(fixture.inspectionRoot)
      expect(result.processAttempt._tag).toBe("Exited")
      if (result.processAttempt._tag === "Exited") {
        expect(result.processAttempt.exitCode).toBe(7)
      }
      expect(result.failureIds).toEqual([])
    }))

  it("fails before spawn on malformed commands and Bun digest mismatch", async () =>
    withFixture(async (fixture) => {
      let calls = 0
      const trialProcess: TrialProcessService = {
        run: () => {
          calls += 1
          return Effect.succeed(success())
        }
      }
      const malformed = await execute(fixture, trialProcess, {
        ...gate,
        command: ["node", "gate.js"]
      } as unknown as typeof gate)
      expect(malformed.processAttempt._tag).toBe("NotStarted")
      expect(malformed.failureIds).toEqual(["gate.command-shape"])

      const missingNoEnvFile = await execute(fixture, trialProcess, {
        ...gate,
        command: gate.command.filter((argument) => argument !== "--no-env-file")
      } as unknown as typeof gate)
      expect(missingNoEnvFile.processAttempt._tag).toBe("NotStarted")
      expect(missingNoEnvFile.failureIds).toEqual(["gate.command-shape"])

      const missingPinnedShell = await execute(fixture, trialProcess, {
        ...gate,
        command: gate.command.filter((argument) => argument !== "--shell=bun")
      } as unknown as typeof gate)
      expect(missingPinnedShell.processAttempt._tag).toBe("NotStarted")
      expect(missingPinnedShell.failureIds).toEqual(["gate.command-shape"])

      const reorderedFlags = [...gate.command]
      ;[reorderedFlags[2], reorderedFlags[4]] = [reorderedFlags[4]!, reorderedFlags[2]!]
      const reordered = await execute(fixture, trialProcess, {
        ...gate,
        command: reorderedFlags
      } as unknown as typeof gate)
      expect(reordered.processAttempt._tag).toBe("NotStarted")
      expect(reordered.failureIds).toEqual(["gate.command-shape"])

      const digestMismatch = await execute(
        fixture,
        trialProcess,
        gate,
        "0".repeat(64) as typeof expectedDigest
      )
      expect(digestMismatch.processAttempt._tag).toBe("NotStarted")
      expect(digestMismatch.failureIds).toEqual(["gate.command-bun-preverification"])
      expect(calls).toBe(0)
    }))

  it("retains the real attempt and rejects a post-execution Bun digest change", async () =>
    withFixture(async (fixture) => {
      const trialProcess: TrialProcessService = {
        run: () => Effect.promise(async () => {
          await writeFile(fixture.bunPath, "changed executable\n")
          await chmod(fixture.bunPath, 0o755)
          return success()
        })
      }
      const result = await execute(fixture, trialProcess)
      expect(result.processAttempt._tag).toBe("Exited")
      expect(result.failureIds).toEqual(["gate.command-bun-postverification"])
    }))

  it("binds the exact canonical command input and rejects an unavailable inspection snapshot", async () =>
    withFixture(async (fixture) => {
      let calls = 0
      const executor = makeTrialGateCommandExecutor({
        repositoryRoot: fixture.root,
        runnerSourceRoot: fixture.runnerSourceRoot,
        expectedRunnerSourceTreeSha256: fixture.runnerSourceTreeSha256,
        runnerPackageManifestPath: fixture.packageManifestPath,
        expectedRunnerPackageManifestSha256: sha256Bytes(fixture.packageManifestBytes),
        runnerTypeScriptConfigPath: fixture.typescriptConfigPath,
        expectedRunnerTypeScriptConfigSha256: sha256Bytes(fixture.typescriptConfigBytes),
        bunExecutablePath: fixture.bunPath,
        expectedBunExecutableSha256: sha256Bytes(bunBytes),
        inheritedPath: "/fixture/path",
        trialProcess: {
          run: () => {
            calls += 1
            return Effect.succeed(success())
          }
        }
      })
      const request = commandRequest(fixture)
      const tampered = await Effect.runPromise(executor.execute({
        ...request,
        commandInput: {
          ...request.commandInput,
          invocationSha256: "0".repeat(64)
        } as typeof request.commandInput
      })) as GateCommandExecution
      expect(tampered.processAttempt._tag).toBe("NotStarted")
      expect(tampered.failureIds).toContain("gate.command-input-invocation")

      const missing = await Effect.runPromise(executor.execute({
        ...request,
        inspectionRoot: null
      })) as GateCommandExecution
      expect(missing.processAttempt._tag).toBe("NotStarted")
      expect(missing.failureIds).toEqual(["gate.command-inspection-snapshot"])
      expect(calls).toBe(0)
    }))

  it("verifies the retained package manifest and inspection-root identity before and after spawn", async () =>
    withFixture(async (fixture) => {
      await writeFile(fixture.packageManifestPath, '{"name":"hostile-pre-spawn"}\n')
      const pre = await execute(fixture, service(Effect.succeed(success())))
      expect(pre.processAttempt._tag).toBe("NotStarted")
      expect(pre.failureIds).toEqual(["gate.command-package-manifest-preverification"])
    }).then(() => withFixture(async (fixture) => {
      const postManifest = await execute(fixture, {
        run: () => Effect.promise(async () => {
          await writeFile(fixture.packageManifestPath, '{"name":"hostile-post-spawn"}\n')
          return success()
        })
      })
      expect(postManifest.processAttempt._tag).toBe("Exited")
      expect(postManifest.failureIds).toEqual([
        "gate.command-package-manifest-postverification"
      ])
    })).then(() => withFixture(async (fixture) => {
      const postInspection = await execute(fixture, {
        run: () => Effect.promise(async () => {
          await writeFile(join(fixture.inspectionRoot, "mutation"), "changed\n")
          return success()
        })
      })
      expect(postInspection.processAttempt._tag).toBe("Exited")
      expect(postInspection.failureIds).toEqual([
        "gate.command-inspection-postverification"
      ])
    })))

  it("rejects preflight and post-start runner source or TypeScript config drift", async () =>
    withFixture(async (fixture) => {
      await writeFile(join(fixture.runnerSourceRoot, "gate.ts"), "export const drift = true\n")
      const result = await execute(fixture, service(Effect.succeed(success())))
      expect(result.processAttempt._tag).toBe("NotStarted")
      expect(result.failureIds).toEqual(["gate.command-runner-source-preverification"])
    }).then(() => withFixture(async (fixture) => {
      await writeFile(fixture.typescriptConfigPath, '{"compilerOptions":{"strict":false}}\n')
      const result = await execute(fixture, service(Effect.succeed(success())))
      expect(result.processAttempt._tag).toBe("NotStarted")
      expect(result.failureIds).toEqual(["gate.command-typescript-config-preverification"])
    })).then(() => withFixture(async (fixture) => {
      const result = await execute(fixture, {
        run: () => Effect.promise(async () => {
          await writeFile(
            join(fixture.runnerSourceRoot, "gate.ts"),
            "export const postStartDrift = true\n"
          )
          return success()
        })
      })
      expect(result.processAttempt._tag).toBe("Exited")
      expect(result.failureIds).toEqual(["gate.command-runner-source-postverification"])
    })).then(() => withFixture(async (fixture) => {
      const result = await execute(fixture, {
        run: () => Effect.promise(async () => {
          await writeFile(
            fixture.typescriptConfigPath,
            '{"compilerOptions":{"strict":false}}\n'
          )
          return success()
        })
      })
      expect(result.processAttempt._tag).toBe("Exited")
      expect(result.failureIds).toEqual(["gate.command-typescript-config-postverification"])
    })))

  it("preserves timeout, signal, output-limit, I/O, and spawn transcript dispositions", async () =>
    withFixture(async (fixture) => {
      const complete = makeTrialProcessStreamCapture("Complete", empty)
      const prefix = makeTrialProcessStreamCapture("Prefix", new TextEncoder().encode("partial"))
      const oversized = new Uint8Array(TRIAL_PROCESS_OUTPUT_LIMIT_BYTES + 1)
      const cases = [
        [
          new TrialProcessTimeoutError(30_000, prefix, complete),
          "TimedOut"
        ],
        [
          new TrialProcessSignalError("SIGKILL", prefix, complete),
          "Signaled"
        ],
        [
          new TrialProcessOutputLimitError(
            "stdout",
            oversized.byteLength,
            makeTrialProcessStreamCapture("Prefix", oversized),
            complete
          ),
          "OutputLimited"
        ],
        [
          new TrialProcessIoError("stdout", "read failure", prefix, complete),
          "IoFailed"
        ],
        [
          new TrialProcessSpawnError(fixture.bunPath, "spawn failure"),
          "NotStarted"
        ]
      ] as const

      for (const [error, expectedTag] of cases) {
        const result = await execute(fixture, service(Effect.fail(error)))
        expect(result.processAttempt._tag).toBe(expectedTag)
        expect(result.failureIds).toEqual(["gate.command-process-failure"])
        if (expectedTag === "Signaled" && result.processAttempt._tag === "Signaled") {
          expect(result.processAttempt.stdout._tag).toBe("Prefix")
          expect(result.processAttempt.stdout).toMatchObject({
            byteLength: prefix.byteLength,
            sha256: prefix.sha256
          })
        }
      }
    }))
})

const expectedDigest = sha256Bytes(bunBytes)
