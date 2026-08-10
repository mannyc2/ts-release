// Stages the standalone Action mirror locally. It never performs network or
// git publication work; an operator can inspect the generated directory.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { cwd, exit } from "node:process"
import { join } from "node:path"

const root = cwd()
const actionRoot = join(root, "apps", "ts-release-action")
const mirrorRoot = join(root, ".release", "action-mirror")

try {
  if (!existsSync(join(actionRoot, "action.yml"))) throw new Error("Action manifest is missing.")
  rmSync(mirrorRoot, { recursive: true, force: true })
  mkdirSync(mirrorRoot, { recursive: true })
  cpSync(join(actionRoot, "action.yml"), join(mirrorRoot, "action.yml"))
  cpSync(join(actionRoot, "dist"), join(mirrorRoot, "dist"), { recursive: true })
  const manifest = readFileSync(join(mirrorRoot, "action.yml"), "utf8")
  writeFileSync(join(mirrorRoot, "README.md"), `# ts-release-action\n\n${manifest.split("\n")[1] ?? "Automatic release Action."}\n`)
  console.log(`Staged ${mirrorRoot.slice(root.length + 1)}. Inspect it before any external publication.`)
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
