import { appendFile, readFile, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { findPackageJSON } from "node:module"
import { pathToFileURL } from "node:url"

/** The launcher's own configuration failures carry a code like a ReleaseError. */
// The standalone Action cannot bundle Effect; it loads the application's one core instance below.
// @effect-diagnostics-next-line extendsNativeError:off
class ActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ActionError"
  }
}
const bounded = (text: string): string =>
  text
    // oxlint-disable-next-line eslint/no-control-regex -- Control bytes must not enter workflow logs.
    .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, " ")
    .trim()
    .slice(0, 512)
/** ActionError and the application's typed ReleaseError are the diagnostic
 * contract. Any other failure is named only; its message, paths and native
 * output never reach the job log. */
const describeFailure = (cause: unknown): string => {
  const value = typeof cause === "object" && cause !== null ? cause : {}
  const tag = "_tag" in value ? value._tag : undefined
  const code = "code" in value ? value.code : undefined
  const message = "message" in value ? value.message : undefined
  if (
    (cause instanceof ActionError || tag === "ReleaseError") &&
    typeof code === "string" &&
    typeof message === "string"
  )
    return `${bounded(code)}: ${bounded(message)}`
  const name = typeof tag === "string" ? tag : cause instanceof Error ? cause.name : typeof cause
  const diagnosticCode = typeof code === "string" ? ` ${code}` : ""
  return `${bounded(`${name}${diagnosticCode}`) || "unknown"} (only a ReleaseError's code and message are printed)`
}

const required = (environment: NodeJS.ProcessEnv, name: string): string => {
  const value = environment[name]?.trim()
  if (!value) throw new ActionError("action-environment", `GitHub Action requires ${name}`)
  return value
}

const inside = (root: string, child: string): boolean => {
  const path = relative(root, child)
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

const applicationPath = async (workspace: string, input: string): Promise<string> => {
  const candidate = resolve(workspace, input)
  const actual = inside(workspace, candidate) ? await realpath(candidate) : candidate
  if (!inside(workspace, actual))
    throw new ActionError("action-workspace", "Action application must be inside GITHUB_WORKSPACE")
  return actual
}

const runActionEnvironment = async (environment: NodeJS.ProcessEnv = process.env) => {
  const workspace = await realpath(required(environment, "GITHUB_WORKSPACE"))
  const application = await applicationPath(workspace, required(environment, "INPUT_APPLICATION"))
  // Use the application's installed core instance. Bundling another core creates
  // separate native transport authority registries and rejects real providers.
  const manifestPath = findPackageJSON("@mannyc1/ts-release/node", pathToFileURL(application))
  if (!manifestPath)
    throw new ActionError(
      "action-install",
      "Install @mannyc1/ts-release in the application workspace",
    )
  const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"))
  const exports =
    typeof manifest === "object" && manifest !== null && "exports" in manifest
      ? manifest.exports
      : undefined
  const node =
    typeof exports === "object" && exports !== null && "./node" in exports
      ? exports["./node"]
      : undefined
  if (
    typeof node !== "object" ||
    node === null ||
    !("import" in node) ||
    typeof node.import !== "string"
  )
    throw new ActionError("action-install", "Installed ts-release must expose its Node entry")
  const entry = resolve(dirname(manifestPath), node.import)
  const loaded: unknown = await import(pathToFileURL(entry).href)
  if (
    typeof loaded !== "object" ||
    loaded === null ||
    !("runApplication" in loaded) ||
    typeof loaded.runApplication !== "function" ||
    !("runInterruptibleProcess" in loaded) ||
    typeof loaded.runInterruptibleProcess !== "function"
  )
    throw new ActionError(
      "action-install",
      "Installed ts-release must expose its application runner",
    )
  // The trusted application's installed ABI is exercised by check:packed-action; a second bundled kernel breaks authority identity.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JavaScript module loading cannot infer the installed core's checked function signatures.
  const { runApplication, runInterruptibleProcess } = loaded as Pick<
    typeof import("@mannyc1/ts-release/node"),
    "runApplication" | "runInterruptibleProcess"
  >
  return runInterruptibleProcess(async (signal, exitCode) => {
    try {
      let input: unknown
      try {
        input = JSON.parse(environment.INPUT_INPUT ?? "{}")
      } catch {
        throw new ActionError("action-input", "Action input must be a JSON document")
      }
      const observe = environment.INPUT_OBSERVE ?? "false"
      if (!["true", "false"].includes(observe))
        throw new ActionError("action-observe", "observe must be true or false")
      const report = await runApplication(
        application,
        input,
        signal,
        observe === "true" ? "observe" : "run",
      )
      const revision = String(report.journal.revision)
      if (!/^[a-f0-9]{64}$/u.test(report.plan.planId) || !/^\d+$/u.test(revision))
        throw new ActionError("action-report", "Action report contains invalid output identities")
      await appendFile(
        required(environment, "GITHUB_OUTPUT"),
        `plan-id=${report.plan.planId}\njournal-revision=${revision}\n`,
        { encoding: "utf8" },
      )
      process.stdout.write(`${JSON.stringify(report)}\n`)
      const complete = report.operations.every((operation) => operation.status === "Satisfied")
      if (!complete)
        process.stderr.write(
          "ts-release Action: publication is incomplete. Inspect the JSON operation statuses; rerun with observe: true and the same application, input, Bundle, Plan and durable journal to refresh progress. Unresolved dispatches still require evidence before retry.\n",
        )
      return exitCode() || (complete ? 0 : 2)
    } catch (cause) {
      if (exitCode()) return exitCode()
      throw cause
    }
  })
}

void runActionEnvironment().then(
  (code) => (process.exitCode = code),
  (cause) => {
    process.stderr.write(
      `ts-release Action failed: ${describeFailure(cause)}\n` +
        "ts-release Action: verify the workspace dependency installation, application/input and durable journal access. Rerun with observe: true to inspect progress before resuming.\n",
    )
    process.exitCode = 1
  },
)
