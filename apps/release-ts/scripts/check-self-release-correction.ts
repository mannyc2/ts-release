import { join } from "node:path"
import { existsSync, readdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import { preparedRoot, report, root, selfReleaseConfig } from "./self-release-facts.js"

const failures: Array<string> = []
const api = makeReleaseApi(NodeReleaseLayer)
try {
  const inspection = await api.inspect({ config: selfReleaseConfig(), workspace: root })
  if (!("preparations" in inspection)) failures.push("Correction check could not inspect the self-release graph.")
  const store = join(root, preparedRoot)
  if (!existsSync(store) || readdirSync(store).filter((entry) => !entry.startsWith(".")).length === 0) failures.push("Correction check requires the candidate prepared bundle.")
} catch (cause) {
  failures.push(`Correction preflight inspection failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`)
} finally {
  await api.dispose()
}

const tests = [
  "test/correction/catalog-state.test.ts",
  "test/correction/github-release.test.ts",
  "test/correction/pypi-file-yank.test.ts",
  "test/correction/canonical-intent.test.ts"
]
const result = spawnSync("bun", ["test", ...tests], { cwd: root, encoding: "utf8", stdio: "pipe" })
if (result.status !== 0) failures.push(`Provider correction contract tests failed: ${result.stderr.trim()}`)
report("self-release-correction-report/v1", failures, {
  tests,
  conditionalMutationAdmitted: false,
  authoredProposalBindingContractTested: result.status === 0,
  evidenceState: "contract-tested"
})
