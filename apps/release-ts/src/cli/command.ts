import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { DEFAULT_CONFIG_PATH } from "../../../../src/config/schema.js"
import { EvidenceBundle } from "../../../../src/engine/evidence.js"
import * as Release from "../../../../src/engine/engine.js"
import { optionalField } from "../../../../src/pipeline/optional-field.js"
import * as Doctor from "../../../../src/workflows/doctor.js"
import * as Init from "./init.js"

const configFlag = Flag.string("config").pipe(Flag.withDefault(DEFAULT_CONFIG_PATH))
const rootFlag = Flag.string("root").pipe(Flag.optional)
const outputFlag = Flag.string("out").pipe(Flag.optional)
const formatFlag = Flag.choice("format", ["json", "text", "summary", "markdown"] as const).pipe(Flag.withDefault("json"))
const textJsonFormatFlag = Flag.choice("format", ["json", "text"] as const).pipe(Flag.withDefault("text"))
const diagnosticsFormatFlag = Flag.choice("format", ["json", "text", "markdown"] as const).pipe(Flag.withDefault("text"))
const initTemplateFlag = Flag.choice("template", [
  "npm-only",
  "npm-github",
  "bun-cli-github",
  "portable-cli",
  "multi-target-homebrew",
  "multi-target-scoop"
] as const).pipe(Flag.withDefault("npm-only"))
const packageFlag = Flag.string("package").pipe(Flag.withDefault("@scope/pkg"))
const repoFlag = Flag.string("repo").pipe(Flag.withDefault("owner/repo"))
const workflowFlag = Flag.string("workflow").pipe(Flag.withDefault("release.yml"))
const tapFlag = Flag.string("tap").pipe(Flag.withDefault("owner/homebrew-tap"))
const bucketFlag = Flag.string("bucket").pipe(Flag.withDefault("owner/scoop-bucket"))
const binaryNameFlag = Flag.string("binary-name").pipe(Flag.optional)
const entrypointFlag = Flag.string("entrypoint").pipe(Flag.optional)
const pypiPackageFlag = Flag.string("pypi-package").pipe(Flag.optional)
const pypiModuleFlag = Flag.string("pypi-module").pipe(Flag.optional)
const consoleScriptFlag = Flag.string("console-script").pipe(Flag.optional)
const packageManagerFlag = Flag.choice("package-manager", ["bun", "npm", "pnpm", "yarn"] as const).pipe(Flag.withDefault("bun"))
const installCommandFlag = Flag.string("install-command").pipe(Flag.optional)
const buildCommandFlag = Flag.string("build-command").pipe(Flag.optional)
const writeFlag = Flag.boolean("write").pipe(Flag.withDefault(false))
const overwriteFlag = Flag.boolean("overwrite").pipe(Flag.withDefault(false))
const githubActionsFlag = Flag.boolean("github-actions").pipe(Flag.withDefault(false))
const targetFlag = Flag.string("target").pipe(Flag.optional)
const executeFlag = Flag.boolean("execute").pipe(Flag.withDefault(false))
const approvePublishFlag = Flag.boolean("approve-publish").pipe(Flag.withDefault(false))
const snapshotFlag = Flag.boolean("snapshot").pipe(Flag.withDefault(false))

const sharedFlags = { root: rootFlag, config: configFlag, snapshot: snapshotFlag }

const writeFile = Effect.fn("cli.writeFile")(function*(pathName: string, contents: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs.makeDirectory(path.dirname(pathName), { recursive: true })
  yield* fs.writeFileString(pathName, contents)
})

const writeOrPrint = Effect.fn("writeOrPrint")(function*(out: Option.Option<string>, contents: string) {
  if (Option.isNone(out)) {
    return yield* Console.log(contents.trimEnd())
  }
  return yield* writeFile(out.value, contents)
})

