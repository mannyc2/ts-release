import * as Schema from "effect/Schema"

export const ActionCommand = Schema.Literals([
  "plan",
  "validate-config",
  "doctor",
  "check-auth",
  "check-ci",
  "validate",
  "run",
  "reconcile"
])
export type ActionCommand = typeof ActionCommand.Type

export const ActionFormat = Schema.Literals(["json", "text", "summary", "markdown"])
export type ActionFormat = typeof ActionFormat.Type

export const ActionRuntime = Schema.Literals(["bundled", "workspace"])
export type ActionRuntime = typeof ActionRuntime.Type

export class ActionOptions extends Schema.Class<ActionOptions>("ActionOptions")({
  root: Schema.String,
  command: ActionCommand,
  config: Schema.String,
  format: ActionFormat,
  writeStepSummary: Schema.Boolean,
  planPath: Schema.String,
  failOnWarnings: Schema.Boolean,
  target: Schema.optionalKey(Schema.String),
  workflow: Schema.optionalKey(Schema.String),
  runtime: ActionRuntime,
  execute: Schema.Boolean,
  approveIrreversible: Schema.Boolean,
  uploadEvidence: Schema.Boolean,
  evidenceArtifactName: Schema.String
}) {}

export class ActionInputError extends Schema.TaggedErrorClass<ActionInputError>()("ActionInputError", {
  input: Schema.String,
  reason: Schema.String
}) {}

export interface ActionInputReader {
  readonly getInput: (name: string) => string
}

const commands: ReadonlyArray<ActionCommand> = [
  "plan",
  "validate-config",
  "doctor",
  "check-auth",
  "check-ci",
  "validate",
  "run",
  "reconcile"
]

const formats: ReadonlyArray<ActionFormat> = ["json", "text", "summary", "markdown"]
const runtimes: ReadonlyArray<ActionRuntime> = ["bundled", "workspace"]

const isCommand = (value: string): value is ActionCommand =>
  commands.some((command) => command === value)

const isFormat = (value: string): value is ActionFormat =>
  formats.some((format) => format === value)

const isRuntime = (value: string): value is ActionRuntime =>
  runtimes.some((runtime) => runtime === value)

const inputOrDefault = (reader: ActionInputReader, name: string, fallback: string): string => {
  const value = reader.getInput(name).trim()
  return value.length === 0 ? fallback : value
}

const configInputOrDefault = (reader: ActionInputReader, fallback: string): string => {
  const raw = reader.getInput("config")
  if (raw.length === 0) {
    return fallback
  }
  const value = raw.trim()
  if (value.length === 0) {
    throw ActionInputError.make({
      input: "config",
      reason: "config must be a non-empty path."
    })
  }
  return value
}

const optionalInput = (reader: ActionInputReader, name: string): string | undefined => {
  const value = reader.getInput(name).trim()
  return value.length === 0 ? undefined : value
}

const parseBooleanInput = (reader: ActionInputReader, name: string, fallback: boolean): boolean => {
  const value = reader.getInput(name).trim()
  if (value.length === 0) {
    return fallback
  }
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  throw ActionInputError.make({
    input: name,
    reason: "Expected true or false."
  })
}

const parseCommandInput = (value: string): ActionCommand => {
  if (isCommand(value)) {
    return value
  }
  throw ActionInputError.make({
    input: "command",
    reason: `Unsupported command ${value}.`
  })
}

const parseFormatInput = (value: string): ActionFormat => {
  if (isFormat(value)) {
    return value
  }
  throw ActionInputError.make({
    input: "format",
    reason: `Unsupported format ${value}.`
  })
}

const parseRuntimeInput = (value: string): ActionRuntime => {
  if (isRuntime(value)) {
    return value
  }
  throw ActionInputError.make({
    input: "runtime",
    reason: `Unsupported runtime ${value}.`
  })
}

export const readActionOptions = (reader: ActionInputReader, root: string): ActionOptions => {
  const target = optionalInput(reader, "target")
  const workflow = optionalInput(reader, "workflow")
  return ActionOptions.make({
    root,
    command: parseCommandInput(inputOrDefault(reader, "command", "plan")),
    config: configInputOrDefault(reader, "release.config.json"),
    format: parseFormatInput(inputOrDefault(reader, "format", "markdown")),
    writeStepSummary: parseBooleanInput(reader, "write-step-summary", true),
    planPath: inputOrDefault(reader, "plan-path", "release-plan.md"),
    failOnWarnings: parseBooleanInput(reader, "fail-on-warnings", false),
    ...(target === undefined ? {} : { target }),
    ...(workflow === undefined ? {} : { workflow }),
    runtime: parseRuntimeInput(inputOrDefault(reader, "runtime", "bundled")),
    execute: parseBooleanInput(reader, "execute", false),
    approveIrreversible: parseBooleanInput(reader, "approve-irreversible", false),
    uploadEvidence: parseBooleanInput(reader, "upload-evidence", false),
    evidenceArtifactName: inputOrDefault(reader, "evidence-artifact-name", "release-evidence")
  })
}
