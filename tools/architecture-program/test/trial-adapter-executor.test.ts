import { cp, existsSync } from "node:fs"
import { Buffer } from "node:buffer"
import {
  mkdir,
  mkdtemp,
  link,
  readFile,
  readdir,
  rm,
  chmod,
  symlink,
  unlink,
  writeFile
} from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "../src/canonical-document.js"
import {
  decodeCandidateManifest,
  encodeCandidateManifest
} from "../src/schema/candidate-manifest.js"
import { ArtifactId } from "../src/schema/primitives.js"
import { makeTrialRunContext } from "../src/schema/run-context.js"
import {
  CompleteProcessStreamEvidence,
  ExitedProcessAttempt
} from "../src/schema/trial-result.js"
import {
  BooleanEvidenceValueV2,
  EvidenceEntryV2,
  EvidenceName
} from "../src/schema/trial-evidence.js"
import {
  decodeArchitectureTrialSpec,
  encodeArchitectureTrialSpec,
  gateDefinitionSha256,
  type ArchitectureTrialSpecV2
} from "../src/schema/trial-spec.js"
import {
  AcceptedGateEvaluation,
  AcceptedProbeEvaluation,
  RejectedProbeEvaluation,
  TrialAdapterExecutor,
  makeTrialAdapterExecutor as makeTrialAdapterExecutorRaw,
  makeTrialAdapterExecutorLayer,
  type GateEvaluator,
  type GateCommandExecutor,
  type PreparedTrialAdapterContext,
  type ProbeEvaluator
} from "../src/trial-adapter-executor.js"
import {
  TrialCandidateSandboxError,
  makeTrialCandidateSandbox,
  type TrialCandidateSandboxService
} from "../src/trial-candidate-sandbox.js"
import { sha256Bytes } from "../src/trial-hash.js"
import {
  inventoryCandidateTree,
  type TrialGitNumstatService
} from "../src/trial-inventory.js"
import {
  TrialIsolationEstablishmentError,
  TrialIsolationPostcheckError,
  TrialIsolationUnavailableError,
  type TrialIsolatedProcessRequest,
  type TrialIsolatedProcessService
} from "../src/trial-isolated-process.js"
import {
  TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
  TrialProcessIoError,
  TrialProcessOutputLimitError,
  TrialProcessSignalError,
  TrialProcessTimeoutError,
  makeTrialProcessStreamCapture,
  type TrialProcessResult
} from "../src/trial-process.js"

const encoder = new TextEncoder()
const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/refactor/architecture-program/inputs/trial-spec.json"
)
const zeroDigest = "0".repeat(64)
const plain = <A>(value: A): A => JSON.parse(JSON.stringify(value)) as A
const testGitNumstat: TrialGitNumstatService = {
  measure: () => Effect.succeed({ _tag: "Text", additions: 1, deletions: 0 })
}
const emptyCompleteStream = new CompleteProcessStreamEvidence({
  byteLength: 0,
  sha256: sha256Bytes(new Uint8Array())
})
const testGateCommandExecutor: GateCommandExecutor = {
  execute: ({ gate }) => Effect.succeed({
    processAttempt: new ExitedProcessAttempt({
      exitCode: gate.expectedExit,
      stdout: emptyCompleteStream,
      stderr: emptyCompleteStream
    }),
    failureIds: []
  })
}
const makeTrialAdapterExecutor: typeof makeTrialAdapterExecutorRaw = (context, options = {}) =>
  makeTrialAdapterExecutorRaw(context, {
    gitNumstat: testGitNumstat,
    gateCommandExecutor: testGateCommandExecutor,
    ...options
  })

const runnerEvaluationFact = () => new EvidenceEntryV2({
  sequence: 1,
  name: EvidenceName.make("runner.evaluation.accepted"),
  value: new BooleanEvidenceValueV2({ value: true })
})

const productFile = (path: string, ownerRoleIds = ["role.changed-owner"]) => ({
  path,
  laneId: "product-source" as const,
  moduleId: "module.candidate",
  packageId: "package.candidate",
  ownerRoleIds,
  conceptIds: ["concept.candidate"],
  centralBranchIds: ["branch.candidate"]
})

const toolingFile = (path: string) => ({
  path,
  laneId: "tooling" as const,
  moduleId: null,
  packageId: null,
  ownerRoleIds: [],
  conceptIds: [],
  centralBranchIds: []
})

const manifestDocument = () => ({
  schemaVersion: "ts-release/architecture-candidate-manifest/v2",
  candidateId: "T1-root",
  scope: "topology",
  model: "root",
  implementationRoot: "prototypes/research-complete-topology/T1-root",
  files: [
    productFile("src/index.ts"),
    toolingFile("trial-adapter.ts"),
    toolingFile("trial-candidate.json")
  ],
  publicSurfaceIds: ["public.candidate"],
  durableFormatIds: ["format.candidate"],
  dependencyEdges: []
})

interface Fixture {
  readonly outer: string
  readonly candidateRoot: string
  readonly context: PreparedTrialAdapterContext
  readonly sandboxRoots: Array<string>
  readonly sandbox: TrialCandidateSandboxService
}

const loadSpec = Effect.fn("trialAdapterExecutorTest.loadSpec")(function* () {
  const bytes = yield* Effect.promise(() => readFile(fixturePath))
  return yield* decodeArchitectureTrialSpec(parseCanonicalJsonBytes(bytes))
})

