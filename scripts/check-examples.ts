import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import { makeBunReleaseWorkflowRuntimeLayer } from "../apps/release-ts/src/runtime.js"
import { parseReleaseIntent } from "../src/config/load.js"
import { RELEASE_CONFIG_SCHEMA_ID, type ReleaseIntent } from "../src/config/schema.js"
import { planRelease, renderReleasePlan } from "../src/engine/engine.js"

const root = process.cwd()
const expectedSnippets = new Map<string, ReadonlyArray<string>>([
  ["agent-plugin", [
    "surfaces: 3",
    "  - catalog operations=5",
    "  - file operations=1",
    "  - github operations=3",
    "archive:plugin",
    "checksum:write",
    "catalog:claude-marketplace:render",
    "github:github-release-create",
    "catalog:claude-marketplace:pull-request"
  ]],
  ["github-release", [
    "surfaces: 1",
    "  - github operations=",
    "github:github-release-dry-run",
    "github:github-release-create"
  ]],
  ["homebrew-tap", [
    "surfaces: 1",
    "  - homebrew operations=",
    "homebrew:homebrew-render-formula",
    "write: .release/generated/"
  ]],
  ["multi-target", [
    "surfaces: 3",
    "  - github operations=",
    "  - homebrew operations=",
    "  - npm operations=",
    "approval: execute"
  ]],
  ["npm-only", [
    "surfaces: 1",
    "  - npm operations=",
    "npm:npm-pack-dry-run",
    "npm:npm-publish"
  ]],
  ["npm-first-publish", [
    "surfaces: 1",
    "  - npm operations=",
    "npm:npm-whoami",
    "npm:npm-publish"
  ]],
  ["pypi-registry", [
    "surfaces: 1",
    "  - pypi operations=",
    "pypi:twine-check",
    "pypi:twine-upload",
    "python -m twine upload --non-interactive --repository-url https://test.pypi.org/legacy/"
  ]],
  ["portable-cli", [
    "surfaces: 5",
    "  - github operations=",
    "  - homebrew operations=",
    "  - npm operations=",
    "  - pypi operations=",
    "  - scoop operations=",
    "github:github-release-create",
    "homebrew:homebrew-render-formula",
    "scoop:scoop-render-manifest",
    "pypi:twine-upload"
  ]],
  ["scoop-bucket", [
    "surfaces: 1",
    "  - scoop operations=",
    "scoop:scoop-render-manifest",
    "scoop:scoop-push",
    "write: .release/generated/"
  ]]
])

const expectedTemplateSurfaces = new Map<string, ReadonlyArray<string>>([
  ["bun-cli-github", ["github", "npm"]],
  ["multi-target-homebrew", ["github", "homebrew", "npm"]],
  ["multi-target-scoop", ["github", "npm", "scoop"]],
  ["npm-github", ["github", "npm"]],
  ["npm-only", ["npm"]],
  ["portable-cli", [
    "github",
    "homebrew",
    "npm",
    "pypi",
    "scoop"
  ]]
])

interface WorkflowTemplateExpectation {
  readonly path: string
  readonly actionFirst: boolean
  readonly hasExecuteJob: boolean
  readonly trustedPublishing: boolean
}

