import assert from "node:assert/strict"
import { resolve } from "node:path"
import manifest from "../package.json" with { type: "json" }
import compiler from "../node_modules/typescript/package.json" with { type: "json" }
import diagnostics from "../node_modules/@effect/tsgo/package.json" with { type: "json" }
import lint from "../node_modules/oxlint/package.json" with { type: "json" }
import typedLint from "../node_modules/oxlint-tsgolint/package.json" with { type: "json" }

const root = resolve(import.meta.dir, "..")
for (const [installed, expected] of [
  [compiler, manifest.devDependencies.typescript],
  [diagnostics, manifest.devDependencies["@effect/tsgo"]],
  [lint, manifest.devDependencies.oxlint],
  [typedLint, manifest.devDependencies["oxlint-tsgolint"]],
] as const) {
  assert.equal(
    installed.version,
    expected,
    `Unexpected installed ${installed.name}; run bun install --frozen-lockfile`,
  )
}
const child = Bun.spawn(
  [process.execPath, resolve(root, "node_modules/typescript/bin/tsc"), "--version"],
  { cwd: root, stdout: "pipe", stderr: "inherit" },
)
const [exitCode, output] = await Promise.all([child.exited, new Response(child.stdout).text()])
assert.equal(exitCode, 0, "The installed TypeScript compiler must execute")
assert.equal(
  output.trim(),
  `Version ${compiler.version}+effect-tsgo.${diagnostics.version}`,
  "Effect diagnostics are not patched into TypeScript; run bun run prepare after an --ignore-scripts install",
)
console.log(output.trim())
