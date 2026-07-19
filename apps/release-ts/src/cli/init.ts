import { fileURLToPath } from "node:url"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { decodeReleaseIntent, parseReleaseIntent } from "../../../../src/config/load.js"
import { DEFAULT_CONFIG_PATH } from "../../../../src/config/schema.js"
import {
  hasParentTraversal,
  resolveWorkspacePath,
  resolveWorkspaceWritePathEffect
} from "../../../../src/internal/workspace-path.js"

export const ReleaseInitTemplateName = Schema.Literals([
  "npm-only", "npm-github", "bun-cli-github", "portable-cli", "multi-target-homebrew", "multi-target-scoop"
])
export type ReleaseInitTemplateName = typeof ReleaseInitTemplateName.Type

export const ReleaseInitFormat = Schema.Literals(["json", "text"])
export type ReleaseInitFormat = typeof ReleaseInitFormat.Type

export const ReleaseInitPackageManager = Schema.Literals(["bun", "npm", "pnpm", "yarn"])
export type ReleaseInitPackageManager = typeof ReleaseInitPackageManager.Type

export class ReleaseInitOptions extends Schema.Class<ReleaseInitOptions>("ReleaseInitOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  template: Schema.optionalKey(ReleaseInitTemplateName),
  package: Schema.optionalKey(Schema.String),
  repo: Schema.optionalKey(Schema.String),
  workflow: Schema.optionalKey(Schema.String),
  tap: Schema.optionalKey(Schema.String),
  bucket: Schema.optionalKey(Schema.String),
  binaryName: Schema.optionalKey(Schema.String),
  entrypoint: Schema.optionalKey(Schema.String),
  pypiPackage: Schema.optionalKey(Schema.String),
  pypiModule: Schema.optionalKey(Schema.String),
  consoleScript: Schema.optionalKey(Schema.String),
  githubActions: Schema.optionalKey(Schema.Boolean),
  packageManager: Schema.optionalKey(ReleaseInitPackageManager),
  installCommand: Schema.optionalKey(Schema.String),
  buildCommand: Schema.optionalKey(Schema.String),
  write: Schema.optionalKey(Schema.Boolean),
  overwrite: Schema.optionalKey(Schema.Boolean),
  format: Schema.optionalKey(ReleaseInitFormat)
}) {}

export type ReleaseInitOptionsInput = NonNullable<ConstructorParameters<typeof ReleaseInitOptions>[0]>

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

type JsonRecord = Record<string, unknown>

const packageRoot = fileURLToPath(new URL("../../../../", import.meta.url))

const initRoot = (path: Path.Path, options: ReleaseInitOptionsInput): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

const installCommandByPackageManager: Record<ReleaseInitPackageManager, string> = {
  bun: "bun install --frozen-lockfile",
  npm: "npm ci",
  pnpm: "corepack enable && pnpm install --frozen-lockfile",
  yarn: "corepack enable && yarn install --immutable"
}

const buildCommandByPackageManager: Record<ReleaseInitPackageManager, string> = {
  bun: "bun run build",
  npm: "npm run build --if-present",
  pnpm: "pnpm run build --if-present",
  yarn: "yarn run build"
}

const packageShortName = (packageName: string): string => {
  const withoutScope = packageName.includes("/") ? packageName.split("/").at(-1) ?? packageName : packageName
  const normalized = withoutScope.replace(/^@/, "").replace(/[^A-Za-z0-9-]+/g, "-")
  return normalized.length === 0 ? "pkg" : normalized
}

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed
}

const pythonModuleName = (value: string): string => {
  const normalized = packageShortName(value).replace(/-/g, "_")
  return normalized.length === 0 ? "pkg" : normalized
}

const pythonDistributionName = (value: string): string =>
  value.replace(/[-.]+/g, "_")

const normalizeOptions = (options: ReleaseInitOptionsInput, root: string) => {
  const packageManager = options.packageManager ?? "bun"
  const packageName = options["package"] ?? "@scope/pkg"
  const binaryName = nonEmpty(options.binaryName) ?? packageShortName(packageName)
  const pypiPackage = nonEmpty(options.pypiPackage)
  const pypiModule = nonEmpty(options.pypiModule)
  return {
    root,
    configPath: options.configPath ?? DEFAULT_CONFIG_PATH,
    template: options.template ?? "npm-only",
    packageName,
    repository: options.repo ?? "owner/repo",
    workflow: options.workflow ?? "release.yml",
    tap: options.tap ?? "owner/homebrew-tap",
    bucket: options.bucket ?? "owner/scoop-bucket",
    binaryName,
    entrypoint: nonEmpty(options.entrypoint) ?? "src/cli.ts",
    pypiPackage,
    pypiModule: pypiPackage === undefined && pypiModule === undefined
      ? undefined
      : pypiModule ?? pythonModuleName(pypiPackage ?? binaryName),
    consoleScript: nonEmpty(options.consoleScript) ?? binaryName,
    githubActions: options.githubActions ?? false,
    packageManager,
    installCommand: (options.installCommand ?? installCommandByPackageManager[packageManager]).trim(),
    buildCommand: (options.buildCommand ?? buildCommandByPackageManager[packageManager]).trim()
  }
}

