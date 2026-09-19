import { appendFile, readFile, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { findPackageJSON } from "node:module"
import { pathToFileURL } from "node:url"

const required = (environment: NodeJS.ProcessEnv, name: string): string => {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`GitHub Action requires ${name}`)
  return value
}

const inside = (root: string, child: string): boolean => {
  const path = relative(root, child)
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

const applicationPath = async (workspace: string, input: string): Promise<string> => {
  const candidate = resolve(workspace, input)
  const actual = inside(workspace, candidate) ? await realpath(candidate) : candidate
  if (!inside(workspace, actual)) throw new Error("Action application is outside GITHUB_WORKSPACE")
  return actual
}

const runActionEnvironment = async (environment: NodeJS.ProcessEnv = process.env) => {
  const workspace = await realpath(required(environment, "GITHUB_WORKSPACE"))
  const application = await applicationPath(workspace, required(environment, "INPUT_APPLICATION"))
  // Use the application's installed core instance. Bundling another core creates
  // separate native transport authority registries and rejects real providers.
  const manifestPath = findPackageJSON("@mannyc1/ts-release/node", pathToFileURL(application))
  if (!manifestPath) throw new Error("Install @mannyc1/ts-release in the application workspace")
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  const entry = resolve(dirname(manifestPath), manifest.exports["./node"].import)
  const { runApplication, runInterruptibleProcess } = (await import(
    pathToFileURL(entry).href
  )) as typeof import("@mannyc1/ts-release/node")
  return runInterruptibleProcess(async (signal, exitCode) => {
    try {
      const input = JSON.parse(environment.INPUT_INPUT ?? "{}") as unknown
      const observe = environment.INPUT_OBSERVE ?? "false"
      if (!["true", "false"].includes(observe)) throw new Error("observe must be true or false")
      const report = await runApplication(
        application,
        input,
        signal,
        observe === "true" ? "observe" : "run",
      )
      const revision = String(report.journal.revision)
      if (!/^[a-f0-9]{64}$/u.test(report.plan.planId) || !/^\d+$/u.test(revision))
        throw new Error("Action report contains invalid output identities")
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
  () => {
    process.stderr.write(
      "ts-release Action failed; verify the workspace dependency installation, application/input and durable journal access. Rerun with observe: true to inspect progress before resuming.\n",
    )
    process.exitCode = 1
  },
)
