import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const coreSource = readFileSync(join(root, "core/src/index.ts"), "utf8")
if (/outside|custom-publication-provider|Client/.test(coreSource)) {
  throw new Error("core fixture contains provider knowledge")
}

const packedTarballs = []
const pack = (directory) => {
  const output = execFileSync("npm", ["pack", "--json"], {
    cwd: join(root, directory),
    encoding: "utf8"
  })
  const [{ filename }] = JSON.parse(output)
  const tarball = join(root, directory, filename)
  packedTarballs.push(tarball)
  return tarball
}

const consumer = mkdtempSync(join(tmpdir(), "ts-release-provider-consumer-"))
try {
  const core = pack("core")
  const provider = pack("provider")
  const cli = pack("cli")
  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "clean-consumer",
    private: true,
    type: "module"
  }, null, 2))
  execFileSync("npm", [
    "install", "--ignore-scripts", "--no-audit", "--no-fund",
    "effect@4.0.0-rc.109", core, provider, cli
  ], { cwd: consumer, stdio: "inherit" })

  writeFileSync(join(consumer, "release.config.mjs"), `
import { makeArtifact } from "@ts-release-research/core"
import * as Outside from "@outside/custom-publication-provider"
import { Effect } from "effect"

const artifact = makeArtifact({
  id: "artifact-1",
  logicalName: "tool.bin",
  bytes: new Uint8Array([1, 2, 3, 4])
})

export default Outside.publish(artifact).pipe(
  Effect.provide(Outside.layer({ destination: "outside://scratch" }))
)
`)

  const output = execFileSync(
    process.execPath,
    [join(consumer, "node_modules/@ts-release-research/dynamic-cli/dist/index.js"), join(consumer, "release.config.mjs")],
    { cwd: consumer, encoding: "utf8" }
  ).trim()
  const receipt = JSON.parse(output)
  if (receipt.destination !== "outside://scratch" || receipt.acceptedBytes !== 4) {
    throw new Error(`unexpected clean-consumer receipt: ${output}`)
  }
  console.log(output)
} finally {
  rmSync(consumer, { recursive: true, force: true })
  for (const tarball of packedTarballs) rmSync(tarball, { force: true })
}
