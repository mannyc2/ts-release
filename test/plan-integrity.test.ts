import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as A from "../src/grammar/artifact.js"
import * as Content from "../src/grammar/content.js"
import * as Intent from "../src/grammar/intent.js"
import * as O from "../src/grammar/operation.js"
import { readReleasePlan, ReleasePlan } from "../src/grammar/plan.js"
import { makePipelineIdentity } from "./helpers.js"

const artifact = (id: string, path: string, extra: A.ArtifactExtra): A.Artifact =>
  A.Artifact.make({ id, path, producedBy: "test", extra })

const op = (id: string, action: O.Action, phase: O.OperationPhase, risk: O.OperationRisk): O.Operation =>
  O.Operation.make({ id, pipeId: "test", phase, risk, description: id, action })

const baseArtifacts = [
  artifact("executable", "dist/tool", A.ExecutableExtra.make({ binary: "tool", extension: "", builderId: "bun" })),
  artifact("archive", "dist/tool.tar.gz", A.ArchiveExtra.make({ format: "tar.gz", binaries: ["tool"], files: [] })),
  artifact(
    "checksums",
    "dist/checksums.txt",
    A.ChecksumFileExtra.make({ algorithm: "sha256", coversArtifactIds: ["archive"] })
  )
]

const stageOp = op(
  "build:compile",
  O.StageAction.make({
    intent: Intent.BunCompileIntent.make({
      entry: "src/cli.ts",
      target: "linux-x64",
      compileTarget: "bun-linux-x64",
      outfile: "dist/tool"
    }),
    producesArtifactIds: ["executable"]
  }),
  "build",
  "writes-local"
)
const writeOp = op(
  "catalog:render",
  O.WriteFileAction.make({
    path: "dist/tool.rb",
    contents: Content.FilePartsContent.make({
      parts: ["sha256=", Content.Sha256Hole.make({ artifactId: "archive" })]
    })
  }),
  "catalog",
  "writes-local"
)
const githubOp = op(
  "publish:github",
  O.GitHubReleaseCreateAction.make({
    repository: "owner/repo",
    tag: "v0.1.0",
    title: "v0.1.0",
    draft: false,
    prerelease: false,
    assets: [O.GitHubReleaseAssetSpec.make({
      artifactId: "archive",
      path: "dist/tool.tar.gz",
      name: "tool.tar.gz",
      contentType: "application/gzip"
    })]
  }),
  "publish",
  "irreversible"
)
const checkOp = op("verify:file", O.CheckFileAction.make({ path: "dist/tool" }), "verify", "read-only")
const noteOp = op("publish:note", O.NoteAction.make({ message: "note", severity: "info", skipped: false }), "publish", "read-only")

const baseOperations = [stageOp, writeOp, githubOp, checkOp, noteOp]

const planOf = (
  artifacts: ReadonlyArray<A.Artifact>,
  operations: ReadonlyArray<O.Operation>
): ReleasePlan =>
  ReleasePlan.make({
    schemaVersion: "release-plan/v5",
    identity: makePipelineIdentity(),
    artifacts,
    operations,
    evidenceDirectory: ".release/evidence"
  })

// Replacement is by id so each case names the operation or artifact it corrupts.
const withOperation = (replacement: O.Operation): ReleasePlan =>
  planOf(baseArtifacts, baseOperations.map((existing) => existing.id === replacement.id ? replacement : existing))
const withArtifact = (replacement: A.Artifact): ReleasePlan =>
  planOf(baseArtifacts.map((existing) => existing.id === replacement.id ? replacement : existing), baseOperations)

const validPlan = planOf(baseArtifacts, baseOperations)
const encodedValidPlan = Schema.encodeSync(ReleasePlan)(validPlan)

const readPlan = (plan: ReleasePlan) => readReleasePlan(JSON.stringify(Schema.encodeSync(ReleasePlan)(plan)))

interface IntegrityCase {
  readonly name: string
  readonly rule: string
  readonly plan: ReleasePlan
}

// The masquerade class: an action whose declared phase or risk understates what it actually does.
const policyCases: ReadonlyArray<IntegrityCase> = [
  {
    name: "a github release create that claims to be read-only",
    rule: "operation.risk",
    plan: withOperation(O.Operation.make({ ...githubOp, risk: "read-only" }))
  },
  {
    name: "a github release create that claims to run in the build phase",
    rule: "operation.phase",
    plan: withOperation(O.Operation.make({ ...githubOp, phase: "build" }))
  },
  {
    name: "a write-file that claims to be read-only",
    rule: "operation.risk",
    plan: withOperation(O.Operation.make({ ...writeOp, risk: "read-only" }))
  },
  {
    name: "a stage that claims to be read-only",
    rule: "operation.risk",
    plan: withOperation(O.Operation.make({ ...stageOp, risk: "read-only" }))
  },
  {
    name: "a note that claims to be irreversible",
    rule: "operation.risk",
    plan: withOperation(O.Operation.make({ ...noteOp, risk: "irreversible" }))
  }
]

