// Stages the standalone `mannyc2/ts-release-action` repository from this
// monorepo. Consumers pin `uses: mannyc2/ts-release-action@v0`; the code they
// get must be THIS repo's action, byte for byte, which is why the mirror is
// generated rather than maintained.
//
// This script performs ZERO network operations and creates nothing outside the
// gitignored .release/ tree. Creating the repository, committing, tagging, and
// pushing are OPERATOR actions — it prints them and stops.
import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { cwd, exit } from "node:process"

const root = cwd()
const actionRoot = join(root, "apps", "ts-release-action")
const mirrorRoot = join(root, ".release", "action-mirror")
const actionRepository = "mannyc2/ts-release-action"

interface Entry {
  readonly name: string
  readonly description: string
  readonly required?: string
  readonly default?: string
}

// The repo reads action.yml with a line scanner rather than a YAML dependency
// (test/action-command.test.ts does the same); the manifest is hand-written in
// exactly this shape and the gate above keeps it there.
const readBlock = (manifest: string, block: "inputs" | "outputs"): ReadonlyArray<Entry> => {
  const lines = manifest.split("\n")
  const start = lines.indexOf(`${block}:`)
  if (start < 0) throw new Error(`action.yml has no ${block} block.`)
  const entries: Array<Entry> = []
  let current: { name: string; fields: Record<string, string> } | undefined
  const flush = (): void => {
    if (current === undefined) return
    const description = current.fields.description
    if (description === undefined) throw new Error(`action.yml ${block}.${current.name} has no description.`)
    entries.push({
      name: current.name,
      description,
      ...(current.fields.required === undefined ? {} : { required: current.fields.required }),
      ...(current.fields.default === undefined ? {} : { default: current.fields.default })
    })
  }
  for (const line of lines.slice(start + 1)) {
    if (line.trim().length > 0 && !line.startsWith(" ")) break
    const entry = /^ {2}([a-z0-9_-]+):\s*$/u.exec(line)
    if (entry !== null) {
      flush()
      current = { name: entry[1]!, fields: {} }
      continue
    }
    const field = /^ {4}([a-z]+):\s*(.*)$/u.exec(line)
    if (field !== null && current !== undefined) {
      current.fields[field[1]!] = field[2]!.replace(/^"(.*)"$/u, "$1").trim()
    }
  }
  flush()
  if (entries.length === 0) throw new Error(`action.yml ${block} block is empty.`)
  return entries
}

const table = (
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>
): string =>
  [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n")

const code = (value: string | undefined): string => value === undefined || value === "" ? "—" : `\`${value}\``

const mirrorReadme = (manifest: string, version: string, commit: string): string => {
  const inputs = readBlock(manifest, "inputs")
  const outputs = readBlock(manifest, "outputs")
  return `# ts-release-action

Plan, review, and apply canonical [ts-release](https://github.com/mannyc2/ts-release)
plans from a GitHub workflow.

<!-- GENERATED FILE. Mirrored from mannyc2/ts-release@${commit} by
scripts/sync-action-mirror.ts — do not edit here; edits are overwritten on the
next sync. -->

Version ${version}. Pin \`@v0\` for the floating 0.x major, or \`@v${version}\`
for an exact release.

## What it does

One action, three commands. \`plan\` compiles a config into canonical plan
bytes with a \`plan_id\`. \`apply\` executes a plan against a run ledger, and
refuses to move without the review confirmations the plan requires. \`doctor\`
reports on a plan without touching anything.

Planning never happens during apply, and apply never reads a config: the plan
bytes reviewed are the bytes executed.

## Inputs

${table(["Input", "Description", "Required", "Default"], inputs.map((input) => [
    `\`${input.name}\``,
    input.description,
    input.required === "true" ? "yes" : "no",
    code(input.default)
  ]))}

## Outputs

${table(["Output", "Description"], outputs.map((output) => [`\`${output.name}\``, output.description]))}

## Usage

The staged shape: plan on push, approve execution in a protected environment,
approve publication in a second one. Each stage confirms the review id the
previous stage produced, so an unreviewed plan cannot reach the wire.

