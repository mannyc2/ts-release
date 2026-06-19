import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Argument from "effect/unstable/cli/Argument"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { DEFAULT_CONFIG_PATH, renderReleaseConfigJsonSchema } from "@mannyc1/ts-release/config/schema"
import { EvidenceBundle, ReleaseWorkflowEvidence, ReleaseWorkflowFailureEvidence } from "@mannyc1/ts-release/domain/evidence"
import { ReleasePlan } from "@mannyc1/ts-release/domain/release"
import { renderEvidenceJson } from "@mannyc1/ts-release/planner/evidence-recorder"
import {
  renderReleaseEligibilityJson,
  renderReleaseEligibilityText
} from "@mannyc1/ts-release/planner/release-eligibility"
import {
  checkReleaseConfigEligibility,
  executeReleaseConfig,
  explainReleaseConfigOperation,
  ExplainReleaseConfigOptions,
  PlanReleaseConfigOptions,
  planReleaseConfig,
  reconcileReleaseConfig,
  ReleaseConfigOptions,
  ReleaseExecutionOptions,
  ReleaseEligibilityConfigOptions,
  ReleaseReconcileConfigOptions,
  ReleaseResumeConfigOptions,
  renderReleaseConfig,
  RenderReleaseConfigOptions,
  renderReleaseConfigPlan,
  renderReleaseConfigValidation,
  renderReleaseStatus,
  resumeReleaseConfig,
  runReleaseConfig,
  ReleaseStatusOptions,
  ValidateReleaseConfigFileOptions,
  validateReleaseConfig,
  verifyReleaseConfig
} from "@mannyc1/ts-release/workflows/config"
import {
  writeFailedOperationEvidence,
  writeNamedEvidence,
  writeWorkflowEvidence as persistWorkflowEvidence
} from "@mannyc1/ts-release/workflows/evidence"
import {
  ReleaseInitOptions,
  renderReleaseInitPlan,
  runReleaseInit
} from "@mannyc1/ts-release/workflows/init"
import {
  checkAuthReleaseConfig,
  checkCiReleaseConfig,
  doctorReleaseConfig,
  ReleaseDiagnosticsOptions,
  renderReleaseDiagnostics
} from "@mannyc1/ts-release/workflows/diagnostics"

const configFlag = Flag.string("config").pipe(Flag.withDefault(DEFAULT_CONFIG_PATH))
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

const planCommand = Command.make(
  "plan",
  {
    config: configFlag,
    out: outputFlag,
    format: formatFlag
  },
  Effect.fn("cli.plan")(function*({ config, out, format }) {
    const contents = yield* renderReleaseConfigPlan(PlanReleaseConfigOptions.make({
      configPath: config,
      format
    }))
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
    config: configFlag
  },
  Effect.fn("cli.print")(function*({ config }) {
    const contents = yield* renderReleaseConfigPlan(PlanReleaseConfigOptions.make({
      configPath: config,
      format: "text"
    }))
    yield* Console.log(contents.trimEnd())
  })
)

const explainCommand = Command.make(
  "explain",
  {
    operation: Argument.string("operation"),
    config: configFlag
  },
  Effect.fn("cli.explain")(function*({ operation, config }) {
    const contents = yield* explainReleaseConfigOperation(
      ExplainReleaseConfigOptions.make({ configPath: config, operationId: operation })
    )
    yield* Console.log(contents.trimEnd())
  })
)

const statusCommand = Command.make(
  "status",
  {
    config: configFlag,
    format: statusFormatFlag
  },
  Effect.fn("cli.status")(function*({ config, format }) {
    const contents = yield* renderReleaseStatus(ReleaseStatusOptions.make({
      configPath: config,
      format
    }))
    yield* Console.log(contents.trimEnd())
  })
)

const eligibilityCommand = Command.make(
  "eligibility",
  {
    config: configFlag,
    format: statusFormatFlag
  },
  Effect.fn("cli.eligibility")(function*({ config, format }) {
    const decision = yield* checkReleaseConfigEligibility(
      ReleaseEligibilityConfigOptions.make({
        configPath: config
      })
    )
    const contents = format === "json"
      ? renderReleaseEligibilityJson(decision)
      : renderReleaseEligibilityText(decision)
    yield* Console.log(contents.trimEnd())
  })
)

const writeAndPrintEvidence = Effect.fn("writeAndPrintEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  evidence: EvidenceBundle
) {
  yield* writeNamedEvidence(plan, name, evidence)
  yield* Console.log(renderEvidenceJson(evidence).trimEnd())
})

