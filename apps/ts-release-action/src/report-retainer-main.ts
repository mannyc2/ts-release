import * as core from "@actions/core"
import { makeActionsArtifactTransport } from "./artifact-client.js"
import {
  retainSelfReleaseReport,
  selfReleaseReportFailureCode,
  selfReleaseReportKinds,
  type SelfReleaseReportKind
} from "./report-retainer.js"

const reportKind = (value: string): SelfReleaseReportKind => {
  if ((selfReleaseReportKinds as ReadonlyArray<string>).includes(value)) {
    return value as SelfReleaseReportKind
  }
  throw new Error("Private report retainer received an unknown report kind.")
}

const main = async (): Promise<void> => {
  try {
    const handoff = {
      artifactName: core.getInput("handoff-artifact-name"),
      artifactId: core.getInput("handoff-artifact-id"),
      artifactDigest: core.getInput("handoff-artifact-digest"),
      reportSha256: core.getInput("handoff-report-sha256")
    }
    const hasHandoff = Object.values(handoff).some((value) => value.length > 0)
    const producerResult = core.getInput("producer-result")
    const result = await retainSelfReleaseReport({
      kind: reportKind(core.getInput("kind")),
      candidateSha: core.getInput("candidate-sha"),
      prepared: core.getInput("prepared"),
      workspace: process.env.GITHUB_WORKSPACE ?? "",
      environment: process.env,
      artifacts: makeActionsArtifactTransport(),
      ...(hasHandoff ? { handoff } : {}),
      ...(producerResult === "success" || producerResult === "failure" ? { producerResult } : {})
    })
    core.setOutput("artifact-name", result.artifactName)
    core.setOutput("artifact-id", String(result.artifactId))
    core.setOutput("artifact-digest", result.artifactDigest)
    core.setOutput("report-sha256", result.reportSha256)
    console.log(JSON.stringify(result))
  } catch (cause) {
    core.setFailed(
      `Private self-release report retention failed closed [${selfReleaseReportFailureCode(cause)}]; ` +
      "no retention success is claimed."
    )
  }
}

void main()
