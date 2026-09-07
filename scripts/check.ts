import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
for (const argv of [
  [process.execPath, "scripts/build.ts"],
  [process.execPath, "node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"],
]) {
  const child = Bun.spawn(argv, { cwd: root, stdout: "inherit", stderr: "inherit" })
  const code = await child.exited
  if (code !== 0) process.exit(code)
}
