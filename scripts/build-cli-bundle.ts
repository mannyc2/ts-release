// The published `ts-release` bin. It is a BUNDLE, not the TypeScript entry:
// npm installs land on machines with only node, where a `#!/usr/bin/env bun`
// TypeScript file fails at spawn. Same shape as the Action's bundle build
// (target node, format esm), entry swapped, output under the gitignored root
// dist/ that `build` already owns. This is a BUILD-TIME script, so it runs on
// the Bun host and may use Bun.build — the CLI has no --define, and the
// version must be injected rather than imported (see node-main.ts).
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { cwd, exit } from "node:process"

const root = cwd()
export const cliBundlePath = join(root, "dist", "bin", "ts-release.js")
export const cliEntryPath = "apps/release-ts/src/cli/node-main.ts"
const shebang = "#!/usr/bin/env node"

export const buildCliBundle = async (outputPath: string = cliBundlePath): Promise<void> => {
  mkdirSync(dirname(outputPath), { recursive: true })
  const version = String(
    (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: unknown }).version
  )
  const built = await Bun.build({
    entrypoints: [join(root, cliEntryPath)],
    target: "node",
    format: "esm",
    define: { __TS_RELEASE_VERSION__: JSON.stringify(version) }
  })
  if (!built.success || built.outputs[0] === undefined) {
    throw new Error(
      ["CLI bundle build failed.", ...built.logs.map((entry) => String(entry))].join("\n")
    )
  }
  // The bundler emits no shebang, and npm's POSIX bin wiring needs one on the
  // file it links.
  writeFileSync(outputPath, `${shebang}\n${await built.outputs[0].text()}`)
  chmodSync(outputPath, 0o755)
}

if (import.meta.main) {
  try {
    await buildCliBundle()
    console.log(`Built ${cliBundlePath.slice(root.length + 1)} from ${cliEntryPath}.`)
  } catch (cause) {
    console.error(String(cause instanceof Error ? cause.message : cause))
    exit(1)
  }
}
