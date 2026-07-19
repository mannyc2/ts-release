import * as Schema from "effect/Schema"

export const ActionCommand = Schema.Literals(["plan", "doctor", "build", "release", "verify"])
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
  runtime: ActionRuntime,
  snapshot: Schema.Boolean,
  execute: Schema.Boolean,
  approvePublish: Schema.Boolean,
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

const parseChoice = <const L extends ReadonlyArray<string>>(
  schema: { readonly literals: L },
  name: string,
  value: string
): L[number] => {
  if (schema.literals.includes(value)) return value as L[number]
  throw ActionInputError.make({ input: name, reason: `Unsupported ${name} ${value}.` })
}

const inputOrDefault = (
  reader: ActionInputReader,
  name: string,
  fallback: string,
  rejectWhitespace: boolean = false
): string => {
  const raw = reader.getInput(name)
  if (raw.length === 0) return fallback
  const value = raw.trim()
  if (value.length > 0) return value
  if (!rejectWhitespace) return fallback
  throw ActionInputError.make({ input: name, reason: `${name} must be a non-empty path.` })
}

const optionalInput = (reader: ActionInputReader, name: string): string | undefined => {
  const value = reader.getInput(name).trim()
  return value.length === 0 ? undefined : value
}

const parseBooleanInput = (reader: ActionInputReader, name: string, fallback: boolean): boolean => {
  const value = reader.getInput(name).trim()
  if (value.length === 0) return fallback
  if (value === "true" || value === "false") return value === "true"
  throw ActionInputError.make({ input: name, reason: "Expected true or false." })
}

export const readActionOptions = (reader: ActionInputReader, root: string): ActionOptions => {
  const target = optionalInput(reader, "target")
  return ActionOptions.make({
    root,
    command: parseChoice(ActionCommand, "command", inputOrDefault(reader, "command", "plan")),
    config: inputOrDefault(reader, "config", "release.config.json", true),
    format: parseChoice(ActionFormat, "format", inputOrDefault(reader, "format", "markdown")),
    writeStepSummary: parseBooleanInput(reader, "write-step-summary", true),
    planPath: inputOrDefault(reader, "plan-path", "release-plan.md"),
    failOnWarnings: parseBooleanInput(reader, "fail-on-warnings", false),
    ...(target === undefined ? {} : { target }),
    runtime: parseChoice(ActionRuntime, "runtime", inputOrDefault(reader, "runtime", "bundled")),
    snapshot: parseBooleanInput(reader, "snapshot", false),
    execute: parseBooleanInput(reader, "execute", false),
    approvePublish: parseBooleanInput(reader, "approve-publish", false),
    uploadEvidence: parseBooleanInput(reader, "upload-evidence", false),
    evidenceArtifactName: inputOrDefault(reader, "evidence-artifact-name", "release-evidence")
  })
}
