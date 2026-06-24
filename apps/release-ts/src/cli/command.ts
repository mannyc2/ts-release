import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Argument from "effect/unstable/cli/Argument"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { DEFAULT_CONFIG_PATH, renderReleaseConfigJsonSchema } from "@mannyc1/ts-release/config/schema"
import { EvidenceBundle } from "@mannyc1/ts-release/domain/evidence"
import { renderEvidenceJson } from "@mannyc1/ts-release/planner/evidence-recorder"
import { Config, Diagnostics, Init } from "@mannyc1/ts-release/workflows"

const configFlag = Flag.string("config").pipe(Flag.withDefault(DEFAULT_CONFIG_PATH))
const rootFlag = Flag.string("root").pipe(Flag.withDefault(""))
const outputFlag = Flag.string("out").pipe(Flag.withDefault(""))
const formatFlag = Flag.choice("format", ["json", "text", "summary", "markdown"]).pipe(Flag.withDefault("json"))
const validationFormatFlag = Flag.choice("format", ["json", "text"]).pipe(Flag.withDefault("text"))
const statusFormatFlag = Flag.choice("format", ["json", "text"]).pipe(Flag.withDefault("text"))
const diagnosticsFormatFlag = Flag.choice("format", ["json", "text", "markdown"]).pipe(Flag.withDefault("text"))
const initFormatFlag = Flag.choice("format", ["json", "text"]).pipe(Flag.withDefault("text"))
const initTemplateFlag = Flag.choice("template", [
  "npm-only",
  "npm-github",
  "multi-target-homebrew",
  "multi-target-scoop"
]).pipe(Flag.withDefault("npm-only"))
const packageFlag = Flag.string("package").pipe(Flag.withDefault("@scope/pkg"))
const repoFlag = Flag.string("repo").pipe(Flag.withDefault("owner/repo"))
const workflowFlag = Flag.string("workflow").pipe(Flag.withDefault("release.yml"))
const tapFlag = Flag.string("tap").pipe(Flag.withDefault("owner/homebrew-tap"))
const bucketFlag = Flag.string("bucket").pipe(Flag.withDefault("owner/scoop-bucket"))
const packageManagerFlag = Flag.choice("package-manager", ["bun", "npm", "pnpm", "yarn"]).pipe(Flag.withDefault("bun"))
const installCommandFlag = Flag.string("install-command").pipe(Flag.withDefault(""))
const buildCommandFlag = Flag.string("build-command").pipe(Flag.withDefault(""))
const writeFlag = Flag.boolean("write").pipe(Flag.withDefault(false))
const overwriteFlag = Flag.boolean("overwrite").pipe(Flag.withDefault(false))
const githubActionsFlag = Flag.boolean("github-actions").pipe(Flag.withDefault(false))
const targetFlag = Flag.string("target").pipe(Flag.withDefault(""))
const ciProviderFlag = Flag.choice("provider", ["github-actions"]).pipe(Flag.withDefault("github-actions"))
const ciWorkflowFlag = Flag.string("workflow").pipe(Flag.withDefault(".github/workflows/release.yml"))
const executeFlag = Flag.boolean("execute").pipe(Flag.withDefault(false))
const approveIrreversibleFlag = Flag.boolean("approve-irreversible").pipe(Flag.withDefault(false))

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
  readonly approveIrreversible: boolean
}): {
  readonly root?: string
  readonly configPath: string
  readonly execute: boolean
  readonly approveIrreversible: boolean
} => ({
    ...executableConfigInput(input),
    approveIrreversible: input.approveIrreversible
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
    const contents = yield* Config.renderPlan(formattedConfigInput({ root, config, format }))
    yield* writeOrPrint(out, contents)
  })
)

const schemaCommand = Command.make(
  "schema",
  {
    out: outputFlag
  },
  Effect.fn("cli.schema")(function*({ out }) {
    yield* writeOrPrint(out, renderReleaseConfigJsonSchema())
  })
)

const printCommand = Command.make(
  "print",
  {
    root: rootFlag,
    config: configFlag
  },
  Effect.fn("cli.print")(function*({ root, config }) {
    const contents = yield* Config.renderPlan(formattedConfigInput<"text">({ root, config, format: "text" }))
    yield* Console.log(contents.trimEnd())
  })
)

const explainCommand = Command.make(
  "explain",
  {
    operation: Argument.string("operation"),
    root: rootFlag,
    config: configFlag
  },
  Effect.fn("cli.explain")(function*({ operation, root, config }) {
    const contents = yield* Config.explain({ ...configInput({ root, config }), operationId: operation })
    yield* Console.log(contents.trimEnd())
  })
)

const statusCommand = Command.make(
  "status",
  {
    root: rootFlag,
    config: configFlag,
    format: statusFormatFlag
  },
  Effect.fn("cli.status")(function*({ root, config, format }) {
    const contents = yield* Config.renderStatus(formattedConfigInput({ root, config, format }))
    yield* Console.log(contents.trimEnd())
  })
)

const eligibilityCommand = Command.make(
  "eligibility",
  {
    root: rootFlag,
    config: configFlag,
    format: statusFormatFlag
  },
  Effect.fn("cli.eligibility")(function*({ root, config, format }) {
    const decision = yield* Config.checkEligibility(configInput({ root, config }))
    const contents = Config.renderEligibilityDecision(decision, format)
    yield* Console.log(contents.trimEnd())
  })
)

const checkIntentCommand = Command.make(
  "check-intent",
  {
    root: rootFlag,
    config: configFlag,
    format: statusFormatFlag
  },
  Effect.fn("cli.checkIntent")(function*({ root, config, format }) {
    const decision = yield* Config.checkIntent(configInput({ root, config }))
    const contents = Config.renderEligibilityDecision(decision, format)
    yield* Console.log(contents.trimEnd())
  })
)

