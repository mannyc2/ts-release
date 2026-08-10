import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import {
  packagePath, readJson, report, root, selfReleaseConfig, stringField
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
  const version = stringField(readJson(packagePath), "version") ?? ""
  for (const manifestPath of ["ts-release-plugin/.codex-plugin/plugin.json", "ts-release-plugin/.claude-plugin/plugin.json"]) {
    if (stringField(readJson(manifestPath), "version") !== version) failures.push(`${manifestPath} version must equal the root package version.`)
  }
  report("self-release-artifacts-report/v3", failures, {
    artifacts: inspection.artifacts.length, publications: inspection.publications.length
  })
} finally {
  await api.dispose()
}
