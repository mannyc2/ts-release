import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { parseCanonicalJsonBytes } from "../src/canonical-document.js"
import {
  OwnershipDecisionsInvariantError,
  decodeOwnershipDecisions,
  encodeOwnershipDecisions
} from "../src/schema/ownership-decisions.js"
import {
  sourceCoordinateKey,
  type SourceCoordinate
} from "../src/schema/source-coordinate.js"

type MutableDocument = Record<string, any>
type Mutation = (document: MutableDocument) => void

const fixturePath = resolve(
  typeof import.meta.dir === "string" ? import.meta.dir : dirname(fileURLToPath(import.meta.url)),
  "../../../docs/refactor/architecture-program/inputs/ownership-decisions.json"
)
const repositoryRoot = resolve(dirname(fixturePath), "../../../..")

const loadValidDocument = Effect.fn("ownershipDecisionsTest.loadValidDocument")(function* () {
  const bytes = yield* Effect.tryPromise(() => readFile(fixturePath))
  return structuredClone(parseCanonicalJsonBytes(bytes)) as MutableDocument
})

const expectDecodeFailure = Effect.fn("ownershipDecisionsTest.expectDecodeFailure")(
  function* (mutate: Mutation) {
    const document = yield* loadValidDocument()
    mutate(document)
    const exit = yield* decodeOwnershipDecisions(document).pipe(Effect.exit)
    expect(Exit.isFailure(exit)).toBe(true)
  }
)