const configInput = (input: {
  readonly root: Option.Option<string>
  readonly config: string
  readonly snapshot?: boolean | undefined
}) => ({
  root: Option.getOrUndefined(input.root),
  configPath: input.config,
  snapshot: input.snapshot
})

const planCommand = Command.make(
  "plan",
  { ...sharedFlags, out: outputFlag, format: formatFlag },
  Effect.fn("cli.plan")(function*({ root, config, snapshot, out, format }) {
    const plan = yield* Release.planRelease(configInput({ root, config, snapshot }))
    const contents = Release.renderReleasePlan(plan, format)
    yield* writeOrPrint(out, contents)
  })
)

const buildCommand = Command.make(
  "build",
  { ...sharedFlags, format: textJsonFormatFlag, out: outputFlag },
  Effect.fn("cli.build")(function*({ root, config, snapshot, format, out }) {
    const result = yield* Release.buildReleaseArtifacts(configInput({ root, config, snapshot }))
    yield* writeOrPrint(out, Release.renderBuildArtifacts(result, format))
  })
)

const printEvidence = Effect.fn("cli.printEvidence")(function*(evidence: EvidenceBundle) {
  yield* Console.log(Release.renderEvidenceJson(evidence).trimEnd())
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
    format: textJsonFormatFlag
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
      ...optionalField(Option.getOrUndefined(binaryName), (binaryName) => ({ binaryName })),
      ...optionalField(Option.getOrUndefined(entrypoint), (entrypoint) => ({ entrypoint })),
      ...optionalField(Option.getOrUndefined(pypiPackage), (pypiPackage) => ({ pypiPackage })),
      ...optionalField(Option.getOrUndefined(pypiModule), (pypiModule) => ({ pypiModule })),
      ...optionalField(Option.getOrUndefined(consoleScript), (consoleScript) => ({ consoleScript })),
      githubActions,
      packageManager,
      ...optionalField(Option.getOrUndefined(installCommand), (installCommand) => ({ installCommand })),
      ...optionalField(Option.getOrUndefined(buildCommand), (buildCommand) => ({ buildCommand })),
      write,
      overwrite,
      format
    })
    yield* Console.log(Init.renderPlan(plan, format).trimEnd())
  })
)

const doctorCommand = Command.make(
  "doctor",
  { root: rootFlag, config: configFlag, target: targetFlag, format: diagnosticsFormatFlag },
  Effect.fn("cli.doctor")(function*({ root, config, target, format }) {
    const report = yield* Doctor.doctorRelease({
      ...configInput({ root, config }),
      format,
      target: Option.getOrUndefined(target)
    })
    yield* Console.log(Doctor.renderReleaseDiagnostics(report, format).trimEnd())
  })
)

const verifyCommand = Command.make(
  "verify",
  sharedFlags,
  Effect.fn("cli.verify")(function*({ root, config, snapshot }) {
    const result = yield* Release.verifyRelease(configInput({ root, config, snapshot }))
    yield* printEvidence(result.evidence)
  })
)

const releaseCommand = Command.make(
  "release",
  { ...sharedFlags, execute: executeFlag, approvePublish: approvePublishFlag },
  Effect.fn("cli.release")(function*({ root, config, snapshot, execute, approvePublish }) {
    if (!execute) {
      const plan = yield* Release.planRelease(configInput({ root, config, snapshot }))
      yield* Console.log(
        `${Release.renderReleasePlan(plan, "text").trimEnd()}\nrelease planned only; pass --execute to run approved operations.`
      )
      return
    }
    const result = yield* Release.runApprovedRelease({
      ...configInput({ root, config, snapshot }),
      execute,
      approveIrreversible: approvePublish
    })
    yield* printEvidence(result.evidence)
  })
)

export const cli = Command.make("release").pipe(
  Command.withSubcommands([
    buildCommand,
    doctorCommand,
    initCommand,
    planCommand,
    releaseCommand,
    verifyCommand
  ])
)
