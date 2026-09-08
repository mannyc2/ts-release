import { readdir, rm } from "node:fs/promises"
import { resolve } from "node:path"

// Build public packages in kernel-first DAG order, then the private application.
const root = resolve(import.meta.dir, "..")
const directories = (await readdir(resolve(root, "packages"))).sort()
const ordered = ["ts-release", ...directories.filter((name) => name !== "ts-release")]
for (const directory of ordered) {
  const config = resolve(root, "packages", directory, "tsconfig.build.json")
  await rm(resolve(root, "packages", directory, "dist"), { recursive: true, force: true })
  const child = Bun.spawn(
    [process.execPath, resolve(root, "node_modules/typescript/bin/tsc"), "-p", config],
    { cwd: root, stdout: "inherit", stderr: "inherit" },
  )
  const code = await child.exited
  if (code !== 0) process.exit(code)
}
await rm(resolve(root, "apps/self-release/dist"), { recursive: true, force: true })
const application = Bun.spawn(
  [
    process.execPath,
    resolve(root, "node_modules/typescript/bin/tsc"),
    "-p",
    resolve(root, "apps/self-release/tsconfig.build.json"),
  ],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
)
process.exitCode = await application.exited
