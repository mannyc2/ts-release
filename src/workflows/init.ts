import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { DEFAULT_CONFIG_PATH, RELEASE_CONFIG_SCHEMA_ID } from "../config/schema.js"
import {
  hasParentTraversal,
  isInsidePathBoundary,
  resolveWorkspacePath,
  validateWorkspaceWritePath
} from "../internal/workspace-path.js"
import { releaseConfigFields } from "./options.js"

export type * from "../types/effect-internal.js"

export const ReleaseInitTemplateName = Schema.Literals([
  "npm-only",
  "npm-github",
  "multi-target-homebrew",
  "multi-target-scoop"
])
export type ReleaseInitTemplateName = typeof ReleaseInitTemplateName.Type

export const ReleaseInitFormat = Schema.Literals(["json", "text"])
export type ReleaseInitFormat = typeof ReleaseInitFormat.Type

export class ReleaseInitOptions extends Schema.Class<ReleaseInitOptions>("ReleaseInitOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  template: Schema.optionalKey(ReleaseInitTemplateName),
  package: Schema.optionalKey(Schema.String),
  repo: Schema.optionalKey(Schema.String),
  workflow: Schema.optionalKey(Schema.String),
  tap: Schema.optionalKey(Schema.String),
  bucket: Schema.optionalKey(Schema.String),
  githubActions: Schema.optionalKey(Schema.Boolean),
  write: Schema.optionalKey(Schema.Boolean),
  overwrite: Schema.optionalKey(Schema.Boolean),
  format: Schema.optionalKey(ReleaseInitFormat)
}) {}

export interface ReleaseInitInput {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
  readonly template?: ReleaseInitTemplateName | undefined
  readonly package?: string | undefined
  readonly repo?: string | undefined
  readonly workflow?: string | undefined
  readonly tap?: string | undefined
  readonly bucket?: string | undefined
  readonly githubActions?: boolean | undefined
  readonly write?: boolean | undefined
  readonly overwrite?: boolean | undefined
  readonly format?: ReleaseInitFormat | undefined
}

export class ReleaseInitProposedFile extends Schema.Class<ReleaseInitProposedFile>("ReleaseInitProposedFile")({
  path: Schema.String,
  contents: Schema.String,
  alreadyExists: Schema.Boolean
}) {}

export class ReleaseInitPlan extends Schema.Class<ReleaseInitPlan>("ReleaseInitPlan")({
  schemaVersion: Schema.Literal("release-init/v1"),
  template: ReleaseInitTemplateName,
  files: Schema.Array(ReleaseInitProposedFile),
  nextCommand: Schema.String
}) {}

export class ReleaseInitWriteError extends Schema.TaggedErrorClass<ReleaseInitWriteError>()("ReleaseInitWriteError", {
  path: Schema.String,
  reason: Schema.String
}) {}

export const TS_RELEASE_ACTION_REFERENCE = "mannyc2/ts-release-action@v1"

const releaseInitOptionsFromInput = (
  input: ReleaseInitInput = {}
): ReleaseInitOptions =>
  ReleaseInitOptions.make({
    ...releaseConfigFields(input),
    ...(input.template === undefined ? {} : { template: input.template }),
    ...(input.package === undefined ? {} : { package: input.package }),
    ...(input.repo === undefined ? {} : { repo: input.repo }),
    ...(input.workflow === undefined ? {} : { workflow: input.workflow }),
    ...(input.tap === undefined ? {} : { tap: input.tap }),
    ...(input.bucket === undefined ? {} : { bucket: input.bucket }),
    ...(input.githubActions === undefined ? {} : { githubActions: input.githubActions }),
    ...(input.write === undefined ? {} : { write: input.write }),
    ...(input.overwrite === undefined ? {} : { overwrite: input.overwrite }),
    ...(input.format === undefined ? {} : { format: input.format })
  })

interface NormalizedInitOptions {
  readonly root: string
  readonly configPath: string
  readonly template: ReleaseInitTemplateName
  readonly packageName: string
  readonly repository: string
  readonly workflow: string
  readonly tap: string
  readonly bucket: string
  readonly githubActions: boolean
}

interface ProposedFileSpec {
  readonly path: string
  readonly contents: string
}