const makeFixture = async (): Promise<Fixture> => {
  const outer = await mkdtemp("/tmp/trial-adapter-executor-test-")
  const candidateRoot = join(outer, "candidate")
  await mkdir(join(candidateRoot, "src"), { recursive: true })
  const manifest = await Effect.runPromise(decodeCandidateManifest(manifestDocument()))
  await writeFile(join(candidateRoot, "src/index.ts"), "export const candidate = true\n")
  await writeFile(join(candidateRoot, "trial-adapter.ts"), "export const adapter = true\n")
  await writeFile(
    join(candidateRoot, "trial-candidate.json"),
    canonicalJsonBytes(encodeCandidateManifest(manifest))
  )
  const spec = await Effect.runPromise(loadSpec())
  const originalCandidateTree = await Effect.runPromise(inventoryCandidateTree(candidateRoot, manifest))
  const topologyGates = spec.gateRequirements.filter(({ scope }) => scope === "topology")
  const runContext = makeTrialRunContext({
    schemaVersion: "ts-release/architecture-trial-run-context/v2",
    trialSpecSha256: sha256Bytes(canonicalJsonBytes(encodeArchitectureTrialSpec(spec))),
    executionContractSha256: spec.executionContract.contractSha256,
    measurementContractSha256: spec.measurementContract.contractSha256,
    topologyFixtureSha256: spec.topologyFixture.fixtureSha256,
    candidateId: manifest.candidateId,
    candidateScope: manifest.scope,
    candidateModel: manifest.model,
    implementationRoot: manifest.implementationRoot,
    candidateManifestSha256: sha256Bytes(canonicalJsonBytes(encodeCandidateManifest(manifest))),
    candidateTreeSha256: originalCandidateTree.treeSha256,
    runnerSourceSha256: zeroDigest,
    runnerNodeModulesSha256: zeroDigest,
    toolchain: {
      bun: "1.3.14",
      bunExecutableSha256: zeroDigest,
      typescript: "6.0.3",
      effect: "4.0.0-rc.108",
      git: "2.51.0",
      gitExecutableSha256: zeroDigest,
      bubblewrapVersion: "0.9.0",
      bubblewrapExecutableSha256: zeroDigest
    },
    caseDefinitionBindings: spec.machineCases.map(({ id: caseId, execution }) => ({
      caseId,
      definitionSha256: execution.definitionSha256,
      fixtureSha256: execution.fixtureSha256,
      expectedEvidenceSha256: execution.expectedEvidenceSha256
    })),
    probeDefinitionBindings: spec.marginalProbes.map(({ id: probeId, execution }) => ({
      probeId,
      definitionSha256: execution.definitionSha256,
      baseFixtureSha256: execution.baseFixtureSha256,
      changeDefinitionSha256: execution.changeDefinitionSha256
    })),
    gateDefinitionBindings: topologyGates.map((gate) => ({
      gateId: gate.id,
      definitionSha256: gateDefinitionSha256(gate)
    }))
  })
  const sandboxRoots: Array<string> = []
  const sandbox: TrialCandidateSandboxService = {
    create: ({ candidateRoot: source }) => Effect.acquireRelease(
      Effect.promise(async () => {
        const root = await mkdtemp(join(outer, "sandbox-"))
        await new Promise<void>((resolveCopy, rejectCopy) => cp(
          source,
          root,
          { recursive: true },
          (error) => error === null ? resolveCopy() : rejectCopy(error)
        ))
        sandboxRoots.push(root)
        return { root }
      }),
      ({ root }) => Effect.promise(() => rm(root, { recursive: true, force: true }))
    )
  }
  return {
    outer,
    candidateRoot,
    context: { spec, manifest, originalCandidateRoot: candidateRoot, originalCandidateTree, runContext },
    sandboxRoots,
    sandbox
  }
}

const withFixture = async <A>(use: (fixture: Fixture) => Promise<A>): Promise<A> => {
  const fixture = await makeFixture()
  try {
    return await use(fixture)
  } finally {
    await rm(fixture.outer, { recursive: true, force: true })
  }
}

const caseResult = (
  spec: ArchitectureTrialSpecV2,
  request: TrialIsolatedProcessRequest,
  overrides: Record<string, unknown> = {}
): TrialProcessResult => {
  const invocation = parseCanonicalJsonBytes(request.stdin) as Record<string, unknown>
  const machineCase = spec.machineCases.find(({ id }) => id === invocation.caseId)!
  return {
    exitCode: 0,
    stdout: canonicalJsonBytes({
      schemaVersion: "architecture-case-observation-v2",
      runContextSha256: invocation.runContextSha256,
      candidateId: invocation.candidateId,
      candidateTreeSha256: invocation.candidateTreeSha256,
      definitionSha256: invocation.definitionSha256,
      caseId: invocation.caseId,
      fixtureSha256: invocation.fixtureSha256,
      trace: plain(machineCase.expectedEvidence.trace),
      facts: plain(machineCase.expectedEvidence.facts),
      terminalOutcome: machineCase.expectedEvidence.terminalOutcome,
      ...overrides
    }),
    stderr: new Uint8Array()
  }
}

const probeResult = async (
  fixture: Fixture,
  request: TrialIsolatedProcessRequest,
  options: {
    readonly ownerRoleIds?: ReadonlyArray<string>
    readonly malformedManifest?: boolean
    readonly afterManifestSymlinkTarget?: string
    readonly observationOverrides?: Record<string, unknown>
  } = {}
): Promise<TrialProcessResult> => {
  const invocation = parseCanonicalJsonBytes(request.stdin) as Record<string, any>
  const probe = fixture.context.spec.marginalProbes.find(({ id }) => id === invocation.probeId)!
  const changedPath = "src/probe.ts"
  await writeFile(join(request.candidateRoot, changedPath), "export const probe = true\n")
  const afterDocument = {
    ...manifestDocument(),
    files: [
      productFile("src/index.ts"),
      productFile(changedPath, [...(options.ownerRoleIds ?? ["role.changed-owner"])]),
      toolingFile("trial-adapter.ts"),
      toolingFile("trial-candidate.json")
    ]
  }
  if (options.afterManifestSymlinkTarget !== undefined) {
    await unlink(join(request.candidateRoot, "trial-candidate.json"))
    await symlink(
      options.afterManifestSymlinkTarget,
      join(request.candidateRoot, "trial-candidate.json")
    )
  } else if (options.malformedManifest) {
    await writeFile(join(request.candidateRoot, "trial-candidate.json"), "{ }\n")
  } else {
    const afterManifest = await Effect.runPromise(decodeCandidateManifest(afterDocument))
    await writeFile(
      join(request.candidateRoot, "trial-candidate.json"),
      canonicalJsonBytes(encodeCandidateManifest(afterManifest))
    )
  }
  const factNames = probe.requiredChangeKinds.map((kind) => `change-kind.${kind}.path`).sort()
  return {
    exitCode: 0,
    stdout: canonicalJsonBytes({
      schemaVersion: "architecture-probe-observation-v2",
      runContextSha256: invocation.runContextSha256,
      candidateId: invocation.candidateId,
      candidateTreeSha256: invocation.candidateTreeSha256,
      definitionSha256: invocation.definitionSha256,
      probeId: invocation.probeId,
      baseFixtureSha256: invocation.baseFixtureSha256,
      changeDefinitionSha256: invocation.changeDefinitionSha256,
      changeId: invocation.changeDefinition.changeId,
      facts: factNames.length === 0
        ? [{ sequence: 1, name: "change.observed-path", value: { _tag: "Text", value: changedPath } }]
        : factNames.map((name, index) => ({
          sequence: index + 1,
          name,
          value: { _tag: "Text", value: changedPath }
        })),
      ...options.observationOverrides
    }),
    stderr: new Uint8Array()
  }
}

