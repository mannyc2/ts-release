import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "../src/canonical-document.js"
import { trialSpecInputPath } from "../src/check-inputs.js"
import type { SourceCoordinateGitAuthority } from "../src/check-source-coordinate.js"
import { TrialRunContextToolchain } from "../src/schema/run-context.js"
import { PlannedRepositoryPath } from "../src/schema/primitives.js"
import {
  decodeArchitectureTrialSpec,
  gateDefinitionSha256,
  type ArchitectureTrialSpecV2
} from "../src/schema/trial-spec.js"
import type { V2CandidateId } from "../src/schema/v2-ids.js"
import {
  CandidateTreeInventory,
  CanonicalTreeEntry
} from "../src/trial-inventory.js"
import { hashCanonicalDocumentBytes, sha256Bytes } from "../src/trial-hash.js"
import { computeTrialRunnerSourceClosureSha256 } from "../src/trial-runner-source-closure.js"
import {
  TrialRunnerPreflight,
  TrialRunnerPreflightError,
  makeTrialRunnerPreflight,
  makeTrialRunnerPreflightLayer,
  type TrialRunnerPreflightDependencies
} from "../src/trial-runner-preflight.js"
import {
  RuntimeDependencyRegularFile,
  RuntimeDependencyTreeInventory,
  runtimeDependencyTreeSha256
} from "../src/trial-runtime-dependency-tree.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const sourceRepositoryRoot = resolve(moduleDirectory, "../../..")
const rawTrialSpecBytes = new Uint8Array(readFileSync(resolve(sourceRepositoryRoot, trialSpecInputPath)))
const trialSpec = Effect.runSync(decodeArchitectureTrialSpec(parseCanonicalJsonBytes(rawTrialSpecBytes)))
const encoder = new TextEncoder()
const repositoryRoot = resolve("/fixture/repository")
const trialSpecPath = resolve(repositoryRoot, trialSpecInputPath)
const runnerSourceRoot = resolve(repositoryRoot, trialSpec.receiptContract.runnerSourceRoot)
const runnerPackageManifestPath = resolve(
  repositoryRoot,
  trialSpec.receiptContract.runnerPackageManifestPath
)
const runnerTypeScriptConfigPath = resolve(
  repositoryRoot,
  trialSpec.receiptContract.runnerTypeScriptConfigPath
)
const architectureProgramRoot = resolve(repositoryRoot, "tools/architecture-program")
const runnerNodeModulesRoot = resolve(architectureProgramRoot, "node_modules")
const candidateDigest = sha256Bytes(encoder.encode("candidate-tree"))
const runnerSourceTreeDigest = sha256Bytes(encoder.encode("runner-tree"))
const runnerPackageManifestBytes = encoder.encode(
  '{"name":"@fixture/architecture-program","scripts":' +
  '{"gate:machine":"false","gate:topology":"false"}}\n'
)
const runnerPackageManifestDigest = sha256Bytes(runnerPackageManifestBytes)
const runnerTypeScriptConfigBytes = encoder.encode('{"compilerOptions":{"strict":true}}\n')
const runnerTypeScriptConfigDigest = sha256Bytes(runnerTypeScriptConfigBytes)
const runnerDigest = computeTrialRunnerSourceClosureSha256(
  runnerSourceTreeDigest,
  runnerPackageManifestDigest,
  runnerTypeScriptConfigDigest
)
const typescriptPackageBytes = encoder.encode('{"name":"typescript","version":"6.0.3"}\n')
const effectPackageBytes = encoder.encode('{"name":"effect","version":"4.0.0-rc.108"}\n')
const runtimeDependencyEntries = [
  new RuntimeDependencyRegularFile({
    path: "effect/package.json",
    mode: "100644",
    byteLength: effectPackageBytes.byteLength,
    bytesSha256: sha256Bytes(effectPackageBytes)
  }),
  new RuntimeDependencyRegularFile({
    path: "typescript/package.json",
    mode: "100644",
    byteLength: typescriptPackageBytes.byteLength,
    bytesSha256: sha256Bytes(typescriptPackageBytes)
  })
]
const runnerNodeModulesDigest = runtimeDependencyTreeSha256(runtimeDependencyEntries)
const bunExecutableDigest = sha256Bytes(encoder.encode("bun-executable"))
const gitExecutableDigest = sha256Bytes(encoder.encode("git-executable"))
const bubblewrapExecutableDigest = sha256Bytes(encoder.encode("bubblewrap-executable"))
const toolchainContext = new TrialRunContextToolchain({
  bun: "1.3.14",
  bunExecutableSha256: bunExecutableDigest,
  typescript: "6.0.3",
  effect: "4.0.0-rc.108",
  git: "2.47.3",
  gitExecutableSha256: gitExecutableDigest,
  bubblewrapVersion: "0.9.0",
  bubblewrapExecutableSha256: bubblewrapExecutableDigest
})