const initRoot = (path: Path.Path, options: ReleaseInitOptions): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

const normalizeOptions = (options: ReleaseInitOptions, root: string): NormalizedInitOptions => ({
  root,
  configPath: options.configPath ?? DEFAULT_CONFIG_PATH,
  template: options.template ?? "npm-only",
  packageName: options["package"] ?? "@scope/pkg",
  repository: options.repo ?? "owner/repo",
  workflow: options.workflow ?? "release.yml",
  tap: options.tap ?? "owner/homebrew-tap",
  bucket: options.bucket ?? "owner/scoop-bucket",
  githubActions: options.githubActions ?? false
})

const packageShortName = (packageName: string): string => {
  const withoutScope = packageName.includes("/") ? packageName.split("/").at(-1) ?? packageName : packageName
  const normalized = withoutScope.replace(/^@/, "").replace(/[^A-Za-z0-9-]+/g, "-")
  return normalized.length === 0 ? "pkg" : normalized
}

const configTargetNpm = (options: NormalizedInitOptions): Record<string, unknown> => ({
  _tag: "NpmRegistryTarget",
  id: "npm",
  registry: "https://registry.npmjs.org",
  packageName: options.packageName,
  packagePath: ".",
  trustedPublishing: {
    provider: "github-actions",
    workflow: options.workflow,
    packageExists: true,
    verifyPackageExists: true
  },
  access: "public",
  provenance: true,
  dryRunSupport: "native",
  mutability: "immutable",
  recovery: "publish-new-version"
})

const configTargetGitHub = (options: NormalizedInitOptions): Record<string, unknown> => ({
  _tag: "GitHubReleaseTarget",
  id: "github",
  repository: options.repository,
  tokenEnv: "GH_TOKEN",
  draft: true,
  prerelease: false,
  dryRunSupport: "simulated",
  mutability: "mutable-release",
  recovery: "delete-and-recreate"
})

const configTargetHomebrew = (options: NormalizedInitOptions): Record<string, unknown> => {
  const name = packageShortName(options.packageName)
  return {
    _tag: "HomebrewTapTarget",
    id: "homebrew",
    repository: options.tap,
    formulaName: name,
    formulaPath: `.release/generated/${name}.rb`,
    artifactId: "archive",
    homepage: `https://github.com/${options.repository}`,
    url: `https://github.com/${options.repository}/releases/download/v0.1.0/${name}-0.1.0.tgz`,
    installPath: `bin/${name}`,
    dryRunSupport: "simulated",
    mutability: "mutable-index",
    recovery: "manual"
  }
}

const configTargetScoop = (options: NormalizedInitOptions): Record<string, unknown> => {
  const name = packageShortName(options.packageName)
  return {
    _tag: "ScoopBucketTarget",
    id: "scoop",
    repository: options.bucket,
    manifestName: name,
    manifestPath: `.release/generated/${name}.json`,
    artifactId: "archive",
    homepage: `https://github.com/${options.repository}`,
    description: `Example Scoop manifest for ${name}`,
    license: "MIT",
    url: `https://github.com/${options.repository}/releases/download/v0.1.0/${name}-0.1.0.zip`,
    bin: `${name}.exe`,
    dryRunSupport: "simulated",
    mutability: "mutable-index",
    recovery: "manual"
  }
}

const releaseConfigForTemplate = (options: NormalizedInitOptions): Record<string, unknown> => {
  const name = packageShortName(options.packageName)
  const artifacts: Array<Record<string, unknown>> = [
    {
      id: "package",
      path: ".",
      format: "directory",
      consumers: ["npm"]
    }
  ]
  const targets: Array<Record<string, unknown>> = [configTargetNpm(options)]

  if (options.template !== "npm-only") {
    targets.push(configTargetGitHub(options))
  }
  if (options.template === "multi-target-homebrew") {
    artifacts.push({
      id: "archive",
      path: `artifacts/${name}-0.1.0.tgz`,
      format: "tarball",
      consumers: ["github", "homebrew"]
    })
    targets.push(configTargetHomebrew(options))
  }
  if (options.template === "multi-target-scoop") {
    artifacts.push({
      id: "archive",
      path: `artifacts/${name}-0.1.0.zip`,
      format: "zip",
      consumers: ["github", "scoop"]
    })
    targets.push(configTargetScoop(options))
  }

  return {
    $schema: RELEASE_CONFIG_SCHEMA_ID,
    identity: {
      name: options.packageName,
      version: "0.1.0",
      commit: "abc123",
      tag: "v0.1.0"
    },
    artifacts,
    targets,
    strict: true,
    evidenceDirectory: ".release/evidence/{version}"
  }
}