const writeFailedEvidence = Effect.fn("writeFailedEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  error: { readonly evidence?: EvidenceBundle | undefined }
) {
  const path = yield* writeFailedOperationEvidence(plan, name, error)
  if (path !== undefined && error.evidence !== undefined) {
    yield* Console.log(renderEvidenceJson(error.evidence).trimEnd())
  }
})

const writeWorkflowEvidence = Effect.fn("writeWorkflowEvidence")(function*(
  plan: ReleasePlan,
  evidence: ReleaseWorkflowEvidence | ReleaseWorkflowFailureEvidence
) {
  const paths = yield* persistWorkflowEvidence(plan, evidence)
  yield* Console.log(`${JSON.stringify({ evidence: paths }, null, 2)}`)
})

const validateCommand = Command.make(
  "validate",
  {
    config: configFlag
  },
  Effect.fn("cli.validate")(function*({ config }) {
    const options = ReleaseConfigOptions.make({ configPath: config })
    const plan = yield* planReleaseConfig(options)
    const evidence = yield* validateReleaseConfig(options).pipe(
      Effect.catchTag("OperationFailedError", (error) =>
        writeFailedEvidence(plan, "validation", error).pipe(
          Effect.flatMap(() => Effect.fail(error))
        ))
    )
    yield* writeAndPrintEvidence(plan, "validation", evidence)
  })
)

const validateConfigCommand = Command.make(
  "validate-config",
  {
    config: configFlag,
    format: validationFormatFlag
  },
  Effect.fn("cli.validateConfig")(function*({ config, format }) {
    const contents = yield* renderReleaseConfigValidation(
      ValidateReleaseConfigFileOptions.make({ configPath: config, format })
    )
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
    write,
    overwrite,
    format
  }) {
    const plan = yield* runReleaseInit(ReleaseInitOptions.make({
      template,
      configPath: config,
      package: packageName,
      repo,
      workflow,
      tap,
      bucket,
      githubActions,
      write,
      overwrite,
      format
    }))
    yield* Console.log(renderReleaseInitPlan(plan, format).trimEnd())
  })
)

const diagnosticsOptions = (input: {
  readonly config: string
  readonly format: "json" | "text" | "markdown"
  readonly target?: string | undefined
  readonly workflow?: string | undefined
}) =>
  ReleaseDiagnosticsOptions.make({
    configPath: input.config,
    format: input.format,
    ...(input.target === undefined || input.target.length === 0 ? {} : { target: input.target }),
    ...(input.workflow === undefined || input.workflow.length === 0 ? {} : { workflow: input.workflow })
  })

const checkAuthCommand = Command.make(
  "check-auth",
  {
    config: configFlag,
    target: targetFlag,
    format: diagnosticsFormatFlag
  },
  Effect.fn("cli.checkAuth")(function*({ config, target, format }) {
    const report = yield* checkAuthReleaseConfig(diagnosticsOptions({ config, target, format }))
    yield* Console.log(renderReleaseDiagnostics(report, format).trimEnd())
  })
)

const checkCiCommand = Command.make(
  "check-ci",
  {
    config: configFlag,
    provider: ciProviderFlag,
    workflow: ciWorkflowFlag,
    format: diagnosticsFormatFlag
  },
  Effect.fn("cli.checkCi")(function*({ config, provider, workflow, format }) {
    const report = yield* checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
      configPath: config,
      provider,
      workflow,
      format
    }))
    yield* Console.log(renderReleaseDiagnostics(report, format).trimEnd())
  })
)

const doctorCommand = Command.make(
  "doctor",
  {
    config: configFlag,
    format: diagnosticsFormatFlag
  },
  Effect.fn("cli.doctor")(function*({ config, format }) {
    const report = yield* doctorReleaseConfig(diagnosticsOptions({ config, format }))
    yield* Console.log(renderReleaseDiagnostics(report, format).trimEnd())
  })
)

