import { rm } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const build = Bun.spawn([process.execPath, "scripts/build.ts"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
})
if ((await build.exited) !== 0) process.exit(1)

const output = resolve(root, "apps/action/dist")
await rm(output, { recursive: true, force: true })
const result = await Bun.build({
  entrypoints: [resolve(root, "apps/action/src/launcher.ts")],
  outdir: output,
  naming: "launcher.cjs",
  target: "node",
  format: "cjs",
  minify: false,
  sourcemap: "none",
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
