import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import {
  CandidateManifestInvariantError,
  decodeCandidateManifest,
  encodeCandidateManifest
} from "../src/schema/candidate-manifest.js"
import {
  type V2CandidateId,
  V2_CANDIDATE_DEFINITIONS,
  V2_CANDIDATE_IDS
} from "../src/schema/v2-ids.js"

type MutableDocument = Record<string, any>
type Mutation = (document: MutableDocument) => void

const codePointCompare = (left: string, right: string): number => {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!
    if (difference !== 0) return difference
  }
  return leftPoints.length - rightPoints.length
}

const makeValidManifest = (candidateId: V2CandidateId = "M1-extracted-fold"): MutableDocument => {
  const candidate = V2_CANDIDATE_DEFINITIONS[candidateId]
  return {
    schemaVersion: "ts-release/architecture-candidate-manifest/v2",
    candidateId,
    scope: candidate.scope,
    model: candidate.model,
    implementationRoot: candidate.implementationRoot,
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
    dependencyEdges: [
      {
        id: "module.core->package.core:static",
        fromId: "module.core",
        toId: "package.core",
        kind: "static"
      }
    ]
  }
}

const expectDecodeFailure = Effect.fn("candidateManifestTest.expectDecodeFailure")(
  function* (mutate: Mutation, candidateId: V2CandidateId = "M1-extracted-fold") {
    const document = makeValidManifest(candidateId)
    mutate(document)
    const exit = yield* decodeCandidateManifest(document).pipe(Effect.exit)
    expect(Exit.isFailure(exit)).toBe(true)
  }
)

describe("ArchitectureCandidateManifestV2", () => {
  it.effect("decodes a synthetic manifest for every frozen candidate", () =>
    Effect.gen(function* () {
      for (const candidateId of V2_CANDIDATE_IDS) {
        const manifest = yield* decodeCandidateManifest(makeValidManifest(candidateId))
        expect(manifest.candidateId).toBe(candidateId)
        expect(manifest.scope).toBe(V2_CANDIDATE_DEFINITIONS[candidateId].scope)
      }
    }))

  it.effect("hard-cuts old versions and rejects unknown keys at every structural boundary", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.schemaVersion = "ts-release/architecture-candidate-manifest/v1"
        },
        (document) => {
          document.selectedCandidateId = document.candidateId
        },
        (document) => {
          document.files[0].sha256 = "0".repeat(64)
        },
        (document) => {
          document.dependencyEdges[0].optional = false
        },
        (document) => {
          document.objectiveMetrics = [{ id: "candidate-owned-value", value: 0 }]
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("rejects wrong candidate ids, scopes, models, and implementation roots", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.candidateId = "M3-invented"
        },
        (document) => {
          document.scope = "topology"
        },
        (document) => {
          document.model = "total-transition"
        },
        (document) => {
          document.implementationRoot =
            "prototypes/research-complete-machine/M2-total-transition"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("rejects duplicate or unsorted inventories and identifier sets", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.files[1].path = document.files[0].path
        },
        (document) => {
          ;[document.files[0], document.files[1]] = [document.files[1], document.files[0]]
        },
        (document) => {
          document.publicSurfaceIds = ["public.main", "public.main"]
        },
        (document) => {
          document.durableFormatIds = ["format.zeta", "format.alpha"]
        },
        (document) => {
          document.files[0].ownerRoleIds = ["role.kernel", "role.kernel"]
        },
        (document) => {
          document.files[0].conceptIds = ["concept.zeta", "concept.alpha"]
        },
        (document) => {
          document.files[0].centralBranchIds = ["branch.main", "branch.main"]
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("requires both tooling harness files and a product-counting lane", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.files = document.files.filter(({ path }: MutableDocument) =>
            path !== "trial-adapter.ts")
        },
        (document) => {
          document.files = document.files.filter(({ path }: MutableDocument) =>
            path !== "trial-candidate.json")
        },
        (document) => {
          document.files[0].laneId = "fixture"
        },
        (document) => {
          document.files[1].laneId = "fixture"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("rejects Git metadata and dependency-installation path segments", () =>
    Effect.gen(function* () {
      const forbiddenPaths = [
        ".git/config",
        "src/node_modules/provider/index.ts",
        "src/.GIT/config"
      ]
      for (const path of forbiddenPaths) {
        yield* expectDecodeFailure((document) => {
          document.files[0].path = path
          document.files.sort((left: MutableDocument, right: MutableDocument) =>
            codePointCompare(left.path, right.path))
        })
      }
    }))

  it.effect("requires complete declarations on every product-counting file", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.files[0].moduleId = null
        },
        (document) => {
          document.files[0].packageId = null
        },
        (document) => {
          document.files[0].ownerRoleIds = []
        },
        (document) => {
          document.files[0].conceptIds = []
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)

      for (const laneId of ["product-source", "generated-product-input", "action-source"] as const) {
        const document = makeValidManifest()
        document.files[0].laneId = laneId
        yield* decodeCandidateManifest(document)
      }
    }))

  it.effect("rejects noncanonical, self, duplicate, and unsorted dependency edges", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.dependencyEdges[0].id = "module.core->package.core:dynamic"
        },
        (document) => {
          document.dependencyEdges[0] = {
            id: "module.core->module.core:static",
            fromId: "module.core",
            toId: "module.core",
            kind: "static"
          }
        },
        (document) => {
          document.dependencyEdges.push(structuredClone(document.dependencyEdges[0]))
        },
        (document) => {
          document.dependencyEdges = [
            {
              id: "zeta.module->zeta.package:static",
              fromId: "zeta.module",
              toId: "zeta.package",
              kind: "static"
            },
            document.dependencyEdges[0]
          ]
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("refuses to encode a decoded manifest after semantic mutation", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeCandidateManifest(makeValidManifest())
      ;(manifest as unknown as MutableDocument).implementationRoot =
        "prototypes/research-complete-machine/M2-total-transition"

      expect(() => encodeCandidateManifest(manifest)).toThrow(CandidateManifestInvariantError)
      expect(() => encodeCandidateManifest(manifest)).toThrow(/implementation root/u)
    }))
})
