import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import {
  checkReleaseConfigEligibility,
  executeReleaseConfig,
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
  renderReleaseStatus,
  resumeReleaseConfig,
  runReleaseConfig,
  ReleaseStatusOptions,
  validateReleaseConfig,
  verifyReleaseConfig
} from "../workflows/config.js"
import { DEFAULT_CONFIG_PATH } from "../config/schema.js"
import { EvidenceBundle, ReleaseWorkflowEvidence, ReleaseWorkflowFailureEvidence } from "../domain/evidence.js"
import { ReleasePlan } from "../domain/release.js"
import { renderEvidenceJson } from "../planner/evidence-recorder.js"
import {
  renderReleaseEligibilityJson,
  renderReleaseEligibilityText
} from "../planner/release-eligibility.js"
import {
  writeFailedOperationEvidence,
  writeNamedEvidence,
  writeWorkflowEvidence as persistWorkflowEvidence
} from "../workflows/evidence.js"

export type * from "../types/effect-internal.js"

const configFlag = Flag.string("config").pipe(Flag.withDefault(DEFAULT_CONFIG_PATH))
const outputFlag = Flag.string("out").pipe(Flag.withDefault(""))
const formatFlag = Flag.choice("format", ["json", "text"]).pipe(Flag.withDefault("json"))
const statusFormatFlag = Flag.choice("format", ["json", "text"]).pipe(Flag.withDefault("text"))
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
    renderCommand,
    validateCommand,
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