type NormalizedInitOptions = ReturnType<typeof normalizeOptions>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const requireRecord = (
  value: unknown,
  pathName: string
): Effect.Effect<JsonRecord, ReleaseInitWriteError> => isRecord(value)
  ? Effect.succeed(value)
  : Effect.fail(ReleaseInitWriteError.make({
    path: pathName, reason: "Template config did not contain the expected object shape."
  }))

const templatePath = (path: Path.Path, ...segments: ReadonlyArray<string>): string =>
  path.join(packageRoot, "templates", ...segments)

const initWritePath = (path: Path.Path, root: string, pathName: string) =>
  resolveWorkspaceWritePathEffect(path, root, pathName,
    (errorPath, reason) => ReleaseInitWriteError.make({ path: errorPath, reason }))

const substituteTemplate = (value: unknown, replacements: ReadonlyMap<string, string>): unknown => {
  if (typeof value === "string") {
    const tokens = [...replacements.keys()].sort((left, right) => right.length - left.length)
    const pattern = new RegExp(tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g")
    return value.replace(pattern, (token) => replacements.get(token) ?? token)
  }
  if (Array.isArray(value)) return value.map((item) => substituteTemplate(item, replacements))
  if (isRecord(value)) return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, substituteTemplate(item, replacements)])
  )
  return value
}

const patchReleaseConfig = Effect.fn("cli.init.patchReleaseConfig")(function*(
  templateConfig: JsonRecord,
  options: NormalizedInitOptions
) {
  const name = options.template === "portable-cli" ? options.binaryName : packageShortName(options.packageName)
  const config = yield* requireRecord(substituteTemplate(templateConfig, new Map([
    ["@scope/pkg", options.packageName], ["owner/homebrew-tap", options.tap],
    ["owner/scoop-bucket", options.bucket], ["owner/repo", options.repository],
    ["release.yml", options.workflow], ["src/cli.ts", options.entrypoint], ["pkg", name]
  ])), "template")
  if (options.template === "portable-cli" && Array.isArray(config.pypiWheel)) {
    const packageName = options.pypiPackage ?? options.binaryName
    const moduleName = options.pypiModule ?? pythonModuleName(packageName)
    for (const value of config.pypiWheel) {
      const wheel = yield* requireRecord(value, "template.pypiWheel")
      const binary = yield* requireRecord(Array.isArray(wheel.binaries) ? wheel.binaries[0] : undefined, "template.pypiWheel.binaries")
      wheel.packageName = packageName
      wheel.moduleName = moduleName
      wheel.consoleScript = options.consoleScript
      wheel.path = `artifacts/${pythonDistributionName(packageName)}-{version}-${wheel.wheelTag}.whl`
      binary.wheelPath = `${moduleName}/bin/${options.binaryName}-${binary.os}-${binary.arch}${binary.os === "windows" ? ".exe" : ""}`
    }
  }
  return config
})

const renderReleaseConfigFromTemplate = Effect.fn("cli.init.renderReleaseConfigFromTemplate")(function*(
  options: NormalizedInitOptions
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const pathName = templatePath(path, options.template, DEFAULT_CONFIG_PATH)
  const contents = yield* fs.readFileString(pathName)
  const templateConfig = yield* Effect.try({
    try: () => JSON.parse(contents) as unknown,
    catch: () => ReleaseInitWriteError.make({ path: pathName, reason: "Template config is not valid JSON." })
  }).pipe(Effect.flatMap((parsed) => requireRecord(parsed, pathName)))
  yield* decodeReleaseIntent(templateConfig, pathName)
  const config = yield* patchReleaseConfig(templateConfig, options)
  const rendered = `${JSON.stringify(config, null, 2)}\n`
  yield* parseReleaseIntent(rendered, options.configPath)
  return rendered
})

