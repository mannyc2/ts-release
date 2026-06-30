import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { DEFAULT_CONFIG_PATH } from "../../../../src/config/schema.js"
import { EvidenceBundle } from "../../../../src/domain/evidence.js"
import { renderEvidenceJson } from "../../../../src/planner/evidence-recorder.js"
import * as Init from "../../../../src/workflows/init.js"
import * as Release from "../../../../src/workflows/release.js"

const configFlag = Flag.string("config").pipe(Flag.withDefault(DEFAULT_CONFIG_PATH))
const rootFlag = Flag.string("root").pipe(Flag.withDefault(""))
const outputFlag = Flag.string("out").pipe(Flag.withDefault(""))
const formatFlag = Flag.choice("format", ["json", "text", "summary", "markdown"]).pipe(Flag.withDefault("json"))
const textJsonFormatFlag = Flag.choice("format", ["json", "text"]).pipe(Flag.withDefault("text"))
const diagnosticsFormatFlag = Flag.choice("format", ["json", "text", "markdown"]).pipe(Flag.withDefault("text"))
const initFormatFlag = Flag.choice("format", ["json", "text"]).pipe(Flag.withDefault("text"))
const initTemplateFlag = Flag.choice("template", [
  "npm-only",
  "npm-github",
  "bun-cli-github",
  "portable-cli",
  "multi-target-homebrew",
  "multi-target-scoop"
]).pipe(Flag.withDefault("npm-only"))
const packageFlag = Flag.string("package").pipe(Flag.withDefault("@scope/pkg"))
const repoFlag = Flag.string("repo").pipe(Flag.withDefault("owner/repo"))
const workflowFlag = Flag.string("workflow").pipe(Flag.withDefault("release.yml"))
const tapFlag = Flag.string("tap").pipe(Flag.withDefault("owner/homebrew-tap"))
const bucketFlag = Flag.string("bucket").pipe(Flag.withDefault("owner/scoop-bucket"))
const binaryNameFlag = Flag.string("binary-name").pipe(Flag.withDefault(""))
const entrypointFlag = Flag.string("entrypoint").pipe(Flag.withDefault(""))
const pypiPackageFlag = Flag.string("pypi-package").pipe(Flag.withDefault(""))
const pypiModuleFlag = Flag.string("pypi-module").pipe(Flag.withDefault(""))
const consoleScriptFlag = Flag.string("console-script").pipe(Flag.withDefault(""))
const packageManagerFlag = Flag.choice("package-manager", ["bun", "npm", "pnpm", "yarn"]).pipe(Flag.withDefault("bun"))
const installCommandFlag = Flag.string("install-command").pipe(Flag.withDefault(""))
const buildCommandFlag = Flag.string("build-command").pipe(Flag.withDefault(""))
const writeFlag = Flag.boolean("write").pipe(Flag.withDefault(false))
const overwriteFlag = Flag.boolean("overwrite").pipe(Flag.withDefault(false))
const githubActionsFlag = Flag.boolean("github-actions").pipe(Flag.withDefault(false))
const targetFlag = Flag.string("target").pipe(Flag.withDefault(""))
const executeFlag = Flag.boolean("execute").pipe(Flag.withDefault(false))
const approvePublishFlag = Flag.boolean("approve-publish").pipe(Flag.withDefault(false))

const writeFile = Effect.fn("cli.writeFile")(function*(pathName: string, contents: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs.makeDirectory(path.dirname(pathName), { recursive: true })
  yield* fs.writeFileString(pathName, contents)
})

const writeOrPrint = Effect.fn("writeOrPrint")(function*(out: string, contents: string) {
  if (out.length === 0) {
    return yield* Console.log(contents.trimEnd())
  }
  return yield* writeFile(out, contents)
})

const configInput = (input: {
  readonly root: string
  readonly config: string
}): {
  readonly root?: string
  readonly configPath: string
} => ({
    ...(input.root.length === 0 ? {} : { root: input.root }),
    configPath: input.config
  })

const formattedConfigInput = <Format extends string>(input: {
  readonly root: string
  readonly config: string
  readonly format: Format
}): {
  readonly root?: string
  readonly configPath: string
  readonly format: Format
} => ({
    ...configInput(input),
    format: input.format
  })

const executableConfigInput = (input: {
  readonly root: string
  readonly config: string
  readonly execute: boolean
}): {
  readonly root?: string
  readonly configPath: string
  readonly execute: boolean
} => ({
    ...configInput(input),
    execute: input.execute
  })

const approvedConfigInput = (input: {
  readonly root: string
  readonly config: string
  readonly execute: boolean
  readonly approvePublish: boolean
}): {
  readonly root?: string
  readonly configPath: string
  readonly execute: boolean
  readonly approveIrreversible: boolean
} => ({
    ...executableConfigInput(input),
    approveIrreversible: input.approvePublish
  })