const gateResult = (
  request: TrialIsolatedProcessRequest,
  overrides: Record<string, unknown> = {}
): TrialProcessResult => {
  const invocation = parseCanonicalJsonBytes(request.stdin) as Record<string, unknown>
  return {
    exitCode: 0,
    stdout: canonicalJsonBytes({
      schemaVersion: "architecture-gate-observation-v2",
      runContextSha256: invocation.runContextSha256,
      candidateId: invocation.candidateId,
      candidateTreeSha256: invocation.candidateTreeSha256,
      definitionSha256: invocation.definitionSha256,
      gateId: invocation.gateId,
      facts: [{
        sequence: 1,
        name: "gate.observed-artifact-count",
        value: { _tag: "Integer", value: 1 }
      }],
      ...overrides
    }),
    stderr: new Uint8Array()
  }
}

const acceptedProbeEvaluator = (onEvaluate?: (root: string) => void): ProbeEvaluator => ({
  evaluatorId: ArtifactId.make("probe-evaluator.test-accepted-v1"),
  evaluate: ({ inspectionRoot }) => Effect.sync(() => {
    onEvaluate?.(inspectionRoot)
    return new AcceptedProbeEvaluation({ facts: [runnerEvaluationFact()] })
  })
})

const acceptedGateEvaluator = (onEvaluate?: (root: string) => void): GateEvaluator => ({
  evaluatorId: ArtifactId.make("gate-evaluator.test-accepted-v1"),
  evaluate: ({ inspectionRoot }) => Effect.sync(() => {
    onEvaluate?.(inspectionRoot)
    return new AcceptedGateEvaluation({ facts: [runnerEvaluationFact()] })
  })
})