export const renderGithubActionsTrustedPublishingWorkflow = (configPath: string): string =>
  [
    "name: Release",
    "",
    "on:",
    "  workflow_dispatch:",
    "",
    "permissions:",
    "  contents: read",
    "",
    "jobs:",
    "  plan:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: oven-sh/setup-bun@v2",
    "      - run: bun install --frozen-lockfile",
    `      - uses: ${TS_RELEASE_ACTION_REFERENCE}`,
    "        with:",
    "          command: plan",
    `          config: ${configPath}`,
    "          format: markdown",
    "          write-step-summary: true",
    "          plan-path: release-plan.md",
    "      - uses: actions/upload-artifact@v4",
    "        if: always()",
    "        with:",
    "          name: release-plan",
    "          path: |",
    "            release-plan.md",
    "            .release/evidence/",
    "",
    "  execute:",
    "    needs: plan",
    "    runs-on: ubuntu-latest",
    "    environment: release",
    "    permissions:",
    "      contents: write",
    "      id-token: write",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: oven-sh/setup-bun@v2",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 22.14.0",
    "          registry-url: https://registry.npmjs.org",
    "      - run: npm install -g npm@^11.5.1",
    "      - run: bun install --frozen-lockfile",
    "      - run: bun run build",
    `      - uses: ${TS_RELEASE_ACTION_REFERENCE}`,
    "        with:",
    "          command: run",
    `          config: ${configPath}`,
    "          execute: true",
    "          approve-irreversible: true",
    "          write-step-summary: true",
    "      - uses: actions/upload-artifact@v4",
    "        if: always()",
    "        with:",
    "          name: release-evidence",
    "          path: .release/evidence/",
    ""
  ].join("\n")

const workflowConfigPath = (path: Path.Path, options: NormalizedInitOptions): string => {
  const root = path.resolve(options.root)
  const config = resolveWorkspacePath(path, options.root, options.configPath)
  const relative = path.relative(root, config).replaceAll("\\", "/")
  if (relative.length === 0 || relative === ".." || relative.startsWith("../")) {
    return path.basename(options.configPath)
  }
  return relative
}

const proposedFileSpecs = (path: Path.Path, options: NormalizedInitOptions): ReadonlyArray<ProposedFileSpec> => {
  const config = `${JSON.stringify(releaseConfigForTemplate(options), null, 2)}\n`
  const files: Array<ProposedFileSpec> = [
    {
      path: options.configPath,
      contents: config
    }
  ]
  if (options.githubActions) {
    files.push({
      path: `.github/workflows/${options.workflow}`,
      contents: renderGithubActionsTrustedPublishingWorkflow(workflowConfigPath(path, options))
    })
  }
  return files
}

const workspacePath = (
  path: Path.Path,
  root: string,
  pathName: string
): Effect.Effect<string, ReleaseInitWriteError> => {
  const result = validateWorkspaceWritePath(path, root, pathName)
  if (result._tag === "Ok") {
    return Effect.succeed(result.path)
  }
  return Effect.fail(
    ReleaseInitWriteError.make({
      path: pathName,
      reason: result.reason === "empty-or-parent-traversal"
        ? "Path must be non-empty and must not contain parent traversal."
        : "Path must resolve inside the workspace root."
    })
  )
}

const validateWorkflowFileName = (
  workflow: string
): Effect.Effect<void, ReleaseInitWriteError> => {
  const hasPathSeparator = workflow.includes("/") || workflow.includes("\\")
  const hasWorkflowExtension = workflow.endsWith(".yml") || workflow.endsWith(".yaml")
  if (workflow.trim().length > 0 && !hasPathSeparator && !hasParentTraversal(workflow) && hasWorkflowExtension) {
    return Effect.void
  }
  return Effect.fail(
    ReleaseInitWriteError.make({
      path: workflow,
      reason: "Workflow must be a .yml or .yaml filename without path separators."
    })
  )
}

