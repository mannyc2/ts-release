import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { parseCanonicalJsonBytes } from "../src/canonical-document.js"
import {
  SOURCE_COORDINATE_GIT_TIMEOUT_MILLISECONDS,
  checkSourceCoordinate,
  type SourceCoordinateGitAuthority
} from "../src/check-source-coordinate.js"
import { checkResearchTraceability } from "../src/check-research-traceability.js"
import {
  decodeResearchTraceability,
  encodeResearchTraceability
} from "../src/schema/research-traceability.js"
import {
  ExistingRepositoryPath,
  GitRevision,
  ProgramId
} from "../src/schema/primitives.js"
import {
  CurrentWholeFileSourceCoordinate,
  GitWholeFileSourceCoordinate
} from "../src/schema/source-coordinate.js"
import { buildResearchTraceabilityDocument } from "../src/traceability-normalization.js"
import { sha256Bytes } from "../src/trial-hash.js"
import type { TrialProcessRequest } from "../src/trial-process.js"

type MutableDocument = Record<string, any>
type Mutation = (document: MutableDocument) => void

const testDirectory = typeof import.meta.dir === "string"
  ? import.meta.dir
  : dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(testDirectory, "../../..")
const fixturePath = resolve(
  repositoryRoot,
  "docs/refactor/architecture-program/inputs/research-traceability.json"
)

const loadFixture = Effect.fn("researchTraceabilityTest.loadFixture")(function* () {
  const bytes = yield* Effect.tryPromise(() => readFile(fixturePath))
  return structuredClone(parseCanonicalJsonBytes(bytes)) as MutableDocument
})

const expectDecodeFailure = Effect.fn("researchTraceabilityTest.expectDecodeFailure")(
  function* (mutate: Mutation) {
    const document = yield* loadFixture()
    mutate(document)
    const exit = yield* decodeResearchTraceability(document).pipe(Effect.exit)
    expect(Exit.isFailure(exit)).toBe(true)
  }
)

