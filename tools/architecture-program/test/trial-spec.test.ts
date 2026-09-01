import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { parseCanonicalJsonBytes } from "../src/canonical-document.js"
import { trialContractOracleIssues } from "../src/check-trial-contract.js"
import { checkSourceAnchor } from "../src/check-inputs.js"
import {
  executionContractSha256,
  measurementContractSha256
} from "../src/schema/trial-contract.js"
import {
  type SourceAnchor,
  TrialSpecInvariantError,
  decodeArchitectureTrialSpec,
  encodeArchitectureTrialSpec
} from "../src/schema/trial-spec.js"

type MutableDocument = Record<string, any>
type Mutation = (document: MutableDocument) => void

const fixturePath = resolve(
  typeof import.meta.dir === "string" ? import.meta.dir : dirname(fileURLToPath(import.meta.url)),
  "../../../docs/refactor/architecture-program/inputs/trial-spec.json"
)

const loadValidDocument = Effect.fn("trialSpecTest.loadValidDocument")(function* () {
  const bytes = yield* Effect.tryPromise(() => readFile(fixturePath))
  return structuredClone(parseCanonicalJsonBytes(bytes)) as MutableDocument
})

const expectDecodeFailure = Effect.fn("trialSpecTest.expectDecodeFailure")(
  function* (mutate: Mutation) {
    const document = yield* loadValidDocument()
    mutate(document)
    const exit = yield* decodeArchitectureTrialSpec(document).pipe(Effect.exit)
    expect(Exit.isFailure(exit)).toBe(true)
  }
)