const candidateFromSpec = (candidateId: V2CandidateId) => {
  const machine = trialSpec.machineCandidates.find(({ id }) => id === candidateId)
  if (machine !== undefined) return { definition: machine, scope: "machine" as const }
  const topology = trialSpec.topologyCandidates.find(({ id }) => id === candidateId)
  if (topology === undefined) throw new Error(`missing candidate ${candidateId}`)
  return { definition: topology, scope: "topology" as const }
}

const manifestDocument = (candidateId: V2CandidateId) => {
  const candidate = candidateFromSpec(candidateId)
  return {
    schemaVersion: "ts-release/architecture-candidate-manifest/v2",
    candidateId,
    scope: candidate.scope,
    model: candidate.definition.model,
    implementationRoot: candidate.definition.implementationRoot,
    files: [
      {
        path: "src/index.ts",
        laneId: "product-source",
        moduleId: "module.core",
        packageId: "package.core",
        ownerRoleIds: ["role.kernel"],
        conceptIds: ["concept.machine"],
        centralBranchIds: ["branch.main"]
      },
      {
        path: "trial-adapter.ts",
        laneId: "tooling",
        moduleId: null,
        packageId: null,
        ownerRoleIds: [],
        conceptIds: [],
        centralBranchIds: []
      },
      {
        path: "trial-candidate.json",
        laneId: "tooling",
        moduleId: null,
        packageId: null,
        ownerRoleIds: [],
        conceptIds: [],
        centralBranchIds: []
      }
    ],
    publicSurfaceIds: ["public.main"],
    durableFormatIds: ["format.journal-v2"],
    dependencyEdges: []
  } as const
}

interface CallLog {
  readonly checks: Array<string>
  readonly reads: Array<string>
  readonly realpaths: Array<string>
  readonly candidateInventories: Array<string>
  readonly runnerInventories: Array<string>
  readonly runtimeDependencyInventories: Array<string>
  readonly toolchains: Array<string>
  readonly gitAuthorities: Array<SourceCoordinateGitAuthority>
}

interface FixtureOptions {
  readonly candidateId?: V2CandidateId
  readonly manifestBytes?: Uint8Array
  readonly runnerPackageManifestBytes?: Uint8Array
  readonly runnerTypeScriptConfigBytes?: Uint8Array
  readonly checkedSpec?: ArchitectureTrialSpecV2
  readonly realpath?: (path: string) => Effect.Effect<string, unknown, never>
  readonly checkInputs?: TrialRunnerPreflightDependencies["checkInputs"]
  readonly candidateInventory?: TrialRunnerPreflightDependencies["inventory"]["candidate"]
  readonly runnerInventory?: TrialRunnerPreflightDependencies["inventory"]["canonical"]
  readonly runtimeDependencyInventory?:
    TrialRunnerPreflightDependencies["inventory"]["runtimeDependencies"]
  readonly discoverToolchain?: TrialRunnerPreflightDependencies["toolchain"]["discoverResolved"]
}

