import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { DEFAULT_CONFIG_PATH, RELEASE_CONFIG_SCHEMA_ID } from "../config/schema.js"
import {
  hasParentTraversal,
  resolveWorkspacePath,
  validateWorkspaceWritePath,
  workspacePathBoundaryReasonMessage
} from "../internal/workspace-path.js"
import { releaseConfigFields } from "./options.js"

export type * from "../types/effect-internal.js"

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

export interface ReleaseInitInput {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
  readonly template?: ReleaseInitTemplateName | undefined
  readonly package?: string | undefined
  readonly repo?: string | undefined
  readonly workflow?: string | undefined
  readonly tap?: string | undefined
  readonly bucket?: string | undefined
  readonly binaryName?: string | undefined
  readonly entrypoint?: string | undefined
  readonly pypiPackage?: string | undefined
  readonly pypiModule?: string | undefined
  readonly consoleScript?: string | undefined
  readonly githubActions?: boolean | undefined
  readonly packageManager?: ReleaseInitPackageManager | undefined
  readonly installCommand?: string | undefined
  readonly buildCommand?: string | undefined
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
    ...(input.binaryName === undefined ? {} : { binaryName: input.binaryName }),
    ...(input.entrypoint === undefined ? {} : { entrypoint: input.entrypoint }),
    ...(input.pypiPackage === undefined ? {} : { pypiPackage: input.pypiPackage }),
    ...(input.pypiModule === undefined ? {} : { pypiModule: input.pypiModule }),
    ...(input.consoleScript === undefined ? {} : { consoleScript: input.consoleScript }),
    ...(input.githubActions === undefined ? {} : { githubActions: input.githubActions }),
    ...(input.packageManager === undefined ? {} : { packageManager: input.packageManager }),
    ...(input.installCommand === undefined ? {} : { installCommand: input.installCommand }),
    ...(input.buildCommand === undefined ? {} : { buildCommand: input.buildCommand }),
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

const initRoot = (path: Path.Path, options: ReleaseInitOptions): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

const defaultInstallCommand = (packageManager: ReleaseInitPackageManager): string => {
  switch (packageManager) {
    case "bun":
      return "bun install --frozen-lockfile"
    case "npm":
      return "npm ci"
    case "pnpm":
      return "corepack enable && pnpm install --frozen-lockfile"
    case "yarn":
      return "corepack enable && yarn install --immutable"
  }
}

const defaultBuildCommand = (packageManager: ReleaseInitPackageManager): string => {
  switch (packageManager) {
    case "bun":
      return "bun run build"
    case "npm":
      return "npm run build --if-present"
    case "pnpm":
      return "pnpm run build --if-present"
    case "yarn":
      return "yarn run build"
  }
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

const normalizeOptions = (options: ReleaseInitOptions, root: string): NormalizedInitOptions => {
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
    ...(pypiPackage === undefined ? {} : { pypiPackage }),
    ...(pypiPackage === undefined && pypiModule === undefined
      ? {}
      : { pypiModule: pypiModule ?? pythonModuleName(pypiPackage ?? binaryName) }),
    consoleScript: nonEmpty(options.consoleScript) ?? binaryName,
    githubActions: options.githubActions ?? false,
    packageManager,
    installCommand: (options.installCommand ?? defaultInstallCommand(packageManager)).trim(),
    buildCommand: (options.buildCommand ?? defaultBuildCommand(packageManager)).trim()
  }
}

const configTargetNpm = (options: NormalizedInitOptions): Record<string, unknown> => ({
  registry: "https://registry.npmjs.org",
  packageName: options.packageName,
  packagePath: ".",
  trustedPublishing: {
    workflow: options.workflow,
    packageExists: true,
    verifyPackageExists: true
  },
  access: "public",
  provenance: true
})

const configTargetGitHub = (options: NormalizedInitOptions): Record<string, unknown> => ({
  repository: options.repository,
  tokenEnv: "GH_TOKEN",
  draft: true,
  prerelease: false
})

const configTargetHomebrew = (options: NormalizedInitOptions): Record<string, unknown> => {
  const name = packageShortName(options.packageName)
  return {
    repository: options.tap,
    formulaName: name,
    formulaPath: `.release/generated/${name}.rb`,
    artifactId: "archive",
    homepage: `https://github.com/${options.repository}`,
    url: `https://github.com/${options.repository}/releases/download/v0.1.0/${name}-0.1.0.tgz`,
    installPath: `bin/${name}`
  }
}

const configTargetScoop = (options: NormalizedInitOptions): Record<string, unknown> => {
  const name = packageShortName(options.packageName)
  return {
    repository: options.bucket,
    manifestName: name,
    manifestPath: `.release/generated/${name}.json`,
    artifactId: "archive",
    homepage: `https://github.com/${options.repository}`,
    description: `Example Scoop manifest for ${name}`,
    license: "MIT",
    url: `https://github.com/${options.repository}/releases/download/v0.1.0/${name}-0.1.0.zip`,
    bin: `${name}.exe`
  }
}

const portableCliArtifactPath = (binaryName: string, suffix: string): string =>
  `artifacts/${binaryName}-{version}-${suffix}`

const portableCliDownloadUrl = (options: NormalizedInitOptions, suffix: string): string =>
  `https://github.com/${options.repository}/releases/download/v{version}/${options.binaryName}-{version}-${suffix}`

const portableCliVariant = (binaryName: string, windows: boolean): Record<string, unknown> => ({
  binaryName,
  installPath: windows ? `bin/${binaryName}.exe` : `bin/${binaryName}`
})

const configPortableCliBunRecipe = (options: NormalizedInitOptions): Record<string, unknown> => {
  const binaryName = options.binaryName
  return {
    id: "cli",
    entry: options.entrypoint,
    outputs: [
      {
        id: "cli-linux-x64",
        target: "bun-linux-x64-baseline",
        path: portableCliArtifactPath(binaryName, "linux-x64"),
        downloadUrl: portableCliDownloadUrl(options, "linux-x64"),
        consumers: ["github"],
        variant: portableCliVariant(binaryName, false)
      },
      {
        id: "cli-linux-arm64",
        target: "bun-linux-arm64",
        path: portableCliArtifactPath(binaryName, "linux-arm64"),
        downloadUrl: portableCliDownloadUrl(options, "linux-arm64"),
        consumers: ["github"],
        variant: portableCliVariant(binaryName, false)
      },
      {
        id: "cli-darwin-x64",
        target: "bun-darwin-x64",
        path: portableCliArtifactPath(binaryName, "darwin-x64"),
        downloadUrl: portableCliDownloadUrl(options, "darwin-x64"),
        consumers: ["github", "homebrew"],
        variant: portableCliVariant(binaryName, false)
      },
      {
        id: "cli-darwin-arm64",
        target: "bun-darwin-arm64",
        path: portableCliArtifactPath(binaryName, "darwin-arm64"),
        downloadUrl: portableCliDownloadUrl(options, "darwin-arm64"),
        consumers: ["github", "homebrew"],
        variant: portableCliVariant(binaryName, false)
      },
      {
        id: "cli-windows-x64",
        target: "bun-windows-x64-baseline",
        path: portableCliArtifactPath(binaryName, "windows-x64.exe"),
        downloadUrl: portableCliDownloadUrl(options, "windows-x64.exe"),
        consumers: ["github", "scoop"],
        variant: portableCliVariant(binaryName, true)
      }
    ]
  }
}

const configTargetPortableHomebrew = (options: NormalizedInitOptions): Record<string, unknown> => ({
  repository: options.tap,
  formulaName: options.binaryName,
  formulaPath: `.release/generated/${options.binaryName}.rb`,
  artifactId: "cli-darwin-arm64",
  artifactIds: ["cli-darwin-arm64", "cli-darwin-x64"],
  homepage: `https://github.com/${options.repository}`,
  description: `Portable CLI distribution for ${options.packageName}`
})

const configTargetPortableScoop = (options: NormalizedInitOptions): Record<string, unknown> => ({
  repository: options.bucket,
  manifestName: options.binaryName,
  manifestPath: `.release/generated/${options.binaryName}.json`,
  artifactId: "cli-windows-x64",
  homepage: `https://github.com/${options.repository}`,
  description: `Portable CLI distribution for ${options.packageName}`,
  license: "MIT"
})

const portablePyPiWheel = (
  options: NormalizedInitOptions,
  input: {
    readonly id: string
    readonly suffix: string
    readonly wheelTag: string
    readonly os: string
    readonly arch: string
  }
): Record<string, unknown> => {
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
    ],
    consumers: ["pypi"]
  }
}