describe("ArchitectureTrialSpecV2", () => {
  it.effect("decodes the committed canonical trial specification", () =>
    Effect.gen(function* () {
      const document = yield* loadValidDocument()
      const spec = yield* decodeArchitectureTrialSpec(document)

      expect(spec.schemaVersion).toBe("ts-release/architecture-trial-spec/v2")
      expect(spec.machineCandidates).toHaveLength(2)
      expect(spec.topologyCandidates).toHaveLength(3)
      expect(spec.machineCases.every(({ execution }) => execution.definitionSha256.length === 64)).toBe(true)
      expect(spec.marginalProbes.every(({ execution }) => execution.definitionSha256.length === 64)).toBe(true)
    }))

  it.effect("hard-cuts v1 without a compatibility decoder", () =>
    expectDecodeFailure((document) => {
      document.schemaVersion = "ts-release/architecture-trial-spec/v1"
    }))

  it.effect("matches the independently authored v2 contract oracle", () =>
    Effect.gen(function* () {
      const document = yield* loadValidDocument()
      const spec = yield* decodeArchitectureTrialSpec(document)
      expect(trialContractOracleIssues(spec, encodeArchitectureTrialSpec(spec))).toEqual([])
    }))

  it.effect("rejects premature selection and target-publication fields at the top level", () =>
    Effect.gen(function* () {
      for (const key of ["selectedCandidateId", "targetSurface", "npmMap"]) {
        yield* expectDecodeFailure((document) => {
          document[key] = key === "selectedCandidateId" ? "M1-extracted-fold" : {}
        })
      }
    }))

  it.effect("rejects duplicate entity ids", () =>
    expectDecodeFailure((document) => {
      document.laws[1].id = document.laws[0].id
    }))

  it.effect("rejects dangling law, case, gate, and probe references", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.machineCandidates[0].lawIds[0] = "L99-missing-law"
        },
        (document) => {
          document.machineCandidates[0].caseIds[0] = "C99-missing-case"
        },
        (document) => {
          document.machineCandidates[0].gateIds[0] = "GM99-missing-gate"
        },
        (document) => {
          document.gateRequirements[0].probeIds = ["P99-missing-probe"]
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("binds authority coordinates and exact law, case, and probe provenance", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.authorities[0].ownerId = "product-research"
        },
        (document) => {
          document.authorities[0].sourceAnchor.startLine = 93
        },
        (document) => {
          document.laws[0].authorityIds = ["A12-cross-repository-boundary"]
        },
        (document) => {
          document.machineCases[0].authorityIds = ["A03-machine-contract"]
        },
        (document) => {
          document.marginalProbes[0].authorityIds = ["A04-topology-contract"]
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("rejects traversal and backslash repository paths in the schema", () =>
    Effect.gen(function* () {
      for (const path of ["../outside.md", "docs\\outside.md"]) {
        yield* expectDecodeFailure((document) => {
          document.authorities[0].sourceAnchor.path = path
        })
      }
    }))

  it.effect("requires the complete candidate, case, and probe sets", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => document.machineCandidates.pop(),
        (document) => document.topologyCandidates.pop(),
        (document) => document.machineCases.pop(),
        (document) => document.marginalProbes.pop()
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("requires every candidate to use the same complete shared sets", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => document.machineCandidates[1].lawIds.pop(),
        (document) => document.machineCandidates[1].caseIds.pop(),
        (document) => document.topologyCandidates[2].probeIds.pop(),
        (document) => document.topologyCandidates[2].gateIds.pop()
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("does not permit weakened Action, artifact, provider, or host literals", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.topologyFixture.actionPlacement = "library"
        },
        (document) => {
          document.topologyFixture.finalizedArtifactKinds = ["finalized-file"]
        },
        (document) => {
          document.topologyFixture.externalProviderLoading = "registry"
        },
        (document) => {
          document.topologyFixture.providerInstances[0].endpointClass = "any"
        },
        (document) => {
          document.topologyFixture.roles.find((role: MutableDocument) => role.kind === "GitHub-Action").kind = "host"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("requires hard offline gates without credentials or external mutation", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.gateRequirements[0].hard = false
        },
        (document) => {
          document.gateRequirements[0].networkAccess = true
        },
        (document) => {
          document.gateRequirements[0].credentials = true
        },
        (document) => {
          document.gateRequirements[0].mutatesExternalState = true
        },
        (document) => {
          document.gateRequirements[0].command = ["true"]
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("rejects removal or weakening of the exact bubblewrap isolation policy", () =>
    Effect.gen(function* () {
      const executionMutations: ReadonlyArray<Mutation> = [
        (document) => {
          delete document.executionContract.isolationPolicy
        },
        (document) => {
          document.executionContract.isolationPolicy.namespaceArguments.pop()
        },
        (document) => {
          document.executionContract.isolationPolicy.capabilityArguments = []
        },
        (document) => {
          document.executionContract.isolationPolicy.rootFilesystem.hostRootMount = "read-only"
        },
        (document) => {
          document.executionContract.isolationPolicy.rootFilesystem.readOnlyBinds.pop()
        },
        (document) => {
          document.executionContract.isolationPolicy.rootFilesystem.writableBinds.push({
            sourceAuthority: "fresh-candidate-copy",
            destination: "/candidate",
            persistence: "invocation-private"
          })
        },
        (document) => {
          document.executionContract.isolationPolicy.environment.variables.pop()
        },
        (document) => {
          document.executionContract.isolationPolicy.forbiddenMountClasses.pop()
        },
        (document) => {
          document.executionContract.isolationPolicy.runtimeDependencyTree.hashDomain =
            "ts-release/architecture-runtime-dependency-tree/v1"
        },
        (document) => {
          document.executionContract.isolationPolicy.runtimeDependencyTree.entryTypes.pop()
        },
        (document) => {
          document.executionContract.isolationPolicy.bunExecutableSnapshot.fileMode = "0777"
        },
        (document) => {
          document.executionContract.isolationPolicy.candidateSnapshot.rootAndImpliedDirectoryMode =
            "0755"
        },
        (document) => {
          document.executionContract.isolationPolicy.hostRuntimeTrust.hermeticityClaim =
            "fully-hermetic"
        },
        (document) => {
          document.executionContract.isolationPolicy.threatModelBoundary.hostAvailabilityGuarantee =
            "guaranteed"
        },
        (document) => {
          document.executionContract.isolationPolicy.threatModelBoundary.sameUidHostProcessBoundary =
            "candidate-controlled-same-uid-host-processes-in-scope"
        },
        (document) => {
          document.executionContract.isolationPolicy.receiptBindings
            .runnerNodeModulesSha256Field = "runnerSourceSha256"
        }
      ]
      for (const mutate of executionMutations) {
        yield* expectDecodeFailure((document) => {
          mutate(document)
          if (document.executionContract.isolationPolicy !== undefined) {
            document.executionContract.contractSha256 = executionContractSha256(
              document.executionContract
            )
          }
        })
      }
      yield* expectDecodeFailure((document) => {
        document.measurementContract.requiredToolchainBindings.pop()
        document.measurementContract.contractSha256 = measurementContractSha256(
          document.measurementContract
        )
      })
    }))

  it.effect("rejects config-sensitive Git diff or ambiguous binary-line measurement drift", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.measurementContract.diffArgv.splice(-3, 1)
        },
        (document) => {
          document.measurementContract.gitEnvironment.inheritedVariableNames = []
        },
        (document) => {
          document.measurementContract.gitEnvironment.fixedVariables[5].value = "/tmp/gitconfig"
        },
        (document) => {
          document.measurementContract.gitEnvironment.fixedVariables.pop()
        },
        (document) => {
          document.measurementContract.binaryNonProductLineDeltaPolicy = "ignore"
        },
        (document) => {
          document.measurementContract.gitExecutablePolicy.postPreflightPathLookup = "allowed"
        }
      ]
      for (const mutate of mutations) {
        yield* expectDecodeFailure((document) => {
          mutate(document)
          document.measurementContract.contractSha256 = measurementContractSha256(
            document.measurementContract
          )
        })
      }
    }))

  it.effect("hash-binds immutable inputs, execution, measurement, and fixture definitions", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.inputBindings[0].sha256 = "0".repeat(64)
        },
        (document) => {
          document.executionContract.caseActions[0].semantics += " weakened"
        },
        (document) => {
          document.measurementContract.methods[0].algorithmId = "untrusted-method"
        },
        (document) => {
          document.machineCases[0].execution.actionIds[0] = "action.derive-terminal-report"
        },
        (document) => {
          document.machineCases[0].execution.definitionSha256 = "0".repeat(64)
        },
        (document) => {
          document.topologyFixture.roles[0].kind = "machine"
        },
        (document) => {
          document.marginalProbes[0].execution.actionId = "probe.add-public-export"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("forbids timestamp and receipt-path drift in the v2 contract", () =>
    Effect.gen(function* () {
      for (const mutate of [
        (document: MutableDocument) => {
          document.receiptContract.generatedAt = "2026-08-31T00:00:00Z"
        },
        (document: MutableDocument) => {
          document.receiptContract.machineResultRoot = "tmp/results"
        },
        (document: MutableDocument) => {
          document.receiptContract.identityFieldIds[0] = "trial-spec-sha256"
        },
        (document: MutableDocument) => {
          document.receiptContract.gateObservationSchemaId = "architecture-gate-observation-v1"
        },
        (document: MutableDocument) => {
          document.receiptContract.aggregateResultSchemaId = "aggregate-trial-result-v2"
        },
        (document: MutableDocument) => {
          document.executionContract.caseAdapter.argv = ["sh", "-c", "run"]
        }
      ]) {
        yield* expectDecodeFailure(mutate)
      }
    }))

  it.effect("forbids weighted scoring and weak tie breakers", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.machineSelectionPolicy.weightedScoring = "allowed"
        },
        (document) => {
          document.machineSelectionPolicy.rankSums = "allowed"
        },
        (document) => {
          document.topologySelectionPolicy.lexicographicTieBreaks = "allowed"
        },
        (document) => {
          document.topologySelectionPolicy.unresolvedOutcome = "FirstCandidateWins"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("requires both inconclusive and safe-stop terminal cases", () =>
    expectDecodeFailure((document) => {
      for (const machineCase of document.machineCases) {
        if (machineCase.requiredTerminalOutcome === "Inconclusive" ||
          machineCase.requiredTerminalOutcome === "SafeStop") {
          machineCase.requiredTerminalOutcome = "Succeeded"
        }
      }
    }))

  it.effect("keeps the C16 64-byte journal bound trial-only", () =>
    Effect.gen(function* () {
      const mutateC16 = (
        document: MutableDocument,
        factName: string,
        mutate: (value: MutableDocument) => void
      ): void => {
        const c16 = document.machineCases.find((machineCase: MutableDocument) =>
          machineCase.id === "C16-journal-bound-symmetry")
        const fact = c16.fixture.inputFacts.find((entry: MutableDocument) => entry.name === factName)
        mutate(fact.value)
      }
      const mutations: ReadonlyArray<Mutation> = [
        (document) => mutateC16(document, "journal.limit-bytes", (value) => {
          value.value = 65
        }),
        (document) => mutateC16(document, "journal.limit-source", (value) => {
          value.value = "product-configuration"
        }),
        (document) => mutateC16(document, "journal.has-product-authority", (value) => {
          value.value = true
        }),
        (document) => {
          const c15 = document.machineCases.find((machineCase: MutableDocument) =>
            machineCase.id === "C15-host-dependency-shadowing")
          c15.fixture.inputFacts.push({
            sequence: c15.fixture.inputFacts.length + 1,
            name: "journal.limit-bytes",
            value: { _tag: "Integer", value: 64 }
          })
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("refuses to encode a decoded specification after semantic mutation", () =>
    Effect.gen(function* () {
      const document = yield* loadValidDocument()
      const spec = yield* decodeArchitectureTrialSpec(document)
      ;(spec.machineCandidates[0] as unknown as MutableDocument).caseIds = []

      expect(() => encodeArchitectureTrialSpec(spec)).toThrow(TrialSpecInvariantError)
      expect(() => encodeArchitectureTrialSpec(spec)).toThrow(/required ordered set/u)
    }))
})

describe("source anchor verification", () => {
  it.effect("checks whole-file hashes, line ranges, missing paths, and symlink containment", () =>
    Effect.acquireUseRelease(
      Effect.tryPromise(() => mkdtemp(join(tmpdir(), "architecture-program-anchor-"))),
      (temporaryRoot) => Effect.gen(function* () {
        const repositoryRoot = join(temporaryRoot, "repository")
        const outsidePath = join(temporaryRoot, "outside.txt")
        const contents = "first\nsecond\n"
        yield* Effect.tryPromise(() => mkdir(repositoryRoot))
        yield* Effect.tryPromise(() => writeFile(join(repositoryRoot, "anchor.txt"), contents))
        yield* Effect.tryPromise(() => writeFile(outsidePath, contents))
        yield* Effect.tryPromise(() => symlink(outsidePath, join(repositoryRoot, "escape.txt")))

        const sha256 = createHash("sha256").update(contents).digest("hex")
        const wholeFile = {
          _tag: "WholeFileSourceAnchor",
          path: "anchor.txt",
          sha256
        } as unknown as SourceAnchor
        const lineRange = {
          _tag: "LineRangeSourceAnchor",
          path: "anchor.txt",
          sha256,
          startLine: 1,
          endLine: 2
        } as unknown as SourceAnchor

        yield* checkSourceAnchor(repositoryRoot, wholeFile)
        yield* checkSourceAnchor(repositoryRoot, lineRange)

        for (const invalidAnchor of [
          { ...wholeFile, sha256: "0".repeat(64) },
          { ...lineRange, startLine: 2, endLine: 1 },
          { ...lineRange, endLine: 3 },
          { ...wholeFile, path: "missing.txt" },
          { ...wholeFile, path: "escape.txt" }
        ] as unknown as ReadonlyArray<SourceAnchor>) {
          const exit = yield* checkSourceAnchor(repositoryRoot, invalidAnchor).pipe(Effect.exit)
          expect(Exit.isFailure(exit)).toBe(true)
        }
      }),
      (temporaryRoot) => Effect.promise(() => rm(temporaryRoot, { recursive: true, force: true }))
    ))
})
