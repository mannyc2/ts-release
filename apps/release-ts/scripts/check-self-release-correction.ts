import { join } from "node:path"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import { preparedRoot, report, root, selfReleaseConfigs } from "./self-release-facts.js"

const failures: Array<string> = []
const api = makeReleaseApi(NodeReleaseLayer)
try {
  for (const { lane, config } of selfReleaseConfigs()) {
    const inspection = await api.inspect({ config, workspace: root })
    if (!("preparations" in inspection) || inspection.publications.length !== 1 ||
        inspection.publications[0]?.destination !== lane) {
      failures.push(`Correction check could not inspect the isolated ${lane} self-release graph.`)
    }
  }
  const store = join(root, preparedRoot)
  const publicationTags = new Set<string>()
  if (existsSync(store)) for (const entry of readdirSync(store, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue
    try {
      const manifest = JSON.parse(readFileSync(join(store, entry.name, "prepared-release.json"), "utf8")) as {
        readonly publications?: ReadonlyArray<{ readonly _tag?: string }>
      }
      for (const publication of manifest.publications ?? []) if (typeof publication._tag === "string") publicationTags.add(publication._tag)
    } catch {
      failures.push(`Prepared store entry ${entry.name} is not a readable canonical manifest.`)
    }
  }
  for (const tag of ["PreparedGitHubPublication", "PreparedNpmPublication"]) {
    if (!publicationTags.has(tag)) failures.push(`Correction check requires the candidate ${tag} bundle.`)
  }
} catch (cause) {
  failures.push(`Correction preflight inspection failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`)
} finally {
  await api.dispose()
}

const tests = [
  "test/correction/catalog-state.test.ts",
  "test/correction/github-release.test.ts",
  "test/correction/pypi-file-yank.test.ts",
  "test/correction/canonical-intent.test.ts",
  "test/correction/plan229-authored-correction.test.ts"
]
const result = spawnSync("bun", ["test", ...tests], { cwd: root, encoding: "utf8", stdio: "pipe" })
if (result.status !== 0) failures.push(`Provider correction contract tests failed: ${result.stderr.trim()}`)
report("self-release-correction-report/v1", failures, {
  tests,
  conditionalMutationAdmitted: false,
  authoredProposalBindingContractTested: result.status === 0,
  evidenceState: "contract-tested"
})
