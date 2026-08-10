// The published command is a Node bundle. This gate checks the bundle's real
// host and the one public command vocabulary, without invoking a release.
import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { cwd, exit } from "node:process"
import { buildCliBundle, cliBundlePath } from "./build-cli-bundle.js"
import { commandNames } from "../apps/release-ts/src/cli/commands.js"

const root = cwd()

const run = (argv: ReadonlyArray<string>) => spawnSync(argv[0]!, argv.slice(1), {
  cwd: root, encoding: "utf8", stdio: "pipe"
})

try {
  await buildCliBundle()
  if (!existsSync(cliBundlePath)) throw new Error(`CLI bundle is absent at ${cliBundlePath}.`)
  const bundle = readFileSync(cliBundlePath, "utf8")
  if (!bundle.startsWith("#!/usr/bin/env node")) throw new Error("CLI bundle must use the Node shebang.")
  if (bundle.includes("@effect/platform-bun") || /\bBun\.[A-Za-z_$][A-Za-z0-9_$]*/u.test(bundle)) {
    throw new Error("CLI bundle carries a Bun runtime dependency.")
  }
  const node = run(["node", "--version"])
  if (node.status !== 0) throw new Error("Node is unavailable for the published bundle.")
  const missing = commandNames.filter((name) => !bundle.includes(`\"${name}\"`))
  if (missing.length > 0) throw new Error(`CLI help omits ${missing.join(", ")}.`)
  console.log("CLI bundle runs under Node and exposes the six public commands.")
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
