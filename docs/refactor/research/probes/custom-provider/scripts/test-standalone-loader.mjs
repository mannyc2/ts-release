import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(new URL("..", import.meta.url).pathname)
const output = join(root, "research-release-standalone")

const pack = (directory) => {
  const packed = execFileSync("npm", ["pack", "--json"], {
    cwd: join(root, directory),
    encoding: "utf8"
  })
  const [{ filename }] = JSON.parse(packed)
  return join(root, directory, filename)
}

const core = pack("core")
const provider = pack("provider")
const consumer = mkdtempSync(join(tmpdir(), "ts-release-standalone-consumer-"))
try {
  execFileSync("bun", [
    "build",
    "cli/src/index.ts",
    "--compile",
    "--outfile",
    output
  ], { cwd: root, stdio: "inherit" })

  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "standalone-consumer",
    private: true,
    type: "module"
  }, null, 2))
  execFileSync("npm", [
    "install", "--ignore-scripts", "--no-audit", "--no-fund",
    "effect@4.0.0-rc.109", core, provider
  ], { cwd: consumer, stdio: "inherit" })
  writeFileSync(join(consumer, "release.config.mjs"), `
import { makeArtifact } from "@ts-release-research/core"
import * as Outside from "@outside/custom-publication-provider"
import { Effect } from "effect"
export default Outside.publish(makeArtifact({
  id: "standalone-artifact",
  logicalName: "standalone.bin",
  bytes: new Uint8Array([8, 9])
})).pipe(Effect.provide(Outside.layer({ destination: "outside://standalone" })))
`)

  const run = spawnSync(output, [join(consumer, "release.config.mjs")], {
    cwd: consumer,
    encoding: "utf8"
  })
  const result = {
    status: run.status,
    signal: run.signal,
    stdout: run.stdout.trim(),
    stderr: run.stderr.trim(),
    loadedUnknownProvider: run.status === 0 && run.stdout.includes("outside://standalone")
  }
  console.log(JSON.stringify(result, null, 2))

  const report = readFileSync(join(root, "README.md"), "utf8")
  if (!report.includes("standalone")) throw new Error("README must state the standalone boundary")
} finally {
  rmSync(consumer, { recursive: true, force: true })
  rmSync(output, { force: true })
  for (const tarball of [core, provider]) rmSync(tarball, { force: true })
}