const workflowTemplates: ReadonlyArray<WorkflowTemplateExpectation> = [
  {
    path: "github-actions/plan-only.yml",
    actionFirst: true,
    hasExecuteJob: false,
    trustedPublishing: false
  },
  {
    path: "github-actions/plan-and-approved-execute.yml",
    actionFirst: true,
    hasExecuteJob: true,
    trustedPublishing: false
  },
  {
    path: "github-actions/trusted-publishing.yml",
    actionFirst: true,
    hasExecuteJob: true,
    trustedPublishing: true
  }
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const enabledPublishSurfaces = (publish: ReleaseIntent["publish"]): ReadonlyArray<string> => {
  const surfaces: Array<string> = []
  if (publish.github !== undefined) {
    surfaces.push("github")
  }
  if (publish.homebrew !== undefined) {
    surfaces.push("homebrew")
  }
  if (publish.npm !== undefined) {
    surfaces.push("npm")
  }
  if (publish.pypi !== undefined) {
    surfaces.push("pypi")
  }
  if (publish.scoop !== undefined) {
    surfaces.push("scoop")
  }
  return surfaces
}

const readExampleNames = Effect.fn("scripts.readExampleNames")(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const examplesRoot = path.join(root, "examples")
  const entries = yield* fs.readDirectory(examplesRoot)
  const names: Array<string> = []
  for (const entry of entries) {
    const info = yield* fs.stat(path.join(examplesRoot, entry))
    if (info.type === "Directory") {
      names.push(entry)
    }
  }
  return names.sort()
})

const runExamplePlan = Effect.fn("scripts.runExamplePlan")(function*(
  exampleName: string
) {
  const path = yield* Path.Path
  const exampleDirectory = path.join(root, "examples", exampleName)
  const plan = yield* planRelease({
      workspace: exampleDirectory,
      config: "release.config.json"
    }).pipe(
    Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root: exampleDirectory }))
  )
  const rendered = renderReleasePlan(plan, "text")
  for (const snippet of expectedSnippets.get(exampleName) ?? []) {
    if (!rendered.includes(snippet)) {
      return yield* Effect.fail(new Error(`Example ${exampleName} plan is missing expected snippet: ${snippet}`))
    }
  }
})

const readTemplateConfig = Effect.fn("scripts.readTemplateConfig")(function*(templateName: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return yield* fs.readFileString(path.join(root, "templates", templateName, "release.config.json"))
})

const readExampleConfig = Effect.fn("scripts.readExampleConfig")(function*(exampleName: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return yield* fs.readFileString(path.join(root, "examples", exampleName, "release.config.json"))
})

const checkTrustedPublishingNpmPolicy = Effect.fn("scripts.checkTrustedPublishingNpmPolicy")(function*(
  owner: string,
  target: Record<string, unknown>
) {
  if (target.trustedPublishing === undefined) {
    return
  }
  if (!isRecord(target.trustedPublishing)) {
    return yield* Effect.fail(new Error(`${owner} npm trustedPublishing must be an object`))
  }
  if (target.trustedPublishing.verifyPackageExists !== true) {
    return yield* Effect.fail(new Error(`${owner} npm trustedPublishing must set verifyPackageExists to true`))
  }
  if (target.access !== "public") {
    return yield* Effect.fail(new Error(`${owner} npm trusted-publishing target must set access to public`))
  }
  if (target.provenance !== true) {
    return yield* Effect.fail(new Error(`${owner} npm trusted-publishing target must enable provenance`))
  }
})

const checkConfigNpmPolicy = Effect.fn("scripts.checkConfigNpmPolicy")(function*(
  owner: string,
  parsed: Record<string, unknown>
) {
  const publish = parsed.publish
  if (!isRecord(publish)) {
    return yield* Effect.fail(new Error(`${owner} config must include a publish object`))
  }
  const npm = publish.npm
  if (isRecord(npm)) {
    yield* checkTrustedPublishingNpmPolicy(owner, npm)
  }
})

const checkExampleConfigPolicy = Effect.fn("scripts.checkExampleConfigPolicy")(function*(exampleName: string) {
  const contents = yield* readExampleConfig(exampleName)
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) => cause
  })
  if (!isRecord(parsed)) {
    return yield* Effect.fail(new Error(`Example ${exampleName} config must parse to an object`))
  }
  yield* checkConfigNpmPolicy(`Example ${exampleName}`, parsed)
})