describe("OwnershipDecisionsV1", () => {
  it.effect("decodes the canonical nine-decision ownership input", () =>
    Effect.gen(function* () {
      const raw = yield* loadValidDocument()
      const document = yield* decodeOwnershipDecisions(raw)

      expect(document.schemaVersion).toBe("ts-release/ownership-decisions/v1")
      expect(document.decisions.map(({ id }) => id)).toEqual([
        "OD01-journal-law",
        "OD02-cli-journal-deployment",
        "OD03-action-journal-deployment",
        "OD04-release-readiness-journal-deployment",
        "OD05-head-segment-roles",
        "OD06-effect-build-certification-classification",
        "OD07-apple-history-correlation",
        "OD08-hashed-file-tree-adoption",
        "OD09-durable-format-disposition"
      ])
      expect(document.decisions.filter(({ status }) => status === "selected")).toHaveLength(3)
      expect(document.externalEvidence).toHaveLength(2)
      expect(document.blockers).toHaveLength(6)
      expect(document.freezeBlockerIds).toHaveLength(6)
    }))

  it.effect("binds every source coordinate to the current exact file hash", () =>
    Effect.gen(function* () {
      const document = yield* decodeOwnershipDecisions(yield* loadValidDocument())
      const coordinates: Array<SourceCoordinate> = [
        ...document.decisions.flatMap(({ sourceCoordinates }) => sourceCoordinates),
        ...document.blockers.flatMap(({ sourceCoordinates }) => sourceCoordinates),
        ...document.hardCutPartitions.map(({ sourceCoordinate }) => sourceCoordinate),
        ...document.externalCopyInventory.sourceCoordinates,
        ...document.productJournalByteLimit.sourceCoordinates
      ]
      const uniqueCoordinates = new Map(coordinates.map((coordinate) => [sourceCoordinateKey(coordinate), coordinate]))

      for (const coordinate of uniqueCoordinates.values()) {
        if ("gitRevision" in coordinate) throw new Error("ownership input unexpectedly uses a Git coordinate")
        const contents = yield* Effect.tryPromise(() => readFile(resolve(repositoryRoot, coordinate.path)))
        const actualSha256 = createHash("sha256").update(contents).digest("hex")
        expect(actualSha256, coordinate.path).toBe(coordinate.sha256)
      }
      expect(uniqueCoordinates).toHaveLength(10)
    }))

  it.effect("rejects missing, duplicate, reordered, and renamed decisions", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => document.decisions.pop(),
        (document) => {
          document.decisions[1].id = document.decisions[0].id
        },
        (document) => {
          document.decisions.reverse()
        },
        (document) => {
          document.decisions[0].id = "OD01-renamed"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("rejects ownership, status, provenance, and dependent-gate drift", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.decisions[0].ownerId = "effect-build"
        },
        (document) => {
          document.decisions[2].status = "selected"
        },
        (document) => {
          document.decisions[3].sourceCoordinates[0].sha256 = "0".repeat(64)
        },
        (document) => {
          document.decisions[4].dependentGateIds.pop()
        },
        (document) => {
          document.decisions[5].dependentGateIds[0] = "GT99-missing-gate"
        },
        (document) => {
          document.decisions[7].externalEvidenceIds[0] = "EB99-missing-evidence"
        },
        (document) => {
          document.decisions[8].sourceCoordinates[0].path = "../outside.md"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("binds the exact dd39 generated contract and public API evidence", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.externalEvidence[0].gitRevision = "0".repeat(40)
        },
        (document) => {
          document.externalEvidence[0].gitTree = "0".repeat(40)
        },
        (document) => {
          document.externalEvidence[0].artifactPath = "../contract.json"
        },
        (document) => {
          document.externalEvidence[0].artifactSha256 = "0".repeat(64)
        },
        (document) => {
          document.externalEvidence[1].evidenceKind = "generated-contract"
        },
        (document) => document.externalEvidence.pop()
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("keeps the Action default blocked on all qualification evidence", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => document.decisions[2].requiredEvidence.pop(),
        (document) => document.decisions[2].blockerIds.pop(),
        (document) => {
          document.decisions[2].decision = "Use S3 as the universal Action default."
        },
        (document) => {
          document.decisions[2].dependentGateIds = ["GT16-offline-nonmutation"]
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("preserves S3 head and WORM segment ownership without a fallback", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.decisions[3].status = "selected"
        },
        (document) => {
          document.decisions[3].decision = document.decisions[3].decision.replace("no workspace-local", "a workspace-local")
        },
        (document) => {
          document.decisions[4].decision = document.decisions[4].decision.replace("not history", "history")
        },
        (document) => document.decisions[4].blockerIds.push("OB03-operational-s3-worm-cas-deployment")
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("preserves derived certification evidence and the sole Apple history", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.decisions[5].decision = "All effect-build certification records are release facts."
        },
        (document) => document.decisions[5].blockerIds.pop(),
        (document) => {
          document.decisions[6].ownerId = "effect-build-apple"
        },
        (document) => {
          document.decisions[6].status = "selected"
        },
        (document) => {
          document.decisions[6].decision = document.decisions[6].decision.replace("never blindly resubmits", "may resubmit")
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("preserves the complete HashedFile and HashedTree adoption contract", () =>
    Effect.gen(function* () {
      const fields = [
        "effect-build/artifact-adoption@1",
        "absolute producer path",
        "canonical decimal bytes",
        "structured digest",
        "ordered case-fold-unique entries",
        "totalBytes",
        "manifestDigest",
        "path-free",
        "strict versioned durable adoption envelope",
        "reverifies content",
        "entry modes",
        "symlinks",
        "shared content identity",
        "duplicate logical names",
        "mutable-path identity"
      ]
      for (const field of fields) {
        yield* expectDecodeFailure((document) => {
          document.decisions[7].decision = document.decisions[7].decision.replace(field, "omitted")
        })
      }
    }))

  it.effect("binds all five durable-format partition counts, hashes, and dispositions", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.hardCutPartitions[0].memberCount = 97
        },
        (document) => {
          document.hardCutPartitions[1].setSha256 = "0".repeat(64)
        },
        (document) => {
          document.hardCutPartitions[2].disposition = "hard-cut"
        },
        (document) => {
          document.hardCutPartitions[3].hashBasis = "unspecified"
        },
        (document) => document.hardCutPartitions.pop()
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("keeps external copies and the product journal bound explicitly unresolved", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.externalCopyInventory.finding = "none"
        },
        (document) => {
          document.externalCopyInventory.externalCopies = "none"
        },
        (document) => {
          document.externalCopyInventory.compatibilityPolicy = "dual-reader"
        },
        (document) => {
          document.productJournalByteLimit.hasProductAuthority = true
        },
        (document) => {
          document.productJournalByteLimit.numericLimitRecorded = true
        },
        (document) => {
          document.productJournalByteLimit.valueBytes = 64
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("requires every freeze blocker and its exact evidence contract", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => document.blockers.pop(),
        (document) => document.freezeBlockerIds.pop(),
        (document) => {
          document.freezeBlockerIds.reverse()
        },
        (document) => {
          document.blockers[0].blocksFinalFreeze = false
        },
        (document) => document.blockers[5].requiredEvidence.pop(),
        (document) => {
          document.blockers[2].dependentGateIds[0] = "GT99-missing-gate"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("rejects unknown fields at every durable boundary", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          document.selectedTopology = "T3-provider-verticals"
        },
        (document) => {
          document.decisions[0].fallbackStore = "filesystem"
        },
        (document) => {
          document.blockers[0].waived = true
        },
        (document) => {
          document.hardCutPartitions[0].members = []
        },
        (document) => {
          document.externalEvidence[0].mutableCheckoutPath = "/tmp/effect-build"
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("refuses to encode a decoded document after semantic mutation", () =>
    Effect.gen(function* () {
      const document = yield* decodeOwnershipDecisions(yield* loadValidDocument())
      ;(document.decisions[0] as unknown as MutableDocument).decision = "A second journal is allowed."

      expect(() => encodeOwnershipDecisions(document)).toThrow(OwnershipDecisionsInvariantError)
      expect(() => encodeOwnershipDecisions(document)).toThrow(/predeclared ownership/u)
    }))
})