const referenceCases: ReadonlyArray<IntegrityCase> = [
  {
    name: "a stage naming an artifact the plan never declares",
    rule: "stage.producesArtifactIds",
    plan: withOperation(O.Operation.make({
      ...stageOp,
      action: O.StageAction.make({ ...stageOp.action as O.StageAction, producesArtifactIds: ["ghost"] })
    }))
  },
  {
    name: "two stages claiming the same artifact",
    rule: "stage.producesArtifactIds",
    plan: planOf(baseArtifacts, [...baseOperations, O.Operation.make({ ...stageOp, id: "build:compile-again" })])
  },
  {
    name: "a github asset naming an artifact the plan never declares",
    rule: "github-release-create.assets",
    plan: withOperation(O.Operation.make({
      ...githubOp,
      action: O.GitHubReleaseCreateAction.make({
        ...githubOp.action as O.GitHubReleaseCreateAction,
        assets: [O.GitHubReleaseAssetSpec.make({
          artifactId: "ghost",
          path: "dist/ghost.tar.gz",
          name: "ghost.tar.gz",
          contentType: "application/gzip"
        })]
      })
    }))
  },
  {
    name: "a checksum file covering an artifact the plan never declares",
    rule: "checksum-file.coversArtifactIds",
    plan: withArtifact(artifact(
      "checksums",
      "dist/checksums.txt",
      A.ChecksumFileExtra.make({ algorithm: "sha256", coversArtifactIds: ["ghost"] })
    ))
  },
  {
    name: "deferred content referencing an artifact the plan never declares",
    rule: "write-file.contents",
    plan: withOperation(O.Operation.make({
      ...writeOp,
      action: O.WriteFileAction.make({
        path: "dist/tool.rb",
        contents: Content.FilePartsContent.make({
          parts: ["sha256=", Content.Sha256Hole.make({ artifactId: "ghost" })]
        })
      })
    }))
  }
]

const uniquenessCases: ReadonlyArray<IntegrityCase> = [
  {
    name: "duplicate artifact ids",
    rule: "artifacts.id",
    plan: planOf(
      [...baseArtifacts, artifact("archive", "dist/other.tar.gz", A.ImportedFileExtra.make({ format: "tarball" }))],
      baseOperations
    )
  },
  {
    name: "duplicate artifact paths",
    rule: "artifacts.path",
    plan: planOf(
      [...baseArtifacts, artifact("second", "dist/tool.tar.gz", A.ImportedFileExtra.make({ format: "tarball" }))],
      baseOperations
    )
  },
  {
    name: "duplicate artifact basenames under different paths",
    rule: "artifacts.name",
    plan: planOf(
      [...baseArtifacts, artifact("second", "other/tool", A.ImportedFileExtra.make({ format: "file" }))],
      baseOperations
    )
  },
  {
    name: "duplicate operation ids",
    rule: "operations.id",
    plan: planOf(baseArtifacts, [...baseOperations, O.Operation.make({ ...checkOp, action: O.CheckFileAction.make({ path: "dist/other" }) })])
  }
]

describe("plan integrity", () => {
  it.effect("accepts a plan whose declarations, references, and ids all agree", () =>
    Effect.gen(function*() {
      const plan = yield* readPlan(validPlan)
      expect(Schema.encodeSync(ReleasePlan)(plan)).toEqual(encodedValidPlan)
    }))

  for (const integrityCase of [...policyCases, ...referenceCases, ...uniquenessCases]) {
    it.effect(`rejects ${integrityCase.name}`, () =>
      Effect.gen(function*() {
        const error = yield* readPlan(integrityCase.plan).pipe(Effect.flip)
        expect(error._tag).toBe("PlanIntegrityError")
        if (error._tag === "PlanIntegrityError") expect(error.rule).toBe(integrityCase.rule)
      }))
  }

  // The v4 boundary is held by the strict decoder rather than the rule table, so it is pinned here
  // too: a v4 document must never reach validation and silently pass as a v5 plan.
  it.effect("rejects a v4 schemaVersion", () =>
    Effect.gen(function*() {
      const error = yield* readReleasePlan(
        JSON.stringify({ ...encodedValidPlan, schemaVersion: "release-plan/v4" })
      ).pipe(Effect.flip)
      expect(error._tag).toBe("SchemaError")
    }))

  it.effect("rejects an artifact carrying the deleted kind property", () =>
    Effect.gen(function*() {
      const [first, ...rest] = encodedValidPlan.artifacts
      const error = yield* readReleasePlan(JSON.stringify({
        ...encodedValidPlan,
        artifacts: [{ ...first, kind: "executable" }, ...rest]
      })).pipe(Effect.flip)
      expect(error._tag).toBe("SchemaError")
    }))

  it.effect("rejects text that is not JSON", () =>
    Effect.gen(function*() {
      const error = yield* readReleasePlan("{ not json").pipe(Effect.flip)
      expect(error._tag).toBe("PlanIntegrityError")
      if (error._tag === "PlanIntegrityError") expect(error.rule).toBe("plan.json")
    }))
})