const configPortablePyPiWheels = (options: NormalizedInitOptions): ReadonlyArray<Record<string, unknown>> => [
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

const configArtifactRecipeBunCli = (options: NormalizedInitOptions): Record<string, unknown> => {
  const name = packageShortName(options.packageName)
  return {
    id: "cli",
    entry: "src/cli.ts",
    outputs: [
      {
        id: "cli-linux-x64",
        target: "bun-linux-x64-baseline",
        path: `artifacts/${name}-{version}-linux-x64`,
        consumers: ["github"]
      },
      {
        id: "cli-linux-arm64",
        target: "bun-linux-arm64",
        path: `artifacts/${name}-{version}-linux-arm64`,
        consumers: ["github"]
      },
      {
        id: "cli-darwin-x64",
        target: "bun-darwin-x64",
        path: `artifacts/${name}-{version}-darwin-x64`,
        consumers: ["github"]
      },
      {
        id: "cli-darwin-arm64",
        target: "bun-darwin-arm64",
        path: `artifacts/${name}-{version}-darwin-arm64`,
        consumers: ["github"]
      },
      {
        id: "cli-windows-x64",
        target: "bun-windows-x64-baseline",
        path: `artifacts/${name}-{version}-windows-x64.exe`,
        consumers: ["github"]
      }
    ]
  }
}

const releaseConfigForTemplate = (options: NormalizedInitOptions): Record<string, unknown> => {
  const name = packageShortName(options.packageName)
  const build: Record<string, unknown> = {
    npmPackage: {
      id: "package",
      path: ".",
      consumers: ["npm"]
    }
  }
  const publish: Record<string, unknown> = {
    npm: configTargetNpm(options)
  }

  if (options.template !== "npm-only") {
    publish.github = configTargetGitHub(options)
  }
  if (options.template === "bun-cli-github") {
    build.bun = configArtifactRecipeBunCli(options)
  }
  if (options.template === "portable-cli") {
    build.bun = configPortableCliBunRecipe(options)
    publish.homebrew = configTargetPortableHomebrew(options)
    publish.scoop = configTargetPortableScoop(options)
    if (options.pypiPackage !== undefined || options.pypiModule !== undefined) {
      build.pypiWheel = configPortablePyPiWheels(options)
      publish.pypi = {
        repositoryUrl: "https://upload.pypi.org/legacy/",
        trustedPublishing: {
          provider: "github-actions",
          workflow: options.workflow,
          publisherConfigured: true
        }
      }
    }
  }
  if (options.template === "multi-target-homebrew") {
    build.artifacts = [
      {
        id: "archive",
        path: `artifacts/${name}-0.1.0.tgz`,
        format: "tarball",
        consumers: ["github", "homebrew"]
      }
    ]
    publish.homebrew = configTargetHomebrew(options)
  }
  if (options.template === "multi-target-scoop") {
    build.artifacts = [
      {
        id: "archive",
        path: `artifacts/${name}-0.1.0.zip`,
        format: "zip",
        consumers: ["github", "scoop"]
      }
    ]
    publish.scoop = configTargetScoop(options)
  }

  return {
    $schema: RELEASE_CONFIG_SCHEMA_ID,
    project: {
      name: options.packageName,
      packageName: options.packageName,
      repository: options.repository,
      version: "0.1.0",
      commit: "abc123",
      tag: "v0.1.0"
    },
    build,
    publish,
    strict: true,
    evidence: ".release/evidence/{version}"
  }
}

interface GithubActionsWorkflowSetup {
  readonly packageManager: ReleaseInitPackageManager
  readonly installCommand: string
  readonly buildCommand: string
}

interface GithubActionsWorkflowSetupInput {
  readonly packageManager?: ReleaseInitPackageManager | undefined
  readonly installCommand?: string | undefined
  readonly buildCommand?: string | undefined
}

const githubActionsWorkflowSetup = (
  input: GithubActionsWorkflowSetupInput = {}
): GithubActionsWorkflowSetup => {
  const packageManager = input.packageManager ?? "bun"
  return {
    packageManager,
    installCommand: (input.installCommand ?? defaultInstallCommand(packageManager)).trim(),
    buildCommand: (input.buildCommand ?? defaultBuildCommand(packageManager)).trim()
  }
}

const planSetupSteps = (): ReadonlyArray<string> => [
  "      - uses: actions/checkout@v4"
]

const executeSetupSteps = (setup: GithubActionsWorkflowSetup): ReadonlyArray<string> => [
  "      - uses: actions/checkout@v4",
  ...(setup.packageManager === "bun" ? ["      - uses: oven-sh/setup-bun@v2"] : []),
  "      - uses: actions/setup-node@v4",
  "        with:",
  "          node-version: 22.14.0",
  "          registry-url: https://registry.npmjs.org",
  "      - run: npm install -g npm@^11.5.1",
  `      - run: ${setup.installCommand}`,
  `      - run: ${setup.buildCommand}`
]

export const renderGithubActionsTrustedPublishingWorkflow = (
  configPath: string,
  input: GithubActionsWorkflowSetupInput = {}
): string => {
  const setup = githubActionsWorkflowSetup(input)
  return [
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
    ...planSetupSteps(),
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
    ...executeSetupSteps(setup),
    `      - uses: ${TS_RELEASE_ACTION_REFERENCE}`,
    "        with:",
    "          command: release",
    `          config: ${configPath}`,
    "          execute: true",
    "          approve-publish: true",
    "          write-step-summary: true",
    "      - uses: actions/upload-artifact@v4",
    "        if: always()",
    "        with:",
    "          name: release-evidence",
    "          path: .release/evidence/",
    ""
  ].join("\n")
}

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
      contents: renderGithubActionsTrustedPublishingWorkflow(workflowConfigPath(path, options), {
        packageManager: options.packageManager,
        installCommand: options.installCommand,
        buildCommand: options.buildCommand
      })
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
      reason: workspacePathBoundaryReasonMessage(result.reason)
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

const validateInitOptions = Effect.fn("workflows.init.validateInitOptions")(function*(
  path: Path.Path,
  options: NormalizedInitOptions
) {
  yield* workspacePath(path, options.root, options.configPath)
  yield* validateWorkflowCommand("install-command", options.installCommand)
  yield* validateWorkflowCommand("build-command", options.buildCommand)
  if (!options.githubActions) {
    return
  }
  yield* validateWorkflowFileName(options.workflow)
  yield* workspacePath(path, options.root, `.github/workflows/${options.workflow}`)
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