const checkTemplateConfig = Effect.fn("scripts.checkTemplateConfig")(function*(templateName: string) {
  const contents = yield* readTemplateConfig(templateName)
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) => cause
  })
  if (!isRecord(parsed)) {
    return yield* Effect.fail(new Error(`Template ${templateName} config must parse to an object`))
  }
  if (parsed.$schema !== RELEASE_CONFIG_SCHEMA_ID) {
    return yield* Effect.fail(new Error(`Template ${templateName} is missing the release config $schema URL`))
  }
  yield* checkConfigNpmPolicy(`Template ${templateName}`, parsed)

  const path = yield* Path.Path
  const intent = yield* parseReleaseIntent(contents, path.join("templates", templateName, "release.config.json"))
  const actualSurfaces = [...enabledPublishSurfaces(intent.publish)].sort()
  const expected = expectedTemplateSurfaces.get(templateName) ?? []
  const expectedSurfaces = [...expected].sort()
  if (actualSurfaces.join(",") !== expectedSurfaces.join(",")) {
    return yield* Effect.fail(
      new Error(
        `Template ${templateName} publish surfaces ${actualSurfaces.join(", ")} did not match ${
          expectedSurfaces.join(", ")
        }`
      )
    )
  }
})

const checkWorkflowTemplate = Effect.fn("scripts.checkWorkflowTemplate")(function*(
  template: WorkflowTemplateExpectation
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const contents = yield* fs.readFileString(path.join(root, "templates", template.path))
  const snippets = [
    "  plan:",
    "actions/setup-node@v4",
    "npm ci",
    "npm run build --if-present",
    "if: always()",
    "release-plan.md"
  ]
  if (template.hasExecuteJob) {
    snippets.push("  execute:", "environment: release", "contents: write")
  }
  if (template.trustedPublishing) {
    snippets.push("id-token: write")
  }
  if (template.actionFirst) {
    snippets.push("uses: mannyc2/ts-release-action@v1", "command: plan", "format: markdown")
  }
  if (template.hasExecuteJob && template.actionFirst) {
    snippets.push("command: release", "execute: true", "approve-publish: true")
  }
  for (const snippet of snippets) {
    if (!contents.includes(snippet)) {
      return yield* Effect.fail(new Error(`Workflow template ${template.path} is missing expected snippet: ${snippet}`))
    }
  }
  const executeIndex = contents.indexOf("  execute:")
  const planJob = executeIndex < 0
    ? contents.slice(contents.indexOf("  plan:"))
    : contents.slice(contents.indexOf("  plan:"), executeIndex)
  if (planJob.includes("--execute") || planJob.includes("execute: true") || planJob.includes("command: release")) {
    return yield* Effect.fail(new Error(`Workflow template ${template.path} plan job must not execute releases`))
  }
  if (contents.includes("NPM_TOKEN")) {
    return yield* Effect.fail(new Error(`Workflow template ${template.path} must not mention NPM_TOKEN`))
  }
  if (contents.includes("oven-sh/setup-bun")) {
    return yield* Effect.fail(new Error(`Workflow template ${template.path} must not require Bun setup`))
  }
})

const main = Effect.fn("scripts.checkExamples")(function*() {
  const exampleNames = yield* readExampleNames()
  yield* Effect.forEach(
    exampleNames,
    runExamplePlan,
    { discard: true }
  )
  yield* Effect.forEach(
    exampleNames,
    checkExampleConfigPolicy,
    { discard: true }
  )
  const templateNames = [...expectedTemplateSurfaces.keys()].sort()
  yield* Effect.forEach(
    templateNames,
    checkTemplateConfig,
    { discard: true }
  )
  yield* Effect.forEach(
    workflowTemplates,
    checkWorkflowTemplate,
    { discard: true }
  )
  return {
    examples: exampleNames.length,
    templates: templateNames.length,
    workflows: workflowTemplates.length
  }
})

BunRuntime.runMain(
  main().pipe(
    Effect.tap((checked) =>
      Effect.sync(() =>
        console.log(
          `Checked ${checked.examples} release examples, ${checked.templates} release templates, and ${checked.workflows} workflow templates`
        )
      )
    ),
    Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root })),
    Effect.provide(BunServices.layer)
  )
)