const makeDependencies = (options: FixtureOptions = {}) => {
  const candidateId = options.candidateId ?? "M1-extracted-fold"
  const candidate = candidateFromSpec(candidateId)
  const candidateRoot = resolve(repositoryRoot, candidate.definition.implementationRoot)
  const candidateManifestPath = resolve(candidateRoot, "trial-candidate.json")
  const bytes = options.manifestBytes ?? canonicalJsonBytes(manifestDocument(candidateId))
  const packageManifestBytes = options.runnerPackageManifestBytes ?? runnerPackageManifestBytes
  const typeScriptConfigBytes = options.runnerTypeScriptConfigBytes ?? runnerTypeScriptConfigBytes
  const calls: CallLog = {
    checks: [],
    reads: [],
    realpaths: [],
    candidateInventories: [],
    runnerInventories: [],
    runtimeDependencyInventories: [],
    toolchains: [],
    gitAuthorities: []
  }
  const dependencies: TrialRunnerPreflightDependencies = {
    files: {
      read: (path) => {
        calls.reads.push(path)
        if (path === trialSpecPath) return Effect.succeed(new Uint8Array(rawTrialSpecBytes))
        if (path === candidateManifestPath) return Effect.succeed(new Uint8Array(bytes))
        if (path === runnerPackageManifestPath) {
          return Effect.succeed(new Uint8Array(packageManifestBytes))
        }
        if (path === runnerTypeScriptConfigPath) {
          return Effect.succeed(new Uint8Array(typeScriptConfigBytes))
        }
        return Effect.fail(new Error(`unexpected read ${path}`))
      },
      realpath: (path) => {
        calls.realpaths.push(path)
        return options.realpath?.(path) ?? Effect.succeed(path)
      }
    },
    checkInputs: options.checkInputs ?? ((root, gitAuthority) => {
      calls.checks.push(root)
      calls.gitAuthorities.push(gitAuthority)
      return Effect.succeed({ trialSpec: options.checkedSpec ?? trialSpec })
    }),
    inventory: {
      candidate: options.candidateInventory ?? ((root) => {
        calls.candidateInventories.push(root)
        return Effect.succeed(new CandidateTreeInventory({
          entries: [new CanonicalTreeEntry({
            path: PlannedRepositoryPath.make("trial-candidate.json"),
            mode: "100644",
            bytes: bytes.byteLength,
            sha256: hashCanonicalDocumentBytes(bytes)
          })],
          treeSha256: candidateDigest
        }))
      }),
      canonical: options.runnerInventory ?? ((root) => {
        calls.runnerInventories.push(root)
        return Effect.succeed(new CandidateTreeInventory({
          entries: [],
          treeSha256: runnerSourceTreeDigest
        }))
      }),
      runtimeDependencies: options.runtimeDependencyInventory ?? ((root) => {
        calls.runtimeDependencyInventories.push(root)
        return Effect.succeed({
          root: {
            root,
            realPath: root,
            stat: { dev: 1, ino: 2 } as any
          },
          inventory: new RuntimeDependencyTreeInventory({
            entries: runtimeDependencyEntries,
            treeSha256: runnerNodeModulesDigest
          })
        })
      })
    },
    toolchain: {
      discover: () => Effect.succeed(toolchainContext),
      discoverResolved: options.discoverToolchain ?? ((root) => {
        calls.toolchains.push(root)
        return Effect.succeed({
          context: toolchainContext,
          bunExecutablePath: "/runtime/bun",
          gitExecutablePath: "/usr/bin/git",
          bubblewrapExecutablePath: "/usr/bin/bwrap",
          packageManifests: {
            typescript: {
              path: resolve(runnerNodeModulesRoot, "typescript/package.json"),
              sha256: sha256Bytes(typescriptPackageBytes)
            },
            effect: {
              path: resolve(runnerNodeModulesRoot, "effect/package.json"),
              sha256: sha256Bytes(effectPackageBytes)
            }
          }
        })
      })
    }
  }
  return { candidate, candidateRoot, candidateManifestPath, calls, dependencies }
}

