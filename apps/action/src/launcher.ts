import { appendFile, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { runApplication, runInterruptibleProcess } from "@mannyc1/ts-release/node"

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

const runActionEnvironment = (environment: NodeJS.ProcessEnv = process.env) =>
  runInterruptibleProcess(async (signal, exitCode) => {
    try {
      const workspace = await realpath(required(environment, "GITHUB_WORKSPACE"))
      const application = await applicationPath(
        workspace,
        required(environment, "INPUT_APPLICATION"),
      )
      const input = JSON.parse(environment.INPUT_INPUT ?? "{}") as unknown
      const report = await runApplication(application, input, signal)
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
      return exitCode() || (complete ? 0 : 2)
    } catch (cause) {
      if (exitCode()) return exitCode()
      throw cause
    }
  })

void runActionEnvironment().then(
  (code) => (process.exitCode = code),
  () => {
    process.stderr.write(
      "ts-release Action failed; inspect the configured durable journal before resuming.\n",
    )
    process.exitCode = 1
  },
)
