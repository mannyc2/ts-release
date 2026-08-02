// The reusable workflow is YAML that strangers' release pipelines execute, so
// every threading mistake the old hand-written templates made becomes ours at
// scale. These are string scans, deliberately — the repo keeps no YAML
// dependency, and the properties worth pinning are all textual: which ids
// thread where, which keys must never appear, and which permissions the publish
// job gets.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (path: string): string => readFileSync(join(root, path), "utf8")
const workflow = read(".github/workflows/ts-release-release.yml")
const template = read("templates/github-actions/release.yml")
const actionManifest = read("apps/ts-release-action/action.yml")

const declaredInputs = (): ReadonlySet<string> => {
  const lines = actionManifest.split("\n")
  const start = lines.indexOf("inputs:")
  const names = new Set<string>()
  for (const line of lines.slice(start + 1)) {
    if (line.trim().length > 0 && !line.startsWith(" ")) break
    const match = /^ {2}([a-z0-9_-]+):/u.exec(line)
    if (match !== null) names.add(match[1]!)
  }
  return names
}

// Every `with:` key under a `uses: ./apps/ts-release-action` step, per job.
const actionStepKeys = (): ReadonlyArray<{ readonly job: string, readonly keys: ReadonlyArray<string> }> => {
  const lines = workflow.split("\n")
  const steps: Array<{ job: string, keys: Array<string> }> = []
  let job = "<workflow>"
  let collecting = false
  let current: { job: string, keys: Array<string> } | undefined
  for (const line of lines) {
    const jobHeader = /^ {2}([a-z-]+):$/u.exec(line)
    if (jobHeader !== null) job = jobHeader[1]!
    if (line.trim() === "uses: ./apps/ts-release-action") {
      current = { job, keys: [] }
      steps.push(current)
      collecting = false
      continue
    }
    if (current === undefined) continue
    if (line.trim() === "with:") {
      collecting = true
      continue
    }
    if (collecting) {
      const key = /^ {10}([a-z-]+):/u.exec(line)
      if (key === null) {
        collecting = false
        current = undefined
      } else current.keys.push(key[1]!)
    }
  }
  return steps
}

describe("the composed release workflow", () => {
  test("every action input it passes is one the action declares", () => {
    const declared = declaredInputs()
    const steps = actionStepKeys()
    expect(steps.length).toBe(4)
    for (const step of steps) {
      expect(step.keys.length).toBeGreaterThan(0)
      for (const key of step.keys) expect([key, declared.has(key)]).toEqual([key, true])
    }
  })

  test("the approval binds the exact reviewed plan", () => {
    // One plan, compiled once, referenced by id in both applies. Nothing
    // downstream may recompile it.
    expect(workflow).toContain("plan_id: ${{ steps.plan.outputs.plan_id }}")
    expect(workflow.match(/plan-id: \$\{\{ needs\.plan\.outputs\.plan_id \}\}/gu)).toHaveLength(2)
    expect(workflow).toContain("confirm-execution: ${{ needs.plan.outputs.execution_review_id }}")
    expect(workflow).toContain("confirm-publish: ${{ needs.materialize.outputs.publish_review_id }}")
    const planCommands = workflow.split("\n").filter((line) => line.trim() === "command: plan")
    expect(planCommands).toHaveLength(1)
    expect(actionStepKeys().filter((step) => step.job === "plan")).toHaveLength(2)
  })

  test("both gated jobs sit behind the environment and share the runs path", () => {
    expect(workflow.match(/environment: \$\{\{ inputs\.environment \}\}/gu)).toHaveLength(2)
    expect(workflow).toContain("new-run: ${{ inputs.runs-path }}")
    expect(workflow).toContain("resume: ${{ inputs.runs-path }}")
  })

  // The run state lives under `.release`, a dot-directory. upload-artifact
  // skips hidden files by default, uploads NOTHING, and still passes with a
  // warning — so the failure surfaces one job later as a missing artifact.
  test("every upload carries hidden files", () => {
    const uploads = workflow.match(/uses: actions\/upload-artifact/gu) ?? []
    const flags = workflow.match(/include-hidden-files: true/gu) ?? []
    expect(flags).toHaveLength(uploads.length)
  })

  test("recovery is never automated in CI", () => {
    // reconcile observes, resolutions judge, retry re-attempts — all three are
    // human acts, and a workflow that could perform them would be deciding.
    for (const key of ["resolutions:", "reconcile:", "retry:"]) {
      expect([key, workflow.includes(key)]).toEqual([key, false])
    }
  })

  test("the recorded reviewer is probed, never a literal", () => {
    const reviewers = workflow.split("\n").filter((line) => line.trim().startsWith("reviewer:"))
    expect(reviewers).toHaveLength(2)
    for (const line of reviewers) {
      expect(line).toContain("${{ steps.reviewer.outputs.identity }}")
    }
    expect(workflow).toContain("identity=self:one-shot@github:")
    expect(workflow).toContain("identity=environment:${{ inputs.environment }}@github:")
  })

  test("only the publish job may write", () => {
    const publish = workflow.slice(workflow.indexOf("\n  publish:"))
    expect(publish).toContain("      contents: write\n      id-token: write\n")
    expect(workflow.slice(0, workflow.indexOf("\n  publish:"))).not.toContain("contents: write")
  })

  test("the consumer template and the README tell the same story", () => {
    expect(template).toContain("uses: mannyc2/ts-release-action/.github/workflows/release.yml@v0")
    const snippet = template.split("\n").filter((line) => !line.startsWith("#")).join("\n").trim()
    expect(read("README.md")).toContain(snippet)
  })
})
