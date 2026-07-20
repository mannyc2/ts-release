import { describe, expect, test } from "@effect/bun-test"
import { ArchiveIntent } from "../src/grammar/intent.js"
import { Operation, StageAction } from "../src/grammar/operation.js"
import { ReleasePlan, SourceMetadata } from "../src/grammar/plan.js"
import { evidenceOperationStatuses, stagedArtifactSummaries } from "../src/render/summary.js"
import { EvidenceBundle, EvidenceRecord } from "../src/run/evidence.js"
import { makePipelineIdentity } from "./helpers.js"

const plan = (operations: ReadonlyArray<Operation> = []) => ReleasePlan.make({
  schemaVersion: "release-plan/v4",
  identity: makePipelineIdentity(),
  artifacts: [],
  operations,
  source: SourceMetadata.make({ root: "." }),
  evidenceDirectory: ".release/evidence"
})

describe("summary orphan handling", () => {
  test("projects an evidence record absent from the current plan", () => {
    const evidence = EvidenceBundle.make({
      schemaVersion: "release-evidence/v3",
      releaseName: "release",
      releaseVersion: "0.1.0",
      records: [EvidenceRecord.make({
        operationId: "ghost:op",
        pipeId: "ghost",
        phase: "verify",
        risk: "read-only",
        status: "passed",
        message: "passed",
        startedAt: "2026-07-20T00:00:00.000Z",
        endedAt: "2026-07-20T00:00:00.001Z",
        durationMillis: 1
      })]
    })

    expect(evidenceOperationStatuses(plan(), evidence)).toEqual([{
      id: "ghost:op",
      pipeId: "ghost",
      description: "(not in current plan)",
      risk: "read-only",
      status: "executed"
    }])
  })

  test("skips a staged artifact absent from the current plan", () => {
    const operation = Operation.make({
      id: "build:ghost",
      pipeId: "build",
      phase: "build",
      risk: "writes-local",
      description: "Build a missing artifact.",
      action: StageAction.make({
        intent: ArchiveIntent.make({
          outfile: "dist/ghost.zip",
          format: "zip",
          artifacts: [],
          files: []
        }),
        producesArtifactIds: ["ghost"]
      })
    })

    expect(stagedArtifactSummaries(plan([operation]))).toEqual([])
  })
})
