import * as core from "@actions/core"
import { makeActionsArtifactTransport } from "./artifact-client.js"
import {
  selfReleaseReportFailureCode,
  selfReleaseReportKinds,
  stageSelfReleaseReportHandoff,
  type SelfReleaseReportKind
} from "./report-retainer.js"

const handoffKinds = new Set<SelfReleaseReportKind>(["npm-oidc-certification", "npm-publish"])

const reportKind = (value: string): SelfReleaseReportKind => {
  if ((selfReleaseReportKinds as ReadonlyArray<string>).includes(value) &&
      handoffKinds.has(value as SelfReleaseReportKind)) {
    return value as SelfReleaseReportKind
  }
  throw new Error("Private report handoff received an unknown report kind.")
}

export const main = async (sourceProof?: {
  readonly reportBytes: string
  readonly reportSha256: string
}): Promise<void> => {
  try {
    if (sourceProof === undefined) throw new Error("Private report handoff source proof is absent.")
    const result = await stageSelfReleaseReportHandoff({
      kind: reportKind(core.getInput("kind")),
      candidateSha: core.getInput("candidate-sha"),
      prepared: core.getInput("prepared"),
      workspace: process.env.GITHUB_WORKSPACE ?? "",
      environment: process.env,
      sourceProof,
      artifacts: makeActionsArtifactTransport()
    })
    core.setOutput("artifact-name", result.artifactName)
    core.setOutput("artifact-id", String(result.artifactId))
    core.setOutput("artifact-digest", result.artifactDigest)
    core.setOutput("report-sha256", result.reportSha256)
    console.log(JSON.stringify(result))
  } catch (cause) {
    core.setFailed(
      `Private self-release report handoff failed closed [${selfReleaseReportFailureCode(cause)}]; ` +
      "no handoff success is claimed."
    )
  }
}