const validateInitOptions = Effect.fn("workflows.init.validateInitOptions")(function*(
  path: Path.Path,
  options: NormalizedInitOptions
) {
  yield* workspacePath(path, options.root, options.configPath)
  if (!options.githubActions) {
    return
  }
  yield* validateWorkflowFileName(options.workflow)
  const workflowsRoot = resolveWorkspacePath(path, options.root, ".github/workflows")
  const workflowPath = yield* workspacePath(path, options.root, `.github/workflows/${options.workflow}`)
  if (isInsidePathBoundary(path, workflowsRoot, workflowPath)) {
    return
  }
  return yield* Effect.fail(
    ReleaseInitWriteError.make({
      path: options.workflow,
      reason: "Workflow output must resolve inside .github/workflows."
    })
  )
})

export const planReleaseInit = Effect.fn("workflows.init.planReleaseInit")(function*(
  input: ReleaseInitInput = {}
) {
  const options = releaseInitOptionsFromInput(input)
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const normalized = normalizeOptions(options, initRoot(path, options))
  yield* validateInitOptions(path, normalized)
  const files = yield* Effect.forEach(
    proposedFileSpecs(path, normalized),
    (file) =>
      workspacePath(path, normalized.root, file.path).pipe(
        Effect.flatMap((targetPath) =>
          fs.exists(targetPath).pipe(
            Effect.map((alreadyExists) =>
              ReleaseInitProposedFile.make({
                path: file.path,
                contents: file.contents,
                alreadyExists
              })
            )
          )
        )
      )
  )

  return ReleaseInitPlan.make({
    schemaVersion: "release-init/v1",
    template: normalized.template,
    files,
    nextCommand: `release plan --config ${normalized.configPath} --format text`
  })
})

const writeInitFile = Effect.fn("workflows.init.writeInitFile")(function*(
  root: string,
  file: ReleaseInitProposedFile,
  overwrite: boolean
) {
  if (file.alreadyExists && !overwrite) {
    return yield* Effect.fail(
      ReleaseInitWriteError.make({
        path: file.path,
        reason: "File already exists. Pass --overwrite to replace it."
      })
    )
  }
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const outputPath = yield* workspacePath(path, root, file.path)
  yield* fs.makeDirectory(path.dirname(outputPath), { recursive: true })
  yield* fs.writeFileString(outputPath, file.contents)
})

export const runReleaseInit = Effect.fn("workflows.init.runReleaseInit")(function*(
  input: ReleaseInitInput = {}
) {
  const options = releaseInitOptionsFromInput(input)
  const path = yield* Path.Path
  const normalized = normalizeOptions(options, initRoot(path, options))
  const plan = yield* planReleaseInit(options)
  if (options.write !== true) {
    return plan
  }
  yield* Effect.forEach(
    plan.files,
    (file) => writeInitFile(normalized.root, file, options.overwrite === true),
    { discard: true }
  )
  return plan
})

export const renderReleaseInitJson = (plan: ReleaseInitPlan): string =>
  `${JSON.stringify(plan, null, 2)}\n`

export const renderReleaseInitText = (plan: ReleaseInitPlan): string => {
  const lines: Array<string> = [
    `template: ${plan.template}`,
    "files:"
  ]
  for (const file of plan.files) {
    lines.push(`  - ${file.path}${file.alreadyExists ? " (exists)" : " (new)"}`)
    lines.push(`--- ${file.path}`)
    lines.push(file.contents.trimEnd())
  }
  lines.push(`next: ${plan.nextCommand}`)
  return `${lines.join("\n")}\n`
}

export const renderReleaseInitPlan = (plan: ReleaseInitPlan, format: ReleaseInitFormat = "text"): string =>
  format === "json" ? renderReleaseInitJson(plan) : renderReleaseInitText(plan)

export const plan = planReleaseInit
export const run = runReleaseInit
export const renderPlan = renderReleaseInitPlan