const planCommand = Command.make(
  "plan",
  {
    root: rootFlag,
    config: configFlag,
    out: outputFlag,
    format: formatFlag
  },
  Effect.fn("cli.plan")(function*({ root, config, out, format }) {
    const plan = yield* Release.planRelease(formattedConfigInput({ root, config, format }))
    const contents = Release.renderReleasePlan(plan, format)
    yield* writeOrPrint(out, contents)
  })
)

const buildCommand = Command.make(
  "build",
  {
    root: rootFlag,
    config: configFlag,
    format: textJsonFormatFlag,
    out: outputFlag
  },
  Effect.fn("cli.build")(function*({ root, config, format, out }) {
    const result = yield* Release.buildReleaseArtifacts(formattedConfigInput({ root, config, format }))
    yield* writeOrPrint(out, Release.renderBuildArtifacts(result, format))
  })
)

const printEvidence = Effect.fn("cli.printEvidence")(function*(evidence: EvidenceBundle) {
  yield* Console.log(renderEvidenceJson(evidence).trimEnd())
})

const initCommand = Command.make(
  "init",
  {
    template: initTemplateFlag,
    config: configFlag,
    package: packageFlag,
    repo: repoFlag,
    workflow: workflowFlag,
    tap: tapFlag,
    bucket: bucketFlag,
    binaryName: binaryNameFlag,
    entrypoint: entrypointFlag,
    pypiPackage: pypiPackageFlag,
    pypiModule: pypiModuleFlag,
    consoleScript: consoleScriptFlag,
    githubActions: githubActionsFlag,
    packageManager: packageManagerFlag,
    installCommand: installCommandFlag,
    buildCommand: buildCommandFlag,
    write: writeFlag,
    overwrite: overwriteFlag,
    format: initFormatFlag
  },
  Effect.fn("cli.init")(function*({
    template,
    config,
    package: packageName,
    repo,
    workflow,
    tap,
    bucket,
    binaryName,
    entrypoint,
    pypiPackage,
    pypiModule,
    consoleScript,
    githubActions,
    packageManager,
    installCommand,
    buildCommand,
    write,
    overwrite,
    format
  }) {
    const plan = yield* Init.run({
      template,
      configPath: config,
      package: packageName,
      repo,
      workflow,
      tap,
      bucket,
      ...(binaryName.length === 0 ? {} : { binaryName }),
      ...(entrypoint.length === 0 ? {} : { entrypoint }),
      ...(pypiPackage.length === 0 ? {} : { pypiPackage }),
      ...(pypiModule.length === 0 ? {} : { pypiModule }),
      ...(consoleScript.length === 0 ? {} : { consoleScript }),
      githubActions,
      packageManager,
      ...(installCommand.length === 0 ? {} : { installCommand }),
      ...(buildCommand.length === 0 ? {} : { buildCommand }),
      write,
      overwrite,
      format
    })
    yield* Console.log(Init.renderPlan(plan, format).trimEnd())
  })
)

const diagnosticsOptions = (input: {
  readonly root: string
  readonly config: string
  readonly format: "json" | "text" | "markdown"
  readonly target?: string | undefined
}) => ({
    ...configInput(input),
    format: input.format,
    ...(input.target === undefined || input.target.length === 0 ? {} : { target: input.target })
  })

const doctorCommand = Command.make(
  "doctor",
  {
    root: rootFlag,
    config: configFlag,
    target: targetFlag,
    format: diagnosticsFormatFlag
  },
  Effect.fn("cli.doctor")(function*({ root, config, target, format }) {
    const report = yield* Release.doctorRelease(diagnosticsOptions({ root, config, target, format }))
    yield* Console.log(Release.renderReleaseDiagnostics(report, format).trimEnd())
  })
)

const verifyCommand = Command.make(
  "verify",
  {
    root: rootFlag,
    config: configFlag
  },
  Effect.fn("cli.verify")(function*({ root, config }) {
    const result = yield* Release.verifyRelease(configInput({ root, config }))
    yield* printEvidence(result.evidence)
  })
)

const renderCommand = Command.make(
  "render",
  {
    root: rootFlag,
    config: configFlag,
    execute: executeFlag
  },
  Effect.fn("cli.render")(function*({ root, config, execute }) {
    const result = yield* Release.renderReleaseFiles(
      executableConfigInput({ root, config, execute })
    )
    yield* printEvidence(result.evidence)
  })
)

const releaseCommand = Command.make(
  "release",
  {
    root: rootFlag,
    config: configFlag,
    execute: executeFlag,
    approvePublish: approvePublishFlag
  },
  Effect.fn("cli.release")(function*({ root, config, execute, approvePublish }) {
    const result = yield* Release.runApprovedRelease(
      approvedConfigInput({ root, config, execute, approvePublish })
    )
    yield* printEvidence(result.evidence)
  })
)

export const cli = Command.make("release").pipe(
  Command.withSubcommands([
    buildCommand,
    doctorCommand,
    initCommand,
    planCommand,
    renderCommand,
    releaseCommand,
    verifyCommand
  ])
)
