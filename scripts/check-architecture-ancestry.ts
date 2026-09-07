import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const { ancestry } = await Bun.file(resolve(root, "docs/refactor/architecture-program/handoff/waves.json")).json()
for (const { argv, expectedExit } of ancestry.checks) {
  const result = Bun.spawnSync(argv, { cwd: root, stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== expectedExit) {
    throw new Error(`Ancestry gate failed: ${argv.join(" ")} expected ${expectedExit}, received ${result.exitCode}\n${result.stderr}`)
  }
}
console.log("Ancestry verified: PR21 included; PR22 and overlay remain evidence donors")
