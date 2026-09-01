import * as core from "@actions/core"
import { makeActionsArtifactTransport } from "./artifact-client.js"
import {
  retainSelfReleaseReport,
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
    const result = await retainSelfReleaseReport({
      kind: reportKind(core.getInput("kind")),
      candidateSha: core.getInput("candidate-sha"),
      prepared: core.getInput("prepared"),
      workspace: process.env.GITHUB_WORKSPACE ?? "",
      environment: process.env,
      artifacts: makeActionsArtifactTransport()
    })
    core.setOutput("artifact-name", result.artifactName)
    core.setOutput("artifact-id", String(result.artifactId))
    core.setOutput("artifact-digest", result.artifactDigest)
    core.setOutput("report-sha256", result.reportSha256)
    console.log(JSON.stringify(result))
  } catch {
    core.setFailed("Private self-release report retention failed closed; no retention success is claimed.")
  }
}

void main()