describe("ResearchTraceabilityV1", () => {
  it.effect("decodes all 226 propositions and the exact 129-row product boundary", () =>
    Effect.gen(function* () {
      const document = yield* decodeResearchTraceability(yield* loadFixture())
      expect(document.propositions).toHaveLength(226)
      expect(document.propositions.filter(({ productAuthority }) => productAuthority)).toHaveLength(129)
      expect(document.propositions.filter(({ class: className }) => className === "product-outcome")).toHaveLength(69)
      expect(document.propositions.filter(({ decisionId }) => decisionId !== null)).toHaveLength(10)
    }))

  it.effect("matches a fresh normalization of the canonical scorecard", () =>
    Effect.gen(function* () {
      const scorecard = yield* Effect.tryPromise(() => readFile(
        resolve(repositoryRoot, "docs/refactor/research/launch-scorecard.md"),
        "utf8"
      ))
      const expected = yield* decodeResearchTraceability(buildResearchTraceabilityDocument(scorecard))
      const actual = yield* decodeResearchTraceability(yield* loadFixture())
      expect(encodeResearchTraceability(actual)).toEqual(encodeResearchTraceability(expected))
    }))

  it.effect("rejects unknown top-level and proposition fields", () =>
    Effect.gen(function* () {
      yield* expectDecodeFailure((document) => {
        document.selectedCandidateId = "M1-extracted-fold"
      })
      yield* expectDecodeFailure((document) => {
        document.propositions[0].closed = true
      })
    }))

  it.effect("rejects duplicate or missing proposition rows", () =>
    Effect.gen(function* () {
      yield* expectDecodeFailure((document) => {
        document.propositions[1].id = document.propositions[0].id
      })
      yield* expectDecodeFailure((document) => {
        document.propositions.pop()
      })
    }))

  it.effect("rejects a count-preserving proposition substitution", () =>
    expectDecodeFailure((document) => {
      const row = document.propositions.find((candidate: MutableDocument) =>
        candidate.id === "history.lesson.one-canon")
      row.id = "history.lesson.invented-replacement"
      row.proposition = "An invented row cannot replace an independently required source-ledger entry."
    }))

  it.effect("rejects product authority outside the scorecard namespaces", () =>
    expectDecodeFailure((document) => {
      const row = document.propositions.find((candidate: MutableDocument) =>
        candidate.id === "history.lesson.one-canon")
      row.productAuthority = true
    }))

  it.effect("rejects contradictory owners", () =>
    expectDecodeFailure((document) => {
      const row = document.propositions.find((candidate: MutableDocument) =>
        candidate.sourceRecordId === "D01-01")
      row.ownerIds = ["ts-release", "warehouse-provider"]
    }))

  it.effect("requires exact resolved-later decision coverage", () =>
    expectDecodeFailure((document) => {
      const row = document.propositions.find((candidate: MutableDocument) =>
        candidate.sourceRecordId === "P05-04")
      row.decisionId = null
    }))

  it.effect("rejects swapped decisions and decisions outside the resolved-later set", () =>
    Effect.gen(function* () {
      yield* expectDecodeFailure((document) => {
        const first = document.propositions.find((candidate: MutableDocument) =>
          candidate.sourceRecordId === "P05-04")
        const second = document.propositions.find((candidate: MutableDocument) =>
          candidate.sourceRecordId === "P09-05")
        ;[first.decisionId, second.decisionId] = [second.decisionId, first.decisionId]
      })
      yield* expectDecodeFailure((document) => {
        const row = document.propositions.find((candidate: MutableDocument) =>
          candidate.sourceRecordId === "K01")
        row.decisionId = "DEC01"
      })
    }))

  it.effect("rejects unknown scorecard dispositions instead of treating them as later", () =>
    Effect.gen(function* () {
      const scorecard = yield* Effect.tryPromise(() => readFile(
        resolve(repositoryRoot, "docs/refactor/research/launch-scorecard.md"),
        "utf8"
      ))
      const unknownDisposition = scorecard.replace(
        /^(P05-04\|[^\n]*\|)L(\|[^\n]*)$/mu,
        "$1D$2"
      )
      expect(unknownDisposition).not.toBe(scorecard)
      expect(() => buildResearchTraceabilityDocument(unknownDisposition)).toThrow(
        /unknown disposition D/u
      )
    }))

  it.effect("rejects unknown evidence and successor references", () =>
    Effect.gen(function* () {
      yield* expectDecodeFailure((document) => {
        const row = document.propositions.find((candidate: MutableDocument) =>
          candidate.sourceRecordId === "D01-01")
        row.evidenceIds = ["S99"]
      })
      yield* expectDecodeFailure((document) => {
        const row = document.propositions.find((candidate: MutableDocument) =>
          candidate.sourceRecordId === "D01-01")
        row.successorIds = ["is.99-nonexistent"]
      })
    }))

  it.effect("rejects required or superseded rows without a successor", () =>
    Effect.gen(function* () {
      yield* expectDecodeFailure((document) => {
        const row = document.propositions.find((candidate: MutableDocument) =>
          candidate.id === "pr21.proposition.canonical-durable-chain")
        row.successorIds = []
      })
      yield* expectDecodeFailure((document) => {
        const row = document.propositions.find((candidate: MutableDocument) =>
          candidate.id === "history.api.make-release-api")
        row.successorIds = []
      })
    }))

  it.effect("does not confuse required witness kinds with obtained artifacts", () =>
    expectDecodeFailure((document) => {
      document.propositions[0].witnessArtifactIds = ["unearned-receipt"]
    }))

  it.effect("rejects traversal and malformed historical revisions", () =>
    Effect.gen(function* () {
      yield* expectDecodeFailure((document) => {
        document.propositions[0].sourceCoordinates[0].path = "../scorecard.md"
      })
      yield* expectDecodeFailure((document) => {
        const row = document.propositions.find((candidate: MutableDocument) =>
          candidate.id === "history.lesson.one-canon")
        row.sourceCoordinates[0].gitRevision = "86d30fe"
      })
    }))

  it.effect("verifies both current-file and historical Git-blob source coordinates", () =>
    Effect.gen(function* () {
      const document = yield* decodeResearchTraceability(yield* loadFixture())
      const current = document.propositions[0]?.sourceCoordinates[0]
      const historical = document.propositions.find(({ id }) => id === "history.lesson.one-canon")
        ?.sourceCoordinates[0]
      expect(current).toBeDefined()
      expect(historical).toBeDefined()
      if (current !== undefined) yield* checkSourceCoordinate(repositoryRoot, current)
      if (historical !== undefined) yield* checkSourceCoordinate(repositoryRoot, historical)
    }))

  it.effect("uses only the hash-bound absolute Git and closed routing environment", () =>
    Effect.gen(function* () {
      const gitExecutablePath = yield* Effect.tryPromise(() => realpath("/usr/bin/git"))
      const gitExecutableBytes = yield* Effect.tryPromise(() => readFile(gitExecutablePath))
      const blobBytes = new TextEncoder().encode("bound historical source\n")
      const revision = GitRevision.make("a".repeat(40))
      const path = ExistingRepositoryPath.make("docs/bound-source.md")
      const requests: Array<TrialProcessRequest> = []
      const authority: SourceCoordinateGitAuthority = {
        executablePath: gitExecutablePath,
        executableSha256: sha256Bytes(gitExecutableBytes),
        process: {
          run: (request) => {
            requests.push(request)
            return Effect.succeed({
              exitCode: 0,
              stdout: blobBytes,
              stderr: new Uint8Array()
            })
          }
        }
      }
      const coordinate = new GitWholeFileSourceCoordinate({
        repositoryId: ProgramId.make("ts-release"),
        gitRevision: revision,
        path,
        sha256: sha256Bytes(blobBytes)
      })

      yield* checkSourceCoordinate(repositoryRoot, coordinate, authority)

      expect(requests).toHaveLength(1)
      expect(requests[0]).toEqual({
        argv: [
          gitExecutablePath,
          "-C",
          repositoryRoot,
          "cat-file",
          "blob",
          `${revision}:${path}`
        ],
        cwd: repositoryRoot,
        stdin: new TextEncoder().encode("{}\n"),
        timeoutMilliseconds: SOURCE_COORDINATE_GIT_TIMEOUT_MILLISECONDS,
        closedEnvironment: {
          PATH: dirname(gitExecutablePath),
          LC_ALL: "C",
          LANG: "C",
          TZ: "UTC",
          NO_COLOR: "1"
        },
        environmentProfile: "git-measurement"
      })
      expect(requests[0]?.closedEnvironment).not.toHaveProperty("GIT_DIR")
      expect(requests[0]?.closedEnvironment).not.toHaveProperty("GIT_WORK_TREE")
    }))

  it.effect("rejects an in-repository symlink alias even when target bytes match", () =>
    Effect.acquireUseRelease(
      Effect.tryPromise(async () => {
        const root = await mkdtemp(join(tmpdir(), "architecture-source-coordinate-"))
        const docs = join(root, "docs")
        const bytes = new TextEncoder().encode("same bytes\n")
        await mkdir(docs)
        await writeFile(join(docs, "target.md"), bytes)
        await symlink("target.md", join(docs, "alias.md"))
        return { root, bytes }
      }),
      ({ root, bytes }) => Effect.gen(function* () {
        const coordinate = new CurrentWholeFileSourceCoordinate({
          repositoryId: ProgramId.make("ts-release"),
          path: ExistingRepositoryPath.make("docs/alias.md"),
          sha256: sha256Bytes(bytes)
        })
        const exit = yield* checkSourceCoordinate(root, coordinate).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }),
      ({ root }) => Effect.promise(() => rm(root, { recursive: true, force: true }))
    ))

  it.effect("rejects a source-coordinate hash mismatch", () =>
    Effect.gen(function* () {
      const document = yield* decodeResearchTraceability(yield* loadFixture())
      const coordinate = structuredClone(document.propositions[0]?.sourceCoordinates[0])
      expect(coordinate).toBeDefined()
      if (coordinate === undefined) return
      ;(coordinate as MutableDocument).sha256 = "0".repeat(64)
      const exit = yield* checkSourceCoordinate(repositoryRoot, coordinate).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("rejects nonexistent current files and historical Git blobs", () =>
    Effect.gen(function* () {
      const document = yield* decodeResearchTraceability(yield* loadFixture())
      const current = structuredClone(document.propositions[0]?.sourceCoordinates[0])
      const historical = structuredClone(document.propositions.find(({ id }) =>
        id === "history.lesson.one-canon")?.sourceCoordinates[0])
      expect(current).toBeDefined()
      expect(historical).toBeDefined()
      if (current !== undefined) {
        ;(current as MutableDocument).path = "docs/refactor/research/nonexistent-source.md"
        const exit = yield* checkSourceCoordinate(repositoryRoot, current).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
      if (historical !== undefined) {
        ;(historical as MutableDocument).path = "contracts/rewrite/nonexistent-source.json"
        const exit = yield* checkSourceCoordinate(repositoryRoot, historical).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("checks every committed source and atomic scorecard anchor", () =>
    Effect.gen(function* () {
      const result = yield* checkResearchTraceability(repositoryRoot)
      expect(result.document.propositions).toHaveLength(226)
      expect(result.checkedSourceCoordinates).toBe(219)
    }))
})