const renderCommand = Command.make(
  "render",
  {
    config: configFlag,
    execute: executeFlag
  },
  Effect.fn("cli.render")(function*({ config, execute }) {
    const options = RenderReleaseConfigOptions.make({ configPath: config, execute })
    const plan = yield* planReleaseConfig(options)
    const evidence = yield* renderReleaseConfig(options).pipe(
      Effect.catchTag("OperationFailedError", (error) =>
        writeFailedEvidence(plan, "render", error).pipe(
          Effect.flatMap(() => Effect.fail(error))
        ))
    )
    yield* writeAndPrintEvidence(plan, "render", evidence)
  })
)

const executeCommand = Command.make(
  "execute",
  {
    config: configFlag,
    execute: executeFlag,
    approveIrreversible: approveIrreversibleFlag
  },
  Effect.fn("cli.execute")(function*({ config, execute, approveIrreversible }) {
    const options = ReleaseExecutionOptions.make({ configPath: config, execute, approveIrreversible })
    const plan = yield* planReleaseConfig(options)
    const evidence = yield* executeReleaseConfig(options).pipe(
      Effect.catchTag("OperationFailedError", (error) =>
        writeFailedEvidence(plan, "execution", error).pipe(
          Effect.flatMap(() => Effect.fail(error))
        ))
    )
    yield* writeAndPrintEvidence(plan, "execution", evidence)
  })
)

const verifyCommand = Command.make(
  "verify",
  {
    config: configFlag
  },
  Effect.fn("cli.verify")(function*({ config }) {
    const options = ReleaseConfigOptions.make({ configPath: config })
    const plan = yield* planReleaseConfig(options)
    const evidence = yield* verifyReleaseConfig(options).pipe(
      Effect.catchTag("OperationFailedError", (error) =>
        writeFailedEvidence(plan, "verification", error).pipe(
          Effect.flatMap(() => Effect.fail(error))
        ))
    )
    yield* writeAndPrintEvidence(plan, "verification", evidence)
  })
)

const runCommand = Command.make(
  "run",
  {
    config: configFlag,
    execute: executeFlag,
    approveIrreversible: approveIrreversibleFlag
  },
  Effect.fn("cli.run")(function*({ config, execute, approveIrreversible }) {
    const options = ReleaseExecutionOptions.make({ configPath: config, execute, approveIrreversible })
    const plan = yield* planReleaseConfig(options)
    const evidence = yield* runReleaseConfig(options).pipe(
      Effect.catchTag("OperationFailedError", (error) => {
        if (error.workflowEvidence === undefined) {
          return Effect.fail(error)
        }
        return writeWorkflowEvidence(plan, error.workflowEvidence).pipe(
          Effect.flatMap(() => Effect.fail(error))
        )
      })
    )
    yield* writeWorkflowEvidence(plan, evidence)
  })
)

const resumeCommand = Command.make(
  "resume",
  {
    config: configFlag,
    execute: executeFlag,
    approveIrreversible: approveIrreversibleFlag
  },
  Effect.fn("cli.resume")(function*({ config, execute, approveIrreversible }) {
    const options = ReleaseResumeConfigOptions.make({ configPath: config, execute, approveIrreversible })
    const plan = yield* planReleaseConfig(options)
    const evidence = yield* resumeReleaseConfig(options).pipe(
      Effect.catchTag("OperationFailedError", (error) => {
        if (error.workflowEvidence === undefined) {
          return Effect.fail(error)
        }
        return writeWorkflowEvidence(plan, error.workflowEvidence).pipe(
          Effect.flatMap(() => Effect.fail(error))
        )
      })
    )
    yield* writeWorkflowEvidence(plan, evidence)
  })
)

const reconcileCommand = Command.make(
  "reconcile",
  {
    config: configFlag,
    execute: executeFlag
  },
  Effect.fn("cli.reconcile")(function*({ config, execute }) {
    const options = ReleaseReconcileConfigOptions.make({ configPath: config, execute })
    const plan = yield* planReleaseConfig(options)
    const evidence = yield* reconcileReleaseConfig(options).pipe(
      Effect.catchTag("OperationFailedError", (error) =>
        writeFailedEvidence(plan, "reconciliation", error).pipe(
          Effect.flatMap(() => Effect.fail(error))
        ))
    )
    yield* writeAndPrintEvidence(plan, "reconciliation", evidence)
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
    executeCommand,
    verifyCommand,
    runCommand,
    resumeCommand,
    reconcileCommand
  ])
)