describe("candidate-neutral trial runner preflight", () => {
  it.effect("binds only checked canonical inputs and runner-observed provenance", () =>
    Effect.gen(function* () {
      const fixture = makeDependencies()
      const prepared = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      )

      expect(fixture.calls.checks).toEqual([repositoryRoot])
      expect(fixture.calls.reads).toEqual([
        trialSpecPath,
        fixture.candidateManifestPath,
        runnerPackageManifestPath,
        runnerTypeScriptConfigPath
      ])
      expect(fixture.calls.candidateInventories).toEqual([fixture.candidateRoot])
      expect(fixture.calls.runnerInventories).toEqual([runnerSourceRoot])
      expect(fixture.calls.runtimeDependencyInventories).toEqual([runnerNodeModulesRoot])
      expect(fixture.calls.toolchains).toEqual([architectureProgramRoot])
      expect(fixture.calls.gitAuthorities).toHaveLength(1)
      expect(fixture.calls.gitAuthorities[0]).toMatchObject({
        executablePath: "/usr/bin/git",
        executableSha256: gitExecutableDigest
      })
      expect(prepared.repositoryRoot).toBe(repositoryRoot)
      expect(prepared.candidateRoot).toBe(fixture.candidateRoot)
      expect(prepared.runnerSourceRoot).toBe(runnerSourceRoot)
      expect(prepared.runnerPackageManifestPath).toBe(runnerPackageManifestPath)
      expect(prepared.rawRunnerPackageManifestBytes).toEqual(runnerPackageManifestBytes)
      expect(prepared.runnerPackageManifestSha256).toBe(runnerPackageManifestDigest)
      expect(prepared.runnerTypeScriptConfigPath).toBe(runnerTypeScriptConfigPath)
      expect(prepared.rawRunnerTypeScriptConfigBytes).toEqual(runnerTypeScriptConfigBytes)
      expect(prepared.runnerTypeScriptConfigSha256).toBe(runnerTypeScriptConfigDigest)
      expect(prepared.runnerNodeModulesRoot).toBe(runnerNodeModulesRoot)
      expect(prepared.rawTrialSpecSha256).toBe(hashCanonicalDocumentBytes(rawTrialSpecBytes))
      expect(prepared.rawCandidateManifestSha256).toBe(
        hashCanonicalDocumentBytes(canonicalJsonBytes(manifestDocument("M1-extracted-fold")))
      )
      expect(prepared.candidateTreeInventory.treeSha256).toBe(candidateDigest)
      expect(prepared.runnerSourceInventory.treeSha256).toBe(runnerSourceTreeDigest)
      expect(prepared.runContext).toMatchObject({
        trialSpecSha256: prepared.rawTrialSpecSha256,
        candidateId: "M1-extracted-fold",
        candidateScope: "machine",
        candidateModel: "extracted-fold",
        candidateManifestSha256: prepared.rawCandidateManifestSha256,
        candidateTreeSha256: candidateDigest,
        runnerSourceSha256: runnerDigest,
        runnerNodeModulesSha256: runnerNodeModulesDigest,
        toolchain: toolchainContext
      })
      expect(prepared.runContext.caseDefinitionBindings).toEqual(
        trialSpec.machineCases.map((machineCase) => ({
          caseId: machineCase.id,
          definitionSha256: machineCase.execution.definitionSha256,
          fixtureSha256: machineCase.execution.fixtureSha256,
          expectedEvidenceSha256: machineCase.execution.expectedEvidenceSha256
        }))
      )
      expect(prepared.runContext.probeDefinitionBindings).toEqual(
        trialSpec.marginalProbes.map((probe) => ({
          probeId: probe.id,
          definitionSha256: probe.execution.definitionSha256,
          baseFixtureSha256: probe.execution.baseFixtureSha256,
          changeDefinitionSha256: probe.execution.changeDefinitionSha256
        }))
      )
      expect(prepared.runContext.gateDefinitionBindings).toEqual(
        trialSpec.gateRequirements
          .filter(({ scope }) => scope === "machine")
          .map((gate) => ({ gateId: gate.id, definitionSha256: gateDefinitionSha256(gate) }))
      )
      expect(prepared.validationAuthority).toEqual({
        trialSpec: prepared.trialSpec,
        rawTrialSpecSha256: prepared.rawTrialSpecSha256,
        candidateManifest: prepared.candidateManifest,
        rawCandidateManifestSha256: prepared.rawCandidateManifestSha256,
        candidateTreeSha256: candidateDigest,
        runnerSourceSha256: runnerDigest,
        runnerNodeModulesSha256: runnerNodeModulesDigest,
        toolchain: prepared.toolchain
      })
    }))

  it.effect("constructs topology provenance without introducing candidate selection", () =>
    Effect.gen(function* () {
      const fixture = makeDependencies({ candidateId: "T3-provider-verticals" })
      const prepared = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
        repositoryRoot,
        "T3-provider-verticals"
      )

      expect(prepared.runContext.candidateScope).toBe("topology")
      expect(prepared.runContext.candidateModel).toBe("provider-verticals")
      expect(prepared.runContext.gateDefinitionBindings).toEqual(
        trialSpec.gateRequirements
          .filter(({ scope }) => scope === "topology")
          .map((gate) => ({ gateId: gate.id, definitionSha256: gateDefinitionSha256(gate) }))
      )
      expect(fixture.calls.toolchains).toEqual([architectureProgramRoot])
    }))

  it.effect("binds exact package-script and TypeScript config bytes into the source closure", () =>
    Effect.gen(function* () {
      const firstBytes = encoder.encode(
        '{"name":"fixture-a","scripts":' +
        '{"gate:machine":"false","gate:topology":"false"}}\n'
      )
      const secondBytes = encoder.encode(
        '{"name":"fixture-b","scripts":' +
        '{"gate:machine":"false","gate:topology":"false"}}\n'
      )
      const first = makeDependencies({ runnerPackageManifestBytes: firstBytes })
      const second = makeDependencies({ runnerPackageManifestBytes: secondBytes })
      const firstPrepared = yield* makeTrialRunnerPreflight(first.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      )
      const secondPrepared = yield* makeTrialRunnerPreflight(second.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      )

      expect(firstPrepared.runnerSourceInventory.treeSha256).toBe(runnerSourceTreeDigest)
      expect(secondPrepared.runnerSourceInventory.treeSha256).toBe(runnerSourceTreeDigest)
      expect(firstPrepared.runnerPackageManifestSha256).toBe(sha256Bytes(firstBytes))
      expect(secondPrepared.runnerPackageManifestSha256).toBe(sha256Bytes(secondBytes))
      expect(firstPrepared.runContext.runnerSourceSha256).not.toBe(
        secondPrepared.runContext.runnerSourceSha256
      )

      const firstConfig = encoder.encode('{"compilerOptions":{"paths":{}}}\n')
      const secondConfig = encoder.encode(
        '{"compilerOptions":{"paths":{"effect":["./hostile.ts"]}}}\n'
      )
      const firstConfigured = makeDependencies({ runnerTypeScriptConfigBytes: firstConfig })
      const secondConfigured = makeDependencies({ runnerTypeScriptConfigBytes: secondConfig })
      const firstConfiguredPrepared = yield* makeTrialRunnerPreflight(
        firstConfigured.dependencies
      ).prepare(repositoryRoot, "M1-extracted-fold")
      const secondConfiguredPrepared = yield* makeTrialRunnerPreflight(
        secondConfigured.dependencies
      ).prepare(repositoryRoot, "M1-extracted-fold")
      expect(firstConfiguredPrepared.runnerTypeScriptConfigSha256).toBe(sha256Bytes(firstConfig))
      expect(secondConfiguredPrepared.runnerTypeScriptConfigSha256).toBe(sha256Bytes(secondConfig))
      expect(firstConfiguredPrepared.runContext.runnerSourceSha256).not.toBe(
        secondConfiguredPrepared.runContext.runnerSourceSha256
      )
    }))

  it.effect("rejects package manifests that do not retain both fail-closed gate scripts", () =>
    Effect.gen(function* () {
      for (const runnerPackageManifestBytes of [
        encoder.encode('{"name":"fixture","scripts":{"gate:machine":"false"}}\n'),
        encoder.encode(
          '{"name":"fixture","scripts":' +
          '{"gate:machine":"bun run src/other.ts","gate:topology":"false"}}\n'
        )
      ]) {
        const fixture = makeDependencies({ runnerPackageManifestBytes })
        const error = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
          repositoryRoot,
          "M1-extracted-fold"
        ).pipe(Effect.flip)

        expect(error.operation).toBe("validate runner package gate scripts")
        expect(error.path).toBe(runnerPackageManifestPath)
        expect(error.reason).toMatch(/gate:(?:machine|topology)/u)
      }
    }))

  it.effect("exposes the same injectable constructor through a service layer", () => {
    const fixture = makeDependencies()
    return Effect.gen(function* () {
      const preflight = yield* TrialRunnerPreflight
      const prepared = yield* preflight.prepare(repositoryRoot, "M1-extracted-fold")
      expect(prepared.runContext.candidateId).toBe("M1-extracted-fold")
    }).pipe(Effect.provide(makeTrialRunnerPreflightLayer(fixture.dependencies)))
  })

  it.effect("rejects unknown candidate ids before filesystem or checker observation", () =>
    Effect.gen(function* () {
      const fixture = makeDependencies()
      const error = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
        repositoryRoot,
        "M9-caller-selection" as V2CandidateId
      ).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialRunnerPreflightError)
      expect(error.operation).toBe("validate candidate id")
      expect(fixture.calls.realpaths).toEqual([])
      expect(fixture.calls.checks).toEqual([])
    }))

  it.effect("rejects checker/document drift at the fixed canonical spec path", () =>
    Effect.gen(function* () {
      const drifted = {
        ...trialSpec,
        programId: "caller-supplied-program"
      } as unknown as ArchitectureTrialSpecV2
      const fixture = makeDependencies({ checkedSpec: drifted })
      const error = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialRunnerPreflightError)
      expect(error.operation).toBe("bind checked trial specification")
      expect(fixture.calls.reads).toEqual([trialSpecPath])
      expect(fixture.calls.candidateInventories).toEqual([])
      expect(fixture.calls.toolchains).toEqual([architectureProgramRoot])
    }))

  it.effect("rejects noncanonical and schema-excess candidate manifests before inventory", () =>
    Effect.gen(function* () {
      const canonical = canonicalJsonBytes(manifestDocument("M1-extracted-fold"))
      const noncanonical = new Uint8Array(canonical.byteLength + 1)
      noncanonical.set(canonical)
      noncanonical[canonical.byteLength] = 0x20
      const excess = canonicalJsonBytes({
        ...manifestDocument("M1-extracted-fold"),
        selectedByCaller: true
      })

      for (const manifestBytes of [noncanonical, excess]) {
        const fixture = makeDependencies({ manifestBytes })
        const error = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
          repositoryRoot,
          "M1-extracted-fold"
        ).pipe(Effect.flip)
        expect(error).toBeInstanceOf(TrialRunnerPreflightError)
        expect(error.operation).toMatch(/candidate manifest/u)
        expect(fixture.calls.candidateInventories).toEqual([])
        expect(fixture.calls.toolchains).toEqual([architectureProgramRoot])
      }
    }))

  it.effect("rejects a valid manifest for a different candidate before tree observation", () =>
    Effect.gen(function* () {
      const fixture = makeDependencies({
        manifestBytes: canonicalJsonBytes(manifestDocument("M2-total-transition"))
      })
      const error = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialRunnerPreflightError)
      expect(error.operation).toBe("validate candidate manifest identity")
      expect(error.reason).toContain("candidateId")
      expect(fixture.calls.candidateInventories).toEqual([])
      expect(fixture.calls.toolchains).toEqual([architectureProgramRoot])
    }))

  it.effect("rejects manifest bytes that do not bind the observed candidate tree", () =>
    Effect.gen(function* () {
      const fixture = makeDependencies({
        candidateInventory: () => Effect.succeed(new CandidateTreeInventory({
          entries: [new CanonicalTreeEntry({
            path: PlannedRepositoryPath.make("trial-candidate.json"),
            mode: "100644",
            bytes: 7,
            sha256: sha256Bytes(encoder.encode("changed"))
          })],
          treeSha256: candidateDigest
        }))
      })
      const error = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.flip)

      expect(error.operation).toBe("bind candidate manifest to candidate tree")
      expect(error.reason).toContain("does not equal")
      expect(fixture.calls.runnerInventories).toEqual([])
      expect(fixture.calls.toolchains).toEqual([architectureProgramRoot])
    }))

  it.effect("rejects toolchain package bytes that differ from the bound runtime tree", () =>
    Effect.gen(function* () {
      const mismatchedEntries = runtimeDependencyEntries.map((entry) =>
        entry.path === "typescript/package.json"
          ? new RuntimeDependencyRegularFile({
            ...entry,
            bytesSha256: sha256Bytes(encoder.encode("hostile TypeScript package manifest"))
          })
          : entry)
      const fixture = makeDependencies({
        runtimeDependencyInventory: (root) => Effect.succeed({
          root: {
            root,
            realPath: root,
            stat: { dev: 1, ino: 2 } as any
          },
          inventory: new RuntimeDependencyTreeInventory({
            entries: mismatchedEntries,
            treeSha256: runtimeDependencyTreeSha256(mismatchedEntries)
          })
        })
      })

      const error = yield* makeTrialRunnerPreflight(fixture.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.flip)

      expect(error.operation).toBe("bind typescript package manifest")
      expect(error.reason).toContain("does not equal toolchain hash")
    }))

  it.effect("rejects candidate-root and manifest symlink escapes before inventory or toolchain discovery", () =>
    Effect.gen(function* () {
      const candidateFixture = makeDependencies()
      const escapedRoot = makeDependencies({
        realpath: (path) => path === candidateFixture.candidateRoot
          ? Effect.succeed(resolve("/outside/candidate"))
          : Effect.succeed(path)
      })
      const rootError = yield* makeTrialRunnerPreflight(escapedRoot.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.flip)
      expect(rootError.operation).toBe("resolve candidate implementation root")
      expect(rootError.reason).toContain("escapes")
      expect(escapedRoot.calls.candidateInventories).toEqual([])
      expect(escapedRoot.calls.toolchains).toEqual([architectureProgramRoot])

      const escapedManifest = makeDependencies({
        realpath: (path) => path === candidateFixture.candidateManifestPath
          ? Effect.succeed(resolve("/outside/trial-candidate.json"))
          : Effect.succeed(path)
      })
      const manifestError = yield* makeTrialRunnerPreflight(escapedManifest.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.flip)
      expect(manifestError.operation).toBe("resolve candidate manifest")
      expect(manifestError.reason).toContain("escapes")
      expect(escapedManifest.calls.candidateInventories).toEqual([])
      expect(escapedManifest.calls.toolchains).toEqual([architectureProgramRoot])
    }))

  it.effect("maps synchronous and effectful injected failures to one typed preflight error", () =>
    Effect.gen(function* () {
      const thrown = makeDependencies({
        checkInputs: () => {
          throw new Error("checker defect")
        }
      })
      const thrownError = yield* makeTrialRunnerPreflight(thrown.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.flip)
      expect(thrownError).toBeInstanceOf(TrialRunnerPreflightError)
      expect(thrownError.operation).toBe("check architecture inputs")
      expect(thrownError.reason).toContain("checker defect")

      const rejected = makeDependencies({
        candidateInventory: () => Effect.fail(new Error("tree changed during observation"))
      })
      const exit = yield* makeTrialRunnerPreflight(rejected.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
      const inventoryError = yield* makeTrialRunnerPreflight(rejected.dependencies).prepare(
        repositoryRoot,
        "M1-extracted-fold"
      ).pipe(Effect.flip)
      expect(inventoryError).toBeInstanceOf(TrialRunnerPreflightError)
      expect(inventoryError.operation).toBe("inventory candidate tree")
      expect(inventoryError.reason).toContain("tree changed")
      expect(rejected.calls.toolchains).toEqual([
        architectureProgramRoot,
        architectureProgramRoot
      ])
    }))
})