\`\`\`yaml
name: Release
on:
  workflow_dispatch:
permissions:
  contents: write
  id-token: write

jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      plan_id: \${{ steps.plan.outputs.plan_id }}
      execution_review_id: \${{ steps.review.outputs.execution_review_id }}
    steps:
      - uses: actions/checkout@v4
      - id: plan
        uses: ${actionRepository}@v0
        with: { command: plan, config: release.config.json, plan-path: release-plan.json }
      - id: review
        uses: ${actionRepository}@v0
        with:
          command: apply
          review-only: "true"
          plan-path: release-plan.json
          plan-id: \${{ steps.plan.outputs.plan_id }}
          scope: all
      - uses: actions/upload-artifact@v4
        with: { name: release-plan, path: release-plan.json }

  materialize:
    needs: plan
    runs-on: ubuntu-latest
    environment: release
    outputs:
      publish_review_id: \${{ steps.materialize.outputs.publish_review_id }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: release-plan }
      - id: materialize
        uses: ${actionRepository}@v0
        with:
          command: apply
          plan-path: release-plan.json
          plan-id: \${{ needs.plan.outputs.plan_id }}
          new-run: .release/runs
          through: validate
          scope: all
          confirm-execution: \${{ needs.plan.outputs.execution_review_id }}
          reviewer: \${{ github.actor }}

  publish:
    needs: [plan, materialize]
    runs-on: ubuntu-latest
    environment: release
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: release-plan }
      - uses: ${actionRepository}@v0
        with:
          command: apply
          plan-path: release-plan.json
          plan-id: \${{ needs.plan.outputs.plan_id }}
          resume: .release/runs
          through: verify
          confirm-publish: \${{ needs.materialize.outputs.publish_review_id }}
          reviewer: \${{ github.actor }}
\`\`\`

## Documentation

Configuration, the plan format, and the review model live in the
[ts-release repository](https://github.com/mannyc2/ts-release).

## License

MIT — see LICENSE.
`
}

const gitOutput = (argv: ReadonlyArray<string>): string => {
  const result = spawnSync("git", [...argv], { cwd: root, encoding: "utf8", stdio: "pipe" })
  if (result.status !== 0) throw new Error(`git ${argv.join(" ")} failed: ${result.stderr?.trim() ?? ""}`)
  return result.stdout.trim()
}

const copyInto = (from: string, to: string): void => {
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
}

export const syncActionMirror = (): { readonly version: string; readonly commit: string } => {
  // Writing outside a gitignored path would stage a second copy of the action
  // into THIS repository — the one thing a mirror must never do.
  if (spawnSync("git", ["check-ignore", relative(root, mirrorRoot)], { cwd: root }).status !== 0) {
    throw new Error(`${relative(root, mirrorRoot)} is not gitignored; refusing to stage the mirror inside the repo.`)
  }
  const freshness = spawnSync("bun", ["run", "check:action-bundle"], { cwd: root, encoding: "utf8", stdio: "pipe" })
  if (freshness.status !== 0) {
    throw new Error([
      "The Action bundle is stale, so the mirror would ship code that is not this repo's.",
      freshness.stdout?.trim(),
      freshness.stderr?.trim()
    ].filter((line) => line !== undefined && line.length > 0).join("\n"))
  }

  const manifest = readFileSync(join(actionRoot, "action.yml"), "utf8")
  const version = String(
    (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: unknown }).version
  )
  const commit = gitOutput(["rev-parse", "HEAD"])

  rmSync(mirrorRoot, { recursive: true, force: true })
  mkdirSync(mirrorRoot, { recursive: true })
  // Table-driven so plan 205's reusable workflow is one more entry here.
  const files: ReadonlyArray<readonly [string, string]> = [
    [join(actionRoot, "action.yml"), join(mirrorRoot, "action.yml")],
    [join(actionRoot, "dist", "index.js"), join(mirrorRoot, "dist", "index.js")],
    [join(root, "LICENSE"), join(mirrorRoot, "LICENSE")]
  ]
  for (const [from, to] of files) {
    if (!existsSync(from)) throw new Error(`Mirror source ${relative(root, from)} is missing.`)
    copyInto(from, to)
  }
  writeFileSync(join(mirrorRoot, "README.md"), mirrorReadme(manifest, version, commit))
  return { version, commit }
}

if (import.meta.main) {
  try {
    const { commit, version } = syncActionMirror()
    console.log(`Staged ${actionRepository} ${version} at ${relative(root, mirrorRoot)} from ${commit}.`)
    console.log([
      "",
      "OPERATOR — this script runs none of the following:",
      "",
      `  gh repo create ${actionRepository} --public \\`,
      `    --description "Plan, review, and apply canonical ts-release plans."`,
      `  cd ${relative(root, mirrorRoot)}`,
      "  git init -b main && git add -A",
      `  git commit -m "ts-release-action ${version} (mirror of mannyc2/ts-release@${commit})"`,
      `  git remote add origin git@github.com:${actionRepository}.git`,
      `  git tag v${version} && git tag -f v0`,
      "  git push -u origin main && git push --tags --force origin",
      ""
    ].join("\n"))
  } catch (cause) {
    console.error(String(cause instanceof Error ? cause.message : cause))
    exit(1)
  }
}