export const renderGithubActionsTrustedPublishingWorkflow = Effect.fn(
  "cli.init.renderGithubActionsTrustedPublishingWorkflow"
)(function*(configPath: string, setup: Pick<NormalizedInitOptions, "packageManager" | "installCommand" | "buildCommand">) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const template = yield* fs.readFileString(templatePath(path, "github-actions", "release.yml"))
  const lines = template.split("\n").flatMap((line) => {
    if (line === "{{setup-bun}}") {
      return setup.packageManager === "bun" ? ["      - uses: oven-sh/setup-bun@v2"] : []
    }
    return [
      line
        .replaceAll("{{config}}", configPath)
        .replaceAll("{{install}}", setup.installCommand)
        .replaceAll("{{build}}", setup.buildCommand)
    ]
  })
  return lines.join("\n")
})

const workflowConfigPath = (path: Path.Path, options: NormalizedInitOptions): string => {
  const root = path.resolve(options.root)
  const config = resolveWorkspacePath(path, options.root, options.configPath)
  const relative = path.relative(root, config).replaceAll("\\", "/")
  if (relative.length === 0 || relative === ".." || relative.startsWith("../")) {
    return path.basename(options.configPath)
  }
  return relative
}

const validateInitField = (valid: boolean, path: string, reason: string): Effect.Effect<void, ReleaseInitWriteError> =>
  valid ? Effect.void : Effect.fail(ReleaseInitWriteError.make({ path, reason }))

const validateWorkflowFileName = (workflow: string): Effect.Effect<void, ReleaseInitWriteError> => {
  const hasPathSeparator = workflow.includes("/") || workflow.includes("\\")
  const hasWorkflowExtension = workflow.endsWith(".yml") || workflow.endsWith(".yaml")
  return validateInitField(workflow.trim().length > 0 && !hasPathSeparator &&
    !hasParentTraversal(workflow) && hasWorkflowExtension, workflow,
    "Workflow must be a .yml or .yaml filename without path separators.")
}

const validateWorkflowCommand = (
  field: string,
  command: string
): Effect.Effect<void, ReleaseInitWriteError> => {
  return validateInitField(command.trim().length > 0 && !command.includes("\n") && !command.includes("\r"),
    field, "Command overrides must be single non-empty lines.")
}

export const planReleaseInit = Effect.fn("cli.init.planReleaseInit")(function*(
  input: ReleaseInitOptionsInput = {}
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const normalized = normalizeOptions(input, initRoot(path, input))
  yield* initWritePath(path, normalized.root, normalized.configPath)
  yield* validateWorkflowCommand("install-command", normalized.installCommand)
  yield* validateWorkflowCommand("build-command", normalized.buildCommand)
  if (normalized.githubActions) {
    yield* validateWorkflowFileName(normalized.workflow)
    yield* initWritePath(path, normalized.root, `.github/workflows/${normalized.workflow}`)
  }
  const specs = [{ path: normalized.configPath, contents: yield* renderReleaseConfigFromTemplate(normalized) }]
  if (normalized.githubActions) specs.push({
    path: `.github/workflows/${normalized.workflow}`,
    contents: yield* renderGithubActionsTrustedPublishingWorkflow(workflowConfigPath(path, normalized), {
      packageManager: normalized.packageManager,
      installCommand: normalized.installCommand,
      buildCommand: normalized.buildCommand
    })
  })
  const files = yield* Effect.forEach(
    specs,
    (file) =>
      initWritePath(path, normalized.root, file.path).pipe(
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

export const runReleaseInit = Effect.fn("cli.init.runReleaseInit")(function*(
  input: ReleaseInitOptionsInput = {}
) {
  const path = yield* Path.Path
  const normalized = normalizeOptions(input, initRoot(path, input))
  const plan = yield* planReleaseInit(input)
  if (input.write !== true) {
    return plan
  }
  const fs = yield* FileSystem.FileSystem
  yield* Effect.forEach(
    plan.files,
    (file) => Effect.gen(function*() {
      if (file.alreadyExists && input.overwrite !== true) return yield* Effect.fail(ReleaseInitWriteError.make({
        path: file.path, reason: "File already exists. Pass --overwrite to replace it."
      }))
      const outputPath = yield* initWritePath(path, normalized.root, file.path)
      yield* fs.makeDirectory(path.dirname(outputPath), { recursive: true })
      yield* fs.writeFileString(outputPath, file.contents)
    }),
    { discard: true }
  )
  return plan
})

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
  format === "json" ? `${JSON.stringify(plan, null, 2)}\n` : renderReleaseInitText(plan)
