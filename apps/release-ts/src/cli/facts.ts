// Observation lives here, in the imperative shell, and nowhere else: the
// library's resolver is pure and is handed the facts as a value. This module is
// the only place in the CLI that runs a subprocess.
//
// Everything it cannot establish is simply ABSENT — never guessed, never
// defaulted. An absent fact makes the resolver refuse with a message that says
// what to state by hand, which is the outcome we want when the repository
// cannot answer.
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { CliIo } from "./commands.js"

export interface GitFacts {
  readonly commit?: string
  readonly manifestName?: string
  readonly manifestVersion?: string
  readonly headTagVersion?: string
}

// Argv arrays, never a shell string: nothing here interpolates into a command.
const git = (workspace: string, argv: ReadonlyArray<string>): string | undefined => {
  const result = spawnSync("git", [...argv], { cwd: workspace, encoding: "utf8", stdio: "pipe" })
  if (result.error !== undefined || result.status !== 0) return undefined
  const value = result.stdout.trim()
  return value.length === 0 ? undefined : value
}

const releaseTag = /^v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/u

// Exactly one release-shaped tag at HEAD is a fact. Zero is silence. Several is
// ambiguity, and the observer refuses to break a tie it has no basis to break.
const headTagVersion = (workspace: string): string | undefined => {
  const output = git(workspace, ["tag", "--points-at", "HEAD"])
  if (output === undefined) return undefined
  const versions = output.split("\n")
    .map((line) => releaseTag.exec(line.trim())?.[1])
    .filter((value): value is string => value !== undefined)
  return versions.length === 1 ? versions[0] : undefined
}

const manifest = (
  workspace: string, packagePath: string, io: CliIo
): { name?: string, version?: string } => {
  const path = join(workspace, packagePath, "package.json")
  if (!existsSync(path)) return {}
  const parsed = JSON.parse(io.read(path)) as { name?: unknown, version?: unknown }
  return {
    ...(typeof parsed.name === "string" && parsed.name.length > 0 ? { name: parsed.name } : {}),
    ...(typeof parsed.version === "string" && parsed.version.length > 0
      ? { version: parsed.version }
      : {})
  }
}

export const observeGitFacts = (
  workspace: string, io: CliIo, packagePath = "."
): GitFacts => {
  const { name, version } = manifest(workspace, packagePath, io)
  const commit = git(workspace, ["rev-parse", "HEAD"])
  const tagVersion = headTagVersion(workspace)
  return {
    ...(commit === undefined ? {} : { commit }),
    ...(name === undefined ? {} : { manifestName: name }),
    ...(version === undefined ? {} : { manifestVersion: version }),
    ...(tagVersion === undefined ? {} : { headTagVersion: tagVersion })
  }
}
