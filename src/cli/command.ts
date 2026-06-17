import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { parseReleaseIntent } from "../config/load.js"
import { DEFAULT_CONFIG_PATH } from "../config/schema.js"
import { EvidenceBundle, ReleaseWorkflowEvidence, ReleaseWorkflowFailureEvidence } from "../domain/evidence.js"
import { ExecutionApproval } from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { ReleaseHost } from "../host/host.js"
import { createReleasePlan } from "../planner/create-release-plan.js"
import { executePlan, renderPlan, runApprovedReleaseWorkflow, validatePlan, verifyPlan } from "../planner/executor.js"
import { renderEvidenceJson, writeEvidenceBundle } from "../planner/evidence-recorder.js"
import { renderPlanJson, renderPlanText } from "../planner/render-plan.js"

export type * from "../types/effect-internal.js"

const configFlag = Flag.string("config").pipe(Flag.withDefault(DEFAULT_CONFIG_PATH))
const outputFlag = Flag.string("out").pipe(Flag.withDefault(""))
const formatFlag = Flag.choice("format", ["json", "text"]).pipe(Flag.withDefault("json"))
const executeFlag = Flag.boolean("execute").pipe(Flag.withDefault(false))
const approveIrreversibleFlag = Flag.boolean("approve-irreversible").pipe(Flag.withDefault(false))

const loadPlanFromConfig = Effect.fn("loadPlanFromConfig")(function*(configPath: string) {
  const host = yield* ReleaseHost
  const contents = yield* host.readFileString(configPath)
  const intent = yield* parseReleaseIntent(contents, configPath)
  return yield* createReleasePlan(intent, ".", configPath)
})

const writeOrPrint = Effect.fn("writeOrPrint")(function*(out: string, contents: string) {
  if (out.length === 0) {
    return yield* Console.log(contents.trimEnd())
  }
  const host = yield* ReleaseHost
  return yield* host.writeFileString(out, contents)
})

const planCommand = Command.make(
  "plan",
  {
    config: configFlag,
    out: outputFlag,
    format: formatFlag
  },
  Effect.fn("cli.plan")(function*({ config, out, format }) {
    const plan = yield* loadPlanFromConfig(config)
    const contents = format === "json" ? renderPlanJson(plan) : renderPlanText(plan)
    yield* writeOrPrint(out, contents)
  })
)

const printCommand = Command.make(
  "print",
  {
    config: configFlag
  },
  Effect.fn("cli.print")(function*({ config }) {
    const plan = yield* loadPlanFromConfig(config)
    yield* Console.log(renderPlanText(plan).trimEnd())
  })
)

const evidencePath = (plan: ReleasePlan, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

const writeAndPrintEvidence = Effect.fn("writeAndPrintEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  evidence: EvidenceBundle
) {
  yield* writeEvidenceBundle(evidencePath(plan, name), evidence)
  yield* Console.log(renderEvidenceJson(evidence).trimEnd())
})

const writeFailedEvidence = Effect.fn("writeFailedEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  error: { readonly evidence?: EvidenceBundle | undefined }
) {
  if (error.evidence !== undefined) {
    yield* writeAndPrintEvidence(plan, name, error.evidence)
  }
})

type WritableWorkflowEvidence = ReleaseWorkflowEvidence | ReleaseWorkflowFailureEvidence

const writeWorkflowEvidence = Effect.fn("writeWorkflowEvidence")(function*(
  plan: ReleasePlan,
  evidence: WritableWorkflowEvidence
) {
  const paths: {
    render?: string
    validation?: string
    execution?: string
    verification?: string
  } = {}
  if (evidence.render !== undefined) {
    paths.render = evidencePath(plan, "render")
    yield* writeEvidenceBundle(paths.render, evidence.render)
  }
  if (evidence.validation !== undefined) {
    paths.validation = evidencePath(plan, "validation")
    yield* writeEvidenceBundle(paths.validation, evidence.validation)
  }
  if (evidence.execution !== undefined) {
    paths.execution = evidencePath(plan, "execution")
    yield* writeEvidenceBundle(paths.execution, evidence.execution)
  }
  if (evidence.verification !== undefined) {
    paths.verification = evidencePath(plan, "verification")
    yield* writeEvidenceBundle(paths.verification, evidence.verification)
  }
  yield* Console.log(`${JSON.stringify({ evidence: paths }, null, 2)}`)
})

const validateCommand = Command.make(
  "validate",
  {
    config: configFlag
  },
  Effect.fn("cli.validate")(function*({ config }) {
    const plan = yield* loadPlanFromConfig(config)
    const evidence = yield* validatePlan(plan).pipe(
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
    const plan = yield* loadPlanFromConfig(config)
    const approval = ExecutionApproval.make({ execute, approveIrreversible: false })
    const evidence = yield* renderPlan(plan, approval).pipe(
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
    const plan = yield* loadPlanFromConfig(config)
    const approval = ExecutionApproval.make({ execute, approveIrreversible })
    const evidence = yield* executePlan(plan, approval).pipe(
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
    const plan = yield* loadPlanFromConfig(config)
    const evidence = yield* verifyPlan(plan).pipe(
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
    const plan = yield* loadPlanFromConfig(config)
    const approval = ExecutionApproval.make({ execute, approveIrreversible })
    const evidence = yield* runApprovedReleaseWorkflow(plan, approval).pipe(
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

export const cli = Command.make("release").pipe(
  Command.withSubcommands([planCommand, renderCommand, validateCommand, printCommand, executeCommand, verifyCommand, runCommand])
)
