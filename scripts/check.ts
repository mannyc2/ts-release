import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
for (const argv of [
  [process.execPath, "scripts/check-toolchain.ts"],
  [process.execPath, "run", "format:check"],
  [process.execPath, "scripts/build.ts"],
  [process.execPath, "run", "lint"],
  [process.execPath, "node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"],
  [
    process.execPath,
    "node_modules/typescript/bin/tsc",
    "--noEmit",
    "-p",
    "packages/ts-release/tsconfig.portable.json",
  ],
  [
    process.execPath,
    "node_modules/typescript/bin/tsc",
    "--noEmit",
    "-p",
    "packages/ts-release/tsconfig.node.json",
  ],
  [process.execPath, "scripts/check-import-rules.ts"],
  [process.execPath, "scripts/check-package-exports.ts"],
]) {
  const child = Bun.spawn(argv, { cwd: root, stdout: "inherit", stderr: "inherit" })
  const code = await child.exited
  if (code !== 0) process.exit(code)
}
