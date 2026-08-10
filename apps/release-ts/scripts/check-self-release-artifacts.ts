import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import {
  report, root, selfReleaseConfig
} from "./self-release-facts.js"

const failures: Array<string> = []
const api = makeReleaseApi(NodeReleaseLayer)
try {
  const inspection = await api.inspect({ config: selfReleaseConfig(), workspace: root })
  if (inspection.artifacts.length === 0) failures.push("The self-release inspection declares no artifacts.")
  if (inspection.publications.length === 0) failures.push("The self-release inspection declares no publications.")
  if (inspection.artifacts.some((artifact) => artifact.path.toString().startsWith("/") || artifact.path.toString().includes("../"))) {
    failures.push("The self-release inspection contains a non-contained artifact path.")
  }
  if (!("preparations" in inspection)) failures.push("The self-release inspection did not return an authored release graph.")
  else if (!inspection.preparations.some((preparation) => preparation.id.toString() === "preparation:agents")) failures.push("The self-release config does not declare the agent generator as a preparation.")
  const agentArtifacts = inspection.artifacts.filter((artifact) => artifact.id.toString().startsWith("agents-"))
  if (agentArtifacts.length < 2) failures.push("The self-release config does not declare the generated agent artifacts.")
  report("self-release-artifacts-report/v3", failures, {
    artifacts: inspection.artifacts.length, publications: inspection.publications.length
  })
} finally {
  await api.dispose()
}
