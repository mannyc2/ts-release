import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import { report, root, selfReleaseConfig } from "./self-release-facts.js"

const api = makeReleaseApi(NodeReleaseLayer)
try {
  const inspection = await api.inspect({ config: selfReleaseConfig(), workspace: root })
  report("self-release-inspect-report/v1", [], {
    commit: inspection.source.commit.toString(), artifacts: inspection.artifacts.length,
    publications: inspection.publications.length
  })
} catch (cause) {
  const message = cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)
  report("self-release-inspect-report/v1", [message], {})
} finally {
  await api.dispose()
}