const printEvidence = Effect.fn("cli.printEvidence")(function*(evidence: EvidenceBundle) {
  yield* Console.log(renderEvidenceJson(evidence).trimEnd())
})

const printWorkflowEvidencePaths = Effect.fn("cli.printWorkflowEvidencePaths")(function*(paths: unknown) {
  yield* Console.log(`${JSON.stringify({ evidence: paths }, null, 2)}`)
})

const validateCommand = Command.make(
  "validate",
  {
    root: rootFlag,
    config: configFlag
  },
  Effect.fn("cli.validate")(function*({ root, config }) {
    const result = yield* Config.planAndWriteValidation(configInput({ root, config }))
    yield* printEvidence(result.evidence)
  })
)

const validateConfigCommand = Command.make(
  "validate-config",
  {
    root: rootFlag,
    config: configFlag,
    format: validationFormatFlag
  },
  Effect.fn("cli.validateConfig")(function*({ root, config, format }) {
    const contents = yield* Config.renderValidation(formattedConfigInput({ root, config, format }))
    yield* Console.log(contents.trimEnd())
  })
)

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
  readonly workflow?: string | undefined
}) => ({
    ...configInput(input),
    format: input.format,
    ...(input.target === undefined || input.target.length === 0 ? {} : { target: input.target }),
    ...(input.workflow === undefined || input.workflow.length === 0 ? {} : { workflow: input.workflow })
  })

const checkAuthCommand = Command.make(
  "check-auth",
  {
    root: rootFlag,
    config: configFlag,
    target: targetFlag,
    format: diagnosticsFormatFlag
  },
  Effect.fn("cli.checkAuth")(function*({ root, config, target, format }) {
    const report = yield* Diagnostics.checkAuth(diagnosticsOptions({ root, config, target, format }))
    yield* Console.log(Diagnostics.render(report, format).trimEnd())
  })
)

const checkCiCommand = Command.make(
  "check-ci",
  {
    root: rootFlag,
    config: configFlag,
    provider: ciProviderFlag,
    workflow: ciWorkflowFlag,
    format: diagnosticsFormatFlag
  },
  Effect.fn("cli.checkCi")(function*({ root, config, provider, workflow, format }) {
    const report = yield* Diagnostics.checkCi({
      ...configInput({ root, config }),
      provider,
      workflow,
      format
    })
    yield* Console.log(Diagnostics.render(report, format).trimEnd())
  })
)

const doctorCommand = Command.make(
  "doctor",
  {
    root: rootFlag,
    config: configFlag,
    format: diagnosticsFormatFlag
  },
  Effect.fn("cli.doctor")(function*({ root, config, format }) {
    const report = yield* Diagnostics.doctor(diagnosticsOptions({ root, config, format }))
    yield* Console.log(Diagnostics.render(report, format).trimEnd())
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
    const result = yield* Config.planAndWriteRender(executableConfigInput({ root, config, execute }))
    yield* printEvidence(result.evidence)
  })
)

const executeCommand = Command.make(
  "execute",
  {
    root: rootFlag,
    config: configFlag,
    execute: executeFlag,
    approveIrreversible: approveIrreversibleFlag
  },
  Effect.fn("cli.execute")(function*({ root, config, execute, approveIrreversible }) {
    const result = yield* Config.planAndWriteExecution(
      approvedConfigInput({ root, config, execute, approveIrreversible })
    )
    yield* printEvidence(result.evidence)
  })
)

const verifyCommand = Command.make(
  "verify",
  {
    root: rootFlag,
    config: configFlag
  },
  Effect.fn("cli.verify")(function*({ root, config }) {
    const result = yield* Config.planAndWriteVerification(configInput({ root, config }))
    yield* printEvidence(result.evidence)
  })
)

const runCommand = Command.make(
  "run",
  {
    root: rootFlag,
    config: configFlag,
    execute: executeFlag,
    approveIrreversible: approveIrreversibleFlag
  },
  Effect.fn("cli.run")(function*({ root, config, execute, approveIrreversible }) {
    const result = yield* Config.planAndWriteRun(
      approvedConfigInput({ root, config, execute, approveIrreversible })
    )
    yield* printWorkflowEvidencePaths(result.paths)
  })
)

const resumeCommand = Command.make(
  "resume",
  {
    root: rootFlag,
    config: configFlag,
    execute: executeFlag,
    approveIrreversible: approveIrreversibleFlag
  },
  Effect.fn("cli.resume")(function*({ root, config, execute, approveIrreversible }) {
    const result = yield* Config.planAndWriteResume(
      approvedConfigInput({ root, config, execute, approveIrreversible })
    )
    yield* printWorkflowEvidencePaths(result.paths)
  })
)

const reconcileCommand = Command.make(
  "reconcile",
  {
    root: rootFlag,
    config: configFlag,
    execute: executeFlag
  },
  Effect.fn("cli.reconcile")(function*({ root, config, execute }) {
    const result = yield* Config.planAndWriteReconcile(executableConfigInput({ root, config, execute }))
    yield* printEvidence(result.evidence)
  })
)

export const cli = Command.make("release").pipe(
  Command.withSubcommands([
    planCommand,
    schemaCommand,
    initCommand,
    explainCommand,
    checkAuthCommand,
    checkCiCommand,
    doctorCommand,
    renderCommand,
    validateCommand,
    validateConfigCommand,
    printCommand,
    statusCommand,
    eligibilityCommand,
    checkIntentCommand,
    executeCommand,
    verifyCommand,
    runCommand,
    resumeCommand,
    reconcileCommand
  ])
)
