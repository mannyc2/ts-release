import { fileURLToPath } from "node:url"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { parseReleaseIntent } from "../../../../src/config/load.js"
import { DEFAULT_CONFIG_PATH } from "../../../../src/config/schema.js"
import {
  hasParentTraversal,
  resolveWorkspacePath,
  resolveWorkspaceWritePathEffect
} from "../../../../src/internal/workspace-path.js"

export const ReleaseInitTemplateName = Schema.Literals([
  "npm-only",
  "npm-github",
  "bun-cli-github",
  "portable-cli",
  "multi-target-homebrew",
  "multi-target-scoop"
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

interface NormalizedInitOptions {
  readonly root: string
  readonly configPath: string
  readonly template: ReleaseInitTemplateName
  readonly packageName: string
  readonly repository: string
  readonly workflow: string
  readonly tap: string
  readonly bucket: string
  readonly binaryName: string
  readonly entrypoint: string
  readonly pypiPackage?: string | undefined
  readonly pypiModule?: string | undefined
  readonly consoleScript: string
  readonly githubActions: boolean
  readonly packageManager: ReleaseInitPackageManager
  readonly installCommand: string
  readonly buildCommand: string
}

interface ProposedFileSpec {
  readonly path: string
  readonly contents: string
}

interface GithubActionsWorkflowSetup {
  readonly packageManager: ReleaseInitPackageManager
  readonly installCommand: string
  readonly buildCommand: string
}

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

const normalizeOptions = (options: ReleaseInitOptionsInput, root: string): NormalizedInitOptions => {
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

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const requireRecord = (
  value: unknown,
  pathName: string
): Effect.Effect<JsonRecord, ReleaseInitWriteError> =>
  isRecord(value)
    ? Effect.succeed(value)
    : Effect.fail(
      ReleaseInitWriteError.make({
        path: pathName,
        reason: "Template config did not contain the expected object shape."
      })
    )

const optionalRecord = (value: unknown): JsonRecord | undefined =>
  isRecord(value) ? value : undefined

const firstRecord = (value: unknown): JsonRecord | undefined =>
  Array.isArray(value) && isRecord(value[0]) ? value[0] : undefined

const templatePath = (path: Path.Path, ...segments: ReadonlyArray<string>): string =>
  path.join(packageRoot, "templates", ...segments)

const portableCliArtifactPath = (binaryName: string, suffix: string): string =>
  `artifacts/${binaryName}-{version}-${suffix}`

const portablePyPiWheel = (
  options: NormalizedInitOptions,
  input: {
    readonly id: string
    readonly suffix: string
    readonly wheelTag: string
    readonly os: string
    readonly arch: string
  }
): JsonRecord => {
  const pypiPackage = options.pypiPackage ?? options.binaryName
  const moduleName = options.pypiModule ?? pythonModuleName(pypiPackage)
  const distributionName = pythonDistributionName(pypiPackage)
  return {
    id: input.id,
    path: `artifacts/${distributionName}-{version}-${input.wheelTag}.whl`,
    wheelTag: input.wheelTag,
    packageName: pypiPackage,
    moduleName,
    consoleScript: options.consoleScript,
    summary: `Portable CLI wrapper for ${options.packageName}.`,
    homepage: `https://github.com/${options.repository}`,
    license: "MIT",
    requiresPython: ">=3.8",
    binaries: [
      {
        os: input.os,
        arch: input.arch,
        sourcePath: portableCliArtifactPath(options.binaryName, input.suffix),
        wheelPath: `${moduleName}/bin/${options.binaryName}-${input.suffix}`
      }
    ]
  }
}

const portablePyPiWheels = (options: NormalizedInitOptions): ReadonlyArray<JsonRecord> => [
  portablePyPiWheel(options, {
    id: "pypi-wheel-linux-x64",
    suffix: "linux-x64",
    wheelTag: "py3-none-manylinux2014_x86_64",
    os: "linux",
    arch: "x64"
  }),
  portablePyPiWheel(options, {
    id: "pypi-wheel-linux-arm64",
    suffix: "linux-arm64",
    wheelTag: "py3-none-manylinux2014_aarch64",
    os: "linux",
    arch: "arm64"
  }),
  portablePyPiWheel(options, {
    id: "pypi-wheel-darwin-x64",
    suffix: "darwin-x64",
    wheelTag: "py3-none-macosx_10_15_x86_64",
    os: "darwin",
    arch: "x64"
  }),
  portablePyPiWheel(options, {
    id: "pypi-wheel-darwin-arm64",
    suffix: "darwin-arm64",
    wheelTag: "py3-none-macosx_11_0_arm64",
    os: "darwin",
    arch: "arm64"
  }),
  portablePyPiWheel(options, {
    id: "pypi-wheel-windows-x64",
    suffix: "windows-x64.exe",
    wheelTag: "py3-none-win_amd64",
    os: "windows",
    arch: "x64"
  })
]

const patchNpmTarget = (publish: JsonRecord, options: NormalizedInitOptions): void => {
  const npm = optionalRecord(publish.npm)
  if (npm === undefined) {
    return
  }
  npm.packageName = options.packageName
  const trustedPublishing = optionalRecord(npm.trustedPublishing)
  if (trustedPublishing !== undefined) {
    trustedPublishing.workflow = options.workflow
  }
}

const patchGitHubTarget = (publish: JsonRecord, options: NormalizedInitOptions): void => {
  const github = optionalRecord(publish.github)
  if (github !== undefined) {
    github.repository = options.repository
  }
}

const patchBunCliBuild = (config: JsonRecord, options: NormalizedInitOptions): void => {
  const build = firstRecord(config.builds)
  if (build === undefined) {
    return
  }
  const name = packageShortName(options.packageName)
  build.entry = options.entrypoint
  build.output = `artifacts/${name}-{version}-{targetTriple}{ext}`
}

const patchPortableBuild = (config: JsonRecord, options: NormalizedInitOptions): void => {
  const build = firstRecord(config.builds)
  if (build === undefined) {
    return
  }
  build.entry = options.entrypoint
  build.output = portableCliArtifactPath(options.binaryName, "{targetTriple}{ext}")
  build.binaryName = options.binaryName
  build.installPath = `bin/${options.binaryName}`
}

const patchPortablePyPi = (config: JsonRecord, publish: JsonRecord, options: NormalizedInitOptions): void => {
  if (Array.isArray(config.pypiWheel)) {
    config.pypiWheel = portablePyPiWheels(options)
  }
  const pypi = optionalRecord(publish.pypi)
  const trustedPublishing = optionalRecord(pypi?.trustedPublishing)
  if (trustedPublishing !== undefined) {
    trustedPublishing.workflow = options.workflow
  }
}

const patchPortableCatalogs = (publish: JsonRecord, options: NormalizedInitOptions): void => {
  const homebrew = optionalRecord(publish.homebrew)
  if (homebrew !== undefined) {
    homebrew.repository = options.tap
    homebrew.formulaName = options.binaryName
    homebrew.formulaPath = `.release/generated/${options.binaryName}.rb`
    homebrew.homepage = `https://github.com/${options.repository}`
    homebrew.description = `Portable CLI distribution for ${options.packageName}`
  }
  const scoop = optionalRecord(publish.scoop)
  if (scoop !== undefined) {
    scoop.repository = options.bucket
    scoop.manifestName = options.binaryName
    scoop.manifestPath = `.release/generated/${options.binaryName}.json`
    scoop.homepage = `https://github.com/${options.repository}`
    scoop.description = `Portable CLI distribution for ${options.packageName}`
  }
}

const patchHomebrewTemplate = (config: JsonRecord, publish: JsonRecord, options: NormalizedInitOptions): void => {
  const name = packageShortName(options.packageName)
  const archive = firstRecord(config.artifacts)
  if (archive !== undefined) {
    archive.path = `artifacts/${name}-0.1.0.tgz`
  }
  const homebrew = optionalRecord(publish.homebrew)
  if (homebrew !== undefined) {
    homebrew.repository = options.tap
    homebrew.formulaName = name
    homebrew.formulaPath = `.release/generated/${name}.rb`
    homebrew.homepage = `https://github.com/${options.repository}`
    homebrew.url = `https://github.com/${options.repository}/releases/download/v0.1.0/${name}-0.1.0.tgz`
    homebrew.installPath = `bin/${name}`
  }
}

const patchScoopTemplate = (config: JsonRecord, publish: JsonRecord, options: NormalizedInitOptions): void => {
  const name = packageShortName(options.packageName)
  const archive = firstRecord(config.artifacts)
  if (archive !== undefined) {
    archive.path = `artifacts/${name}-0.1.0.zip`
  }
  const scoop = optionalRecord(publish.scoop)
  if (scoop !== undefined) {
    scoop.repository = options.bucket
    scoop.manifestName = name
    scoop.manifestPath = `.release/generated/${name}.json`
    scoop.homepage = `https://github.com/${options.repository}`
    scoop.description = `Example Scoop manifest for ${name}`
    scoop.url = `https://github.com/${options.repository}/releases/download/v0.1.0/${name}-0.1.0.zip`
    scoop.bin = `${name}.exe`
  }
}

const patchReleaseConfig = Effect.fn("cli.init.patchReleaseConfig")(function*(
  templateConfig: JsonRecord,
  options: NormalizedInitOptions
) {
  const config = structuredClone(templateConfig)
  const project = yield* requireRecord(config.project, "template.project")
  const publish = yield* requireRecord(config.publish, "template.publish")

  project.name = options.packageName
  project.packageName = options.packageName
  if (Object.hasOwn(project, "repository")) {
    project.repository = options.repository
  }
  patchNpmTarget(publish, options)
  patchGitHubTarget(publish, options)

  switch (options.template) {
    case "bun-cli-github":
      patchBunCliBuild(config, options)
      break
    case "portable-cli":
      patchPortableBuild(config, options)
      patchPortableCatalogs(publish, options)
      patchPortablePyPi(config, publish, options)
      break
    case "multi-target-homebrew":
      patchHomebrewTemplate(config, publish, options)
      break
    case "multi-target-scoop":
      patchScoopTemplate(config, publish, options)
      break
    case "npm-github":
    case "npm-only":
      break
  }

  return config
})

const parseTemplateObject = (
  contents: string,
  pathName: string
): Effect.Effect<JsonRecord, ReleaseInitWriteError> =>
  Effect.try({
    try: () => JSON.parse(contents) as unknown,
    catch: () =>
      ReleaseInitWriteError.make({
        path: pathName,
        reason: "Template config is not valid JSON."
      })
  }).pipe(
    Effect.flatMap((parsed) => requireRecord(parsed, pathName))
  )

const renderReleaseConfigFromTemplate = Effect.fn("cli.init.renderReleaseConfigFromTemplate")(function*(
  options: NormalizedInitOptions
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const pathName = templatePath(path, options.template, DEFAULT_CONFIG_PATH)
  const contents = yield* fs.readFileString(pathName)
  yield* parseReleaseIntent(contents, pathName)
  const templateConfig = yield* parseTemplateObject(contents, pathName)
  const config = yield* patchReleaseConfig(templateConfig, options)
  const rendered = `${JSON.stringify(config, null, 2)}\n`
  yield* parseReleaseIntent(rendered, options.configPath)
  return rendered
})

export const renderGithubActionsTrustedPublishingWorkflow = Effect.fn(
  "cli.init.renderGithubActionsTrustedPublishingWorkflow"
)(function*(configPath: string, setup: GithubActionsWorkflowSetup) {
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

const proposedFileSpecs = Effect.fn("cli.init.proposedFileSpecs")(function*(
  path: Path.Path,
  options: NormalizedInitOptions
) {
  const files: Array<ProposedFileSpec> = [
    {
      path: options.configPath,
      contents: yield* renderReleaseConfigFromTemplate(options)
    }
  ]
  if (options.githubActions) {
    files.push({
      path: `.github/workflows/${options.workflow}`,
      contents: yield* renderGithubActionsTrustedPublishingWorkflow(workflowConfigPath(path, options), {
        packageManager: options.packageManager,
        installCommand: options.installCommand,
        buildCommand: options.buildCommand
      })
    })
  }
  return files
})

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

const validateWorkflowCommand = (
  field: string,
  command: string
): Effect.Effect<void, ReleaseInitWriteError> => {
  if (command.trim().length > 0 && !command.includes("\n") && !command.includes("\r")) {
    return Effect.void
  }
  return Effect.fail(
    ReleaseInitWriteError.make({
      path: field,
      reason: "Command overrides must be single non-empty lines."
    })
  )
}

const validateInitOptions = Effect.fn("cli.init.validateInitOptions")(function*(
  path: Path.Path,
  options: NormalizedInitOptions
) {
  yield* resolveWorkspaceWritePathEffect(
    path,
    options.root,
    options.configPath,
    (errorPath, reason) => ReleaseInitWriteError.make({ path: errorPath, reason })
  )
  yield* validateWorkflowCommand("install-command", options.installCommand)
  yield* validateWorkflowCommand("build-command", options.buildCommand)
  if (!options.githubActions) {
    return
  }
  yield* validateWorkflowFileName(options.workflow)
  yield* resolveWorkspaceWritePathEffect(
    path,
    options.root,
    `.github/workflows/${options.workflow}`,
    (errorPath, reason) => ReleaseInitWriteError.make({ path: errorPath, reason })
  )
})

export const planReleaseInit = Effect.fn("cli.init.planReleaseInit")(function*(
  input: ReleaseInitOptionsInput = {}
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const normalized = normalizeOptions(input, initRoot(path, input))
  yield* validateInitOptions(path, normalized)
  const specs = yield* proposedFileSpecs(path, normalized)
  const files = yield* Effect.forEach(
    specs,
    (file) =>
      resolveWorkspaceWritePathEffect(
        path,
        normalized.root,
        file.path,
        (errorPath, reason) => ReleaseInitWriteError.make({ path: errorPath, reason })
      ).pipe(
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

const writeInitFile = Effect.fn("cli.init.writeInitFile")(function*(
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
  const outputPath = yield* resolveWorkspaceWritePathEffect(
    path,
    root,
    file.path,
    (errorPath, reason) => ReleaseInitWriteError.make({ path: errorPath, reason })
  )
  yield* fs.makeDirectory(path.dirname(outputPath), { recursive: true })
  yield* fs.writeFileString(outputPath, file.contents)
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
  yield* Effect.forEach(
    plan.files,
    (file) => writeInitFile(normalized.root, file, input.overwrite === true),
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