describe("TrialAdapterExecutor", () => {
  it("builds a runner-owned passed case receipt through the direct and Layer service APIs", async () =>
    withFixture(async (fixture) => {
      const requests: Array<TrialIsolatedProcessRequest> = []
      const isolatedProcess: TrialIsolatedProcessService = {
        run: (request) => {
          requests.push(request)
          return Effect.succeed(caseResult(fixture.context.spec, request))
        }
      }
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess
      })
      const receipt = await Effect.runPromise(executor.executeCase("C01-initial-success"))
      expect(receipt.execution._tag).toBe("Passed")
      if (receipt.execution._tag === "Passed") {
        const expectedResult = caseResult(fixture.context.spec, requests[0]!)
        expect(receipt.execution.processAttempt.exitCode).toBe(0)
        expect(receipt.execution.processAttempt.stdout).toEqual({
          _tag: "Complete",
          byteLength: expectedResult.stdout.byteLength,
          sha256: sha256Bytes(expectedResult.stdout)
        })
        expect(receipt.execution.processAttempt.stderr).toEqual({
          _tag: "Complete",
          byteLength: expectedResult.stderr.byteLength,
          sha256: sha256Bytes(expectedResult.stderr)
        })
        expect(receipt.execution.terminalOutput.observedAssertionIds).toEqual(
          [...fixture.context.spec.machineCases[0]!.execution.assertionIds].sort()
        )
        expect(receipt.execution.terminalOutput.resultSha256).toMatch(/^[0-9a-f]{64}$/u)
      }
      expect(requests[0]!.adapterArgv).toEqual(["bun", "run", "trial-adapter.ts", "case"])
      expect(requests[0]!.expectedToolchain).toEqual({
        bunVersion: "1.3.14",
        bunExecutableSha256: zeroDigest,
        bubblewrapVersion: "0.9.0",
        bubblewrapExecutableSha256: zeroDigest,
        runnerNodeModulesSha256: zeroDigest
      })

      const layerReceipt = await Effect.runPromise(Effect.gen(function* () {
        const service = yield* TrialAdapterExecutor
        return yield* service.executeCase("C01-initial-success")
      }).pipe(Effect.provide(makeTrialAdapterExecutorLayer(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess
      }))))
      expect(layerReceipt.execution._tag).toBe("Passed")
      expect(fixture.sandboxRoots).toHaveLength(2)
      expect(fixture.sandboxRoots.every((root) => !existsSync(root))).toBe(true)
    }))

  it("maps pre-start, post-start isolation, and interrupted failures with exact stream evidence", async () =>
    withFixture(async (fixture) => {
      const establishmentStdout = encoder.encode("bubblewrap stdout\n")
      const establishmentStderr = encoder.encode("bwrap: namespace failed\n")
      const postcheckStdout = encoder.encode("adapter completed before postcheck failure\n")
      const postcheckStderr = encoder.encode("adapter diagnostic\n")
      const timeoutStdout = encoder.encode("partial timeout stdout\n")
      const timeoutStderr = encoder.encode("complete timeout stderr\n")
      const signalStdout = encoder.encode("complete signal stdout\n")
      const signalStderr = encoder.encode("complete signal stderr\n")
      const ioStdout = encoder.encode("partial I/O stdout\n")
      const ioStderr = encoder.encode("complete I/O stderr\n")
      const limitedStdout = new Uint8Array(TRIAL_PROCESS_OUTPUT_LIMIT_BYTES + 1).fill(0x61)
      const empty = new Uint8Array()
      const scenarios = [
        {
          error: new TrialIsolationUnavailableError("missing bwrap"),
          attemptTag: "NotStarted",
          failureId: "adapter.isolation-unavailable",
          streams: null
        },
        {
          error: new TrialIsolationEstablishmentError(
            "namespace failed",
            new ExitedProcessAttempt({
              exitCode: 125,
              stdout: new CompleteProcessStreamEvidence({
                byteLength: establishmentStdout.byteLength,
                sha256: sha256Bytes(establishmentStdout)
              }),
              stderr: new CompleteProcessStreamEvidence({
                byteLength: establishmentStderr.byteLength,
                sha256: sha256Bytes(establishmentStderr)
              })
            })
          ),
          attemptTag: "Exited",
          failureId: "adapter.isolation-establishment",
          streams: {
            stdout: ["Complete", establishmentStdout],
            stderr: ["Complete", establishmentStderr]
          }
        },
        {
          error: new TrialIsolationPostcheckError(
            "snapshot changed",
            new ExitedProcessAttempt({
              exitCode: 0,
              stdout: new CompleteProcessStreamEvidence({
                byteLength: postcheckStdout.byteLength,
                sha256: sha256Bytes(postcheckStdout)
              }),
              stderr: new CompleteProcessStreamEvidence({
                byteLength: postcheckStderr.byteLength,
                sha256: sha256Bytes(postcheckStderr)
              })
            })
          ),
          attemptTag: "Exited",
          failureId: "adapter.isolation-postcheck",
          streams: {
            stdout: ["Complete", postcheckStdout],
            stderr: ["Complete", postcheckStderr]
          }
        },
        {
          error: new TrialProcessIoError(
            "stdout",
            "synthetic read failure",
            makeTrialProcessStreamCapture("Prefix", ioStdout),
            makeTrialProcessStreamCapture("Complete", ioStderr)
          ),
          attemptTag: "IoFailed",
          failureId: "adapter.process-io",
          streams: { stdout: ["Prefix", ioStdout], stderr: ["Complete", ioStderr] }
        },
        {
          error: new TrialProcessTimeoutError(
            30_000,
            makeTrialProcessStreamCapture("Prefix", timeoutStdout),
            makeTrialProcessStreamCapture("Complete", timeoutStderr)
          ),
          attemptTag: "TimedOut",
          failureId: "adapter.timeout",
          streams: { stdout: ["Prefix", timeoutStdout], stderr: ["Complete", timeoutStderr] }
        },
        {
          error: new TrialProcessSignalError(
            "SIGKILL",
            makeTrialProcessStreamCapture("Prefix", signalStdout),
            makeTrialProcessStreamCapture("Complete", signalStderr)
          ),
          attemptTag: "Signaled",
          failureId: "adapter.signal",
          streams: { stdout: ["Prefix", signalStdout], stderr: ["Complete", signalStderr] }
        },
        {
          error: new TrialProcessOutputLimitError(
            "stdout",
            limitedStdout.byteLength,
            makeTrialProcessStreamCapture("Prefix", limitedStdout),
            makeTrialProcessStreamCapture("Prefix", empty)
          ),
          attemptTag: "OutputLimited",
          failureId: "adapter.output-limit",
          streams: { stdout: ["Prefix", limitedStdout], stderr: ["Prefix", empty] }
        }
      ] as const
      for (const { error, attemptTag, failureId, streams } of scenarios) {
        const executor = makeTrialAdapterExecutor(fixture.context, {
          sandbox: fixture.sandbox,
          isolatedProcess: { run: () => Effect.fail(error) }
        })
        const receipt = await Effect.runPromise(executor.executeCase("C01-initial-success"))
        expect(receipt.execution._tag).toBe("Failed")
        if (receipt.execution._tag === "Failed") {
          expect(receipt.execution.processAttempt._tag).toBe(attemptTag)
          expect(receipt.execution.failureIds).toContain(failureId)
          expect(receipt.execution.terminalOutput).toBeNull()
          expect(receipt.execution.invocationSha256).toMatch(/^[0-9a-f]{64}$/u)
          if (streams === null) {
            expect(receipt.execution.processAttempt).not.toHaveProperty("stdout")
            expect(receipt.execution.processAttempt).not.toHaveProperty("stderr")
          } else if ("stdout" in receipt.execution.processAttempt) {
            for (const stream of ["stdout", "stderr"] as const) {
              const [completeness, bytes] = streams[stream]
              expect(receipt.execution.processAttempt[stream]).toEqual({
                _tag: completeness,
                byteLength: bytes.byteLength,
                sha256: sha256Bytes(bytes)
              })
            }
          }
        }
      }
    }))

  it("fails closed when the live executor has no preflight-bound isolation authority", async () =>
    withFixture(async (fixture) => {
      const executor = makeTrialAdapterExecutor(fixture.context, { sandbox: fixture.sandbox })
      const receipt = await Effect.runPromise(executor.executeCase("C01-initial-success"))
      expect(receipt.execution._tag).toBe("Failed")
      if (receipt.execution._tag === "Failed") {
        expect(receipt.execution.processAttempt._tag).toBe("NotStarted")
        expect(receipt.execution.failureIds).toContain("adapter.isolation-unavailable")
        expect(receipt.execution.terminalOutput).toBeNull()
      }
    }))

  it("keeps nonzero, stderr, protocol, candidate claims, and semantic mismatch distinct", async () =>
    withFixture(async (fixture) => {
      const outputs: ReadonlyArray<{
        readonly result: (request: TrialIsolatedProcessRequest) => TrialProcessResult
        readonly failureId: string
        readonly outcome: string
        readonly hasTerminal: boolean
      }> = [
        {
          result: (request) => ({ ...caseResult(fixture.context.spec, request), exitCode: 7 }),
          failureId: "adapter.nonzero-exit",
          outcome: "Exited",
          hasTerminal: true
        },
        {
          result: (request) => ({
            ...caseResult(fixture.context.spec, request),
            stderr: encoder.encode("candidate warning\n")
          }),
          failureId: "adapter.stderr-nonempty",
          outcome: "Exited",
          hasTerminal: true
        },
        {
          result: (request) => caseResult(fixture.context.spec, request, { status: "Passed" }),
          failureId: "adapter.protocol",
          outcome: "Exited",
          hasTerminal: false
        },
        {
          result: (request) => caseResult(fixture.context.spec, request, { terminalOutcome: "SafeStop" }),
          failureId: "case.evidence-mismatch",
          outcome: "Exited",
          hasTerminal: true
        }
      ]
      for (const scenario of outputs) {
        let emittedResult: TrialProcessResult | undefined
        const executor = makeTrialAdapterExecutor(fixture.context, {
          sandbox: fixture.sandbox,
          isolatedProcess: {
            run: (request) => {
              emittedResult = scenario.result(request)
              return Effect.succeed(emittedResult)
            }
          }
        })
        const receipt = await Effect.runPromise(executor.executeCase("C01-initial-success"))
        expect(receipt.execution._tag).toBe("Failed")
        if (receipt.execution._tag === "Failed") {
          expect(receipt.execution.failureIds).toContain(scenario.failureId)
          expect(receipt.execution.processAttempt._tag).toBe(scenario.outcome)
          expect(receipt.execution.terminalOutput === null).toBe(!scenario.hasTerminal)
          expect(emittedResult).toBeDefined()
          if (receipt.execution.processAttempt._tag === "Exited" && emittedResult !== undefined) {
            expect(receipt.execution.processAttempt.stdout).toEqual({
              _tag: "Complete",
              byteLength: emittedResult.stdout.byteLength,
              sha256: sha256Bytes(emittedResult.stdout)
            })
            expect(receipt.execution.processAttempt.stderr).toEqual({
              _tag: "Complete",
              byteLength: emittedResult.stderr.byteLength,
              sha256: sha256Bytes(emittedResult.stderr)
            })
          }
        }
      }
    }))

  it("measures all 13 probe facts while the fresh root is live, then cleans it", async () =>
    withFixture(async (fixture) => {
      let evaluatedRoot = ""
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: {
          run: (request) => Effect.promise(() => probeResult(fixture, request))
        },
        probeEvaluator: acceptedProbeEvaluator((root) => {
          evaluatedRoot = root
          expect(existsSync(join(root, "src/probe.ts"))).toBe(true)
        })
      })
      const receipt = await Effect.runPromise(executor.executeProbe("P02-packed-external-provider"))
      expect(receipt.execution._tag).toBe("Passed")
      if (receipt.execution._tag === "Passed") {
        expect(receipt.execution.terminalOutput.measurements).toHaveLength(13)
        expect(receipt.execution.terminalOutput.measurements.every(
          ({ _tag }) => _tag === "Measured"
        )).toBe(true)
        expect(receipt.execution.terminalOutput.changeKinds).toEqual([
          "ordinary-import-and-layer",
          "packed-consumer"
        ])
        expect(receipt.execution.terminalOutput.facts.map(({ name }) => name)).toEqual([
          "change-kind.ordinary-import-and-layer.path",
          "change-kind.packed-consumer.path"
        ])
        expect(receipt.execution.terminalOutput.touchedOwnerRoleIds).not.toContain("role-kernel")
        expect(receipt.execution.terminalOutput.evaluationRecord).toMatchObject({
          evaluatorId: "probe-evaluator.test-accepted-v1",
          probeId: "P02-packed-external-provider",
          inspectedTreeSha256: receipt.execution.terminalOutput.afterTreeSha256,
          disposition: { _tag: "Accepted" }
        })
      }
      expect(evaluatedRoot).not.toBe("")
      expect(evaluatedRoot).not.toBe(fixture.sandboxRoots[0])
      expect(existsSync(evaluatedRoot)).toBe(false)
    }))

  it("never lets syntactically bound candidate change-kind facts replace runner evaluation", async () =>
    withFixture(async (fixture) => {
      const denied = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: { run: (request) => Effect.promise(() => probeResult(fixture, request)) }
      })
      const deniedReceipt = await Effect.runPromise(
        denied.executeProbe("P02-packed-external-provider")
      )
      expect(deniedReceipt.execution._tag).toBe("Failed")
      if (deniedReceipt.execution._tag === "Failed") {
        expect(deniedReceipt.execution.failureIds).toContain("probe.runner-evaluator-missing")
      }

      const hostileEvaluator: ProbeEvaluator = {
        evaluatorId: ArtifactId.make("probe-evaluator.test-rejected-v1"),
        evaluate: () => Effect.succeed(new RejectedProbeEvaluation({
          failureIds: [ArtifactId.make("probe.semantic-proof-rejected")]
        }))
      }
      const rejected = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: { run: (request) => Effect.promise(() => probeResult(fixture, request)) },
        probeEvaluator: hostileEvaluator
      })
      const rejectedReceipt = await Effect.runPromise(
        rejected.executeProbe("P02-packed-external-provider")
      )
      expect(rejectedReceipt.execution._tag).toBe("Failed")
      if (rejectedReceipt.execution._tag === "Failed") {
        expect(rejectedReceipt.execution.failureIds).toContain("probe.semantic-proof-rejected")
      }

      const malformedFacts = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: { run: (request) => Effect.promise(() => probeResult(fixture, request)) },
        probeEvaluator: {
          evaluatorId: ArtifactId.make("probe-evaluator.test-malformed-facts-v1"),
          evaluate: () => Effect.succeed(new AcceptedProbeEvaluation({
            facts: [new EvidenceEntryV2({
              sequence: 2,
              name: EvidenceName.make("runner.evaluation.accepted"),
              value: new BooleanEvidenceValueV2({ value: true })
            })]
          }))
        }
      })
      const malformedReceipt = await Effect.runPromise(
        malformedFacts.executeProbe("P02-packed-external-provider")
      )
      expect(malformedReceipt.execution._tag).toBe("Failed")
      if (malformedReceipt.execution._tag === "Failed") {
        expect(malformedReceipt.execution.failureIds).toContain("probe.runner-evaluator-facts")
        expect(malformedReceipt.execution.terminalOutput?.evaluationRecord?.disposition._tag)
          .toBe("Rejected")
      }
    }))

  it("rejects zero-touch violations, malformed after manifests, and candidate-authored probe status", async () =>
    withFixture(async (fixture) => {
      const scenarios = [
        {
          result: (request: TrialIsolatedProcessRequest) => probeResult(fixture, request, {
            ownerRoleIds: ["role-kernel"]
          }),
          failureId: "probe.zero-touch-violation"
        },
        {
          result: (request: TrialIsolatedProcessRequest) => probeResult(fixture, request, {
            malformedManifest: true
          }),
          failureId: "probe.after-manifest-canonical"
        },
        {
          result: (request: TrialIsolatedProcessRequest) => probeResult(fixture, request, {
            observationOverrides: { changeApplied: true }
          }),
          failureId: "adapter.protocol"
        }
      ] as const
      for (const scenario of scenarios) {
        const executor = makeTrialAdapterExecutor(fixture.context, {
          sandbox: fixture.sandbox,
          isolatedProcess: { run: (request) => Effect.promise(() => scenario.result(request)) },
          probeEvaluator: acceptedProbeEvaluator()
        })
        const receipt = await Effect.runPromise(
          executor.executeProbe("P02-packed-external-provider")
        )
        expect(receipt.execution._tag).toBe("Failed")
        if (receipt.execution._tag === "Failed") {
          expect(receipt.execution.failureIds).toContain(scenario.failureId)
        }
      }
    }))

  it("never follows a candidate-replaced after manifest into a host file or device", async () =>
    withFixture(async (fixture) => {
      const hostFile = join(fixture.outer, "host-secret")
      await writeFile(hostFile, "runner-host-secret\n")
      for (const target of [hostFile, "/dev/zero"]) {
        let evaluatorCalls = 0
        const executor = makeTrialAdapterExecutor(fixture.context, {
          sandbox: fixture.sandbox,
          isolatedProcess: {
            run: (request) => Effect.promise(() => probeResult(fixture, request, {
              afterManifestSymlinkTarget: target
            }))
          },
          probeEvaluator: acceptedProbeEvaluator(() => {
            evaluatorCalls += 1
          })
        })
        const receipt = await Effect.runPromise(
          executor.executeProbe("P02-packed-external-provider")
        )
        expect(receipt.execution._tag).toBe("Failed")
        if (receipt.execution._tag === "Failed") {
          expect(receipt.execution.failureIds).toContain("probe.after-manifest-file")
          expect(receipt.execution.terminalOutput).toBeNull()
        }
        expect(evaluatorCalls).toBe(0)
      }
      expect(await readFile(hostFile, "utf8")).toBe("runner-host-secret\n")
    }))

  it("distinguishes the candidate gate adapter from the exact runner-owned gate command", async () =>
    withFixture(async (fixture) => {
      const gateId = "GT08-exact-runtime-declaration-surface"
      const gate = fixture.context.spec.gateRequirements.find(({ id }) => id === gateId)!
      let evaluatedRoot = ""
      let commandInspectionRoot = ""
      let gateCommandCalls = 0
      const commandStdout = encoder.encode("runner-owned gate command\n")
      const adapterRequests: Array<TrialIsolatedProcessRequest> = []
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: {
          run: (request) => {
            adapterRequests.push(request)
            return Effect.succeed(gateResult(request))
          }
        },
        gateEvaluator: acceptedGateEvaluator((root) => {
          evaluatedRoot = root
          expect(existsSync(join(root, "trial-candidate.json"))).toBe(true)
        }),
        gateCommandExecutor: {
          execute: (request) => Effect.sync(() => {
            gateCommandCalls += 1
            expect(request.gate.command).toEqual(gate.command)
            expect(request.commandInput.invocation.gateId).toBe(gateId)
            expect(request.commandInput.invocation.runContextSha256).toBe(
              fixture.context.runContext.runContextSha256
            )
            expect(request.commandInput.inspectedTreeSha256).toBe(
              fixture.context.originalCandidateTree.treeSha256
            )
            expect(request.inspectionRoot).not.toBeNull()
            commandInspectionRoot = request.inspectionRoot!
            return {
              processAttempt: new ExitedProcessAttempt({
                exitCode: request.gate.expectedExit,
                stdout: new CompleteProcessStreamEvidence({
                  byteLength: commandStdout.byteLength,
                  sha256: sha256Bytes(commandStdout)
                }),
                stderr: emptyCompleteStream
              }),
              failureIds: []
            }
          })
        }
      })
      const receipt = await Effect.runPromise(executor.executeGate(gateId, {
        caseReceipts: [],
        probeReceipts: []
      }))
      expect(receipt.execution._tag).toBe("Passed")
      expect(adapterRequests).toHaveLength(1)
      expect(gateCommandCalls).toBe(1)
      expect(adapterRequests[0]!.adapterArgv).toEqual(["bun", "run", "trial-adapter.ts", "gate"])
      expect(adapterRequests[0]!.adapterArgv).not.toEqual(gate.command)
      expect(evaluatedRoot).not.toBe("")
      expect(evaluatedRoot).toBe(commandInspectionRoot)
      expect(existsSync(evaluatedRoot)).toBe(false)
      if (receipt.execution._tag === "Passed") {
        const evaluation = receipt.execution.evaluationRecord
        expect(evaluation).toMatchObject({
          evaluatorId: "gate-evaluator.test-accepted-v1",
          gateId,
          declaredCommand: gate.command,
          commandAttempt: { _tag: "Exited", exitCode: gate.expectedExit },
          disposition: { _tag: "Accepted" }
        })
        expect(evaluation.commandAttempt).not.toEqual(receipt.execution.processAttempt)
      }

      const nonzeroCommand = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: { run: (request) => Effect.succeed(gateResult(request)) },
        gateEvaluator: acceptedGateEvaluator(),
        gateCommandExecutor: {
          execute: () => Effect.succeed({
            processAttempt: new ExitedProcessAttempt({
              exitCode: 9,
              stdout: emptyCompleteStream,
              stderr: emptyCompleteStream
            }),
            failureIds: []
          })
        }
      })
      const nonzeroReceipt = await Effect.runPromise(nonzeroCommand.executeGate(gateId, {
        caseReceipts: [],
        probeReceipts: []
      }))
      expect(nonzeroReceipt.execution._tag).toBe("Failed")
      if (nonzeroReceipt.execution._tag === "Failed") {
        expect(nonzeroReceipt.execution.failureIds).toContain("gate.command-unexpected-exit")
        expect(nonzeroReceipt.execution.evaluationRecord).toMatchObject({
          commandAttempt: { _tag: "Exited", exitCode: 9 },
          disposition: { _tag: "Rejected" }
        })
      }

      const denied = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: { run: (request) => Effect.succeed(gateResult(request)) }
      })
      const deniedReceipt = await Effect.runPromise(denied.executeGate(gateId, {
        caseReceipts: [],
        probeReceipts: []
      }))
      expect(deniedReceipt.execution._tag).toBe("Failed")
      if (deniedReceipt.execution._tag === "Failed") {
        expect(deniedReceipt.execution.failureIds).toContain("gate.runner-evaluator-missing")
      }
    }))

  it("preserves a valid gate-command attempt when a sibling executor field is malformed", async () =>
    withFixture(async (fixture) => {
      const gateId = "GT08-exact-runtime-declaration-surface"
      const commandStdout = encoder.encode("command spawned before malformed envelope\n")
      const processAttempt = new ExitedProcessAttempt({
        exitCode: 0,
        stdout: new CompleteProcessStreamEvidence({
          byteLength: commandStdout.byteLength,
          sha256: sha256Bytes(commandStdout)
        }),
        stderr: emptyCompleteStream
      })
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: { run: (request) => Effect.succeed(gateResult(request)) },
        gateEvaluator: acceptedGateEvaluator(),
        gateCommandExecutor: {
          execute: () => Effect.succeed({ processAttempt, failureIds: "malformed" })
        }
      })

      const receipt = await Effect.runPromise(executor.executeGate(gateId, {
        caseReceipts: [],
        probeReceipts: []
      }))
      expect(receipt.execution._tag).toBe("Failed")
      if (receipt.execution._tag === "Failed") {
        expect(receipt.execution.evaluationRecord.commandAttempt).toEqual(processAttempt)
        expect(receipt.execution.evaluationRecord.commandAttempt._tag).toBe("Exited")
        expect(receipt.execution.failureIds).toContain("gate.command-executor-schema")
      }
    }))

  it("defects without a receipt when malformed gate-command output has no valid attempt", async () =>
    withFixture(async (fixture) => {
      const gateId = "GT08-exact-runtime-declaration-surface"
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: { run: (request) => Effect.succeed(gateResult(request)) },
        gateEvaluator: acceptedGateEvaluator(),
        gateCommandExecutor: {
          execute: () => Effect.succeed({ failureIds: [] })
        }
      })

      const exit = await Effect.runPromise(executor.executeGate(gateId, {
        caseReceipts: [],
        probeReceipts: []
      }).pipe(Effect.exit))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(
          "malformed output without valid process-attempt evidence"
        )
      }
    }))

  it("attempts and receipts the same bound hard command when the candidate gate path fails", async () =>
    withFixture(async (fixture) => {
      const gateId = "GT08-exact-runtime-declaration-surface"
      const commandRoots: Array<string | null> = []
      const commandInputHashes: Array<string> = []
      let evaluatorCalls = 0
      const gateEvaluator = acceptedGateEvaluator(() => {
        evaluatorCalls += 1
      })
      const commandExecutor: GateCommandExecutor = {
        execute: (request) => Effect.sync(() => {
          commandRoots.push(request.inspectionRoot)
          return {
            processAttempt: new ExitedProcessAttempt({
              exitCode: request.gate.expectedExit,
              stdout: emptyCompleteStream,
              stderr: emptyCompleteStream
            }),
            failureIds: []
          }
        })
      }
      let sandboxCalls = 0
      const sessionFailureSandbox: TrialCandidateSandboxService = {
        create: (request) => {
          sandboxCalls += 1
          return sandboxCalls === 2
            ? Effect.fail(new TrialCandidateSandboxError(
                "allocate",
                request.candidateRoot,
                "candidate adapter sandbox unavailable"
              ))
            : fixture.sandbox.create(request)
        }
      }
      const scenarios = [
        makeTrialAdapterExecutor(fixture.context, {
          sandbox: sessionFailureSandbox,
          isolatedProcess: { run: (request) => Effect.succeed(gateResult(request)) },
          gateEvaluator,
          gateCommandExecutor: commandExecutor
        }),
        makeTrialAdapterExecutor(fixture.context, {
          sandbox: fixture.sandbox,
          isolatedProcess: {
            run: () => Effect.fail(new TrialIsolationUnavailableError("candidate bwrap unavailable"))
          },
          gateEvaluator,
          gateCommandExecutor: commandExecutor
        }),
        makeTrialAdapterExecutor(fixture.context, {
          sandbox: fixture.sandbox,
          isolatedProcess: {
            run: () => Effect.succeed({
              exitCode: 0,
              stdout: canonicalJsonBytes({ invalid: "candidate gate protocol" }),
              stderr: new Uint8Array()
            })
          },
          gateEvaluator,
          gateCommandExecutor: commandExecutor
        })
      ]
      for (const executor of scenarios) {
        const receipt = await Effect.runPromise(executor.executeGate(gateId, {
          caseReceipts: [],
          probeReceipts: []
        }))
        expect(receipt.execution._tag).toBe("Failed")
        if (receipt.execution._tag === "Failed") {
          expect(receipt.execution.evaluationRecord.commandAttempt).toMatchObject({
            _tag: "Exited",
            exitCode: 0
          })
          expect(receipt.execution.evaluationRecord.disposition).toMatchObject({
            _tag: "Rejected",
            failureIds: expect.arrayContaining(["gate.candidate-observation-unavailable"])
          })
          commandInputHashes.push(receipt.execution.evaluationRecord.commandInputSha256)
        }
      }
      expect(commandRoots).toHaveLength(3)
      expect(commandRoots.every((root) => root !== null)).toBe(true)
      expect(new Set(commandRoots).size).toBe(3)
      expect(new Set(commandInputHashes).size).toBe(1)
      expect(evaluatorCalls).toBe(0)
    }))

  it("rejects candidate-authored gate status before calling the runner evaluator", async () =>
    withFixture(async (fixture) => {
      let evaluatorCalls = 0
      const gateEvaluator: GateEvaluator = {
        evaluatorId: ArtifactId.make("gate-evaluator.test-accepted-v1"),
        evaluate: () => Effect.sync(() => {
          evaluatorCalls += 1
          return new AcceptedGateEvaluation({ facts: [runnerEvaluationFact()] })
        })
      }
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: fixture.sandbox,
        isolatedProcess: {
          run: (request) => Effect.succeed(gateResult(request, { status: "Passed" }))
        },
        gateEvaluator
      })
      const receipt = await Effect.runPromise(executor.executeGate(
        "GT08-exact-runtime-declaration-surface",
        { caseReceipts: [], probeReceipts: [] }
      ))
      expect(receipt.execution._tag).toBe("Failed")
      if (receipt.execution._tag === "Failed") {
        expect(receipt.execution.failureIds).toContain("adapter.protocol")
      }
      expect(evaluatorCalls).toBe(0)
    }))

  it("never exposes a gate evaluator to a candidate-planted host symlink", async () =>
    withFixture(async (fixture) => {
      const tempParent = join(fixture.outer, "gate-inspection-sandboxes")
      const hostFile = join(fixture.outer, "gate-host-secret")
      await mkdir(tempParent)
      await writeFile(hostFile, "gate-host-secret\n")
      let evaluatorCalls = 0
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: makeTrialCandidateSandbox({ tempParent }),
        isolatedProcess: {
          run: (request) => Effect.promise(async () => {
            await unlink(join(request.candidateRoot, "trial-adapter.ts"))
            await symlink(hostFile, join(request.candidateRoot, "trial-adapter.ts"))
            return gateResult(request)
          })
        },
        gateEvaluator: acceptedGateEvaluator(() => {
          evaluatorCalls += 1
        })
      })
      const receipt = await Effect.runPromise(executor.executeGate(
        "GT08-exact-runtime-declaration-surface",
        { caseReceipts: [], probeReceipts: [] }
      ))
      expect(receipt.execution._tag).toBe("Failed")
      if (receipt.execution._tag === "Failed") {
        expect(receipt.execution.failureIds).toContain("gate.inspection-snapshot")
      }
      expect(evaluatorCalls).toBe(0)
      expect(await readFile(hostFile, "utf8")).toBe("gate-host-secret\n")
      expect(await readdir(tempParent)).toEqual([])
    }))

  it("restores no-follow directory modes and removes a chmod-000 sandbox after adapter sabotage", async () =>
    withFixture(async (fixture) => {
      const tempParent = join(fixture.outer, "live-sandboxes")
      await mkdir(tempParent)
      const liveSandbox = makeTrialCandidateSandbox({ tempParent })
      let sabotagedRoot = ""
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: liveSandbox,
        isolatedProcess: {
          run: (request) => Effect.promise(async () => {
            const result = caseResult(fixture.context.spec, request)
            sabotagedRoot = request.candidateRoot
            const hostileDirectory = join(request.candidateRoot, "hostile", "nested")
            await mkdir(hostileDirectory, { recursive: true })
            await writeFile(join(hostileDirectory, "payload"), "hostile\n")
            const rawDirectory = Buffer.concat([
              Buffer.from(`${request.candidateRoot}/hostile/`),
              Buffer.from([0xff])
            ])
            await mkdir(rawDirectory)
            await writeFile(Buffer.concat([rawDirectory, Buffer.from("/payload")]), "raw\n")
            await chmod(rawDirectory, 0o000)
            await chmod(hostileDirectory, 0o000)
            await chmod(dirname(hostileDirectory), 0o000)
            await chmod(request.candidateRoot, 0o000)
            return result
          })
        }
      })
      const receipt = await Effect.runPromise(executor.executeCase("C01-initial-success"))
      expect(receipt.execution._tag).toBe("Passed")
      expect(sabotagedRoot).not.toBe("")
      expect(existsSync(sabotagedRoot)).toBe(false)
      expect(await readdir(tempParent)).toEqual([])
    }))

  it("rejects a manifest-listed hard link before any candidate process starts", async () =>
    withFixture(async (fixture) => {
      const tempParent = join(fixture.outer, "hard-link-sandboxes")
      const externalPath = join(fixture.outer, "external-bytes.ts")
      const candidatePath = join(fixture.candidateRoot, "src/index.ts")
      await mkdir(tempParent)
      await writeFile(externalPath, "export const candidate = true\n")
      await unlink(candidatePath)
      await link(externalPath, candidatePath)

      let processCalls = 0
      const executor = makeTrialAdapterExecutor(fixture.context, {
        sandbox: makeTrialCandidateSandbox({ tempParent }),
        isolatedProcess: {
          run: () => Effect.sync(() => {
            processCalls += 1
            throw new Error("candidate process must not start")
          })
        }
      })
      const receipt = await Effect.runPromise(executor.executeCase("C01-initial-success"))
      expect(receipt.execution._tag).toBe("Failed")
      if (receipt.execution._tag === "Failed") {
        expect(receipt.execution.failureIds).toContain("adapter.sandbox")
        expect(receipt.execution.terminalOutput).toBeNull()
      }
      expect(processCalls).toBe(0)
      expect(await readFile(externalPath, "utf8")).toBe("export const candidate = true\n")
      expect(await readdir(tempParent)).toEqual([])
    }))
})
