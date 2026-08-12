import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"

const workflow = (name: string): string => readFileSync(`.github/workflows/${name}`, "utf8")

test("repository workflow topology has only CI and release", () => {
  expect(readdirSync(".github/workflows").filter((name) => name.endsWith(".yml")).sort()).toEqual(["ci.yml", "release.yml"])
})

test("CI delegates its required gate inventory to check:portable", () => {
  const ci = workflow("ci.yml")
  expect(ci.match(/bun run check:portable/gu)?.length).toBe(1)
  expect(ci).not.toMatch(/check:(?:versions|docs-claims|import-rules|tree-shaking|config-schema)/u)
})

test("release workflow is quarantined while the candidate is invalid", () => {
  const release = workflow("release.yml")
  expect(release).not.toContain("workflow_dispatch")
  expect(release).toContain("__ts_release_quarantined__")
  expect(release.match(/if: \$\{\{ false \}\}/gu)?.length).toBe(1)
  expect(release.match(/command: release/gu)?.length).toBe(1)
  expect(release).not.toMatch(/command: (?:prepare|inspect|publish)/u)
  expect(release).not.toContain("actions/upload-artifact@v4")
  expect(release).not.toContain("actions/download-artifact@v4")
  expect(release).toContain("persist-credentials: false")
  expect(release).not.toMatch(/\benvironment:/u)
  expect(release).not.toMatch(/\b(?:plan|apply|doctor|reviewer|review_id|run_id|scope|resume|through)\b/iu)
  expect(release).not.toMatch(/bun run build/u)
})

test("user templates preserve the same handoff, with review only on publish", () => {
  const automatic = workflowTemplate("release.yml")
  const reviewed = workflowTemplate("reviewed-release.yml")
  for (const value of [automatic, reviewed]) {
    expect(value).toContain("mannyc2/ts-release/apps/ts-release-action@v0.2.0")
    expect(value).not.toContain("__TS_RELEASE_ACTION_REF__")
    expect(value).not.toContain("actions/upload-artifact@v4")
    expect(value).not.toContain("actions/download-artifact@v4")
    expect(value).toContain("persist-credentials: false")
    expect(value).not.toContain("mannyc2/ts-release-action")
  }
  expect(automatic.match(/command: release/gu)?.length).toBe(1)
  expect(automatic).not.toMatch(/command: (?:prepare|inspect|publish)/u)
  expect(reviewed.match(/command: prepare/gu)?.length).toBe(1)
  expect(reviewed.match(/command: publish/gu)?.length).toBe(1)
  expect(reviewed).not.toContain("command: inspect")
  expect(reviewed).toContain("prepared: ${{ needs.prepare.outputs.prepared-ref }}")
  expect(automatic).not.toMatch(/\benvironment:/u)
  expect(reviewed.match(/\benvironment:/gu)?.length).toBe(1)
  const reviewedPublish = reviewed.slice(reviewed.indexOf("  publish:"))
  expect(reviewedPublish).toContain("environment: release")
})

const workflowTemplate = (name: string): string => readFileSync(`templates/github-actions/${name}`, "utf8")
