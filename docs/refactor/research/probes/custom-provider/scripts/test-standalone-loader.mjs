import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const output = join(root, "research-release-standalone")

const packedTarballs = []
const pack = (directory) => {
  const packed = execFileSync("npm", ["pack", "--json"], {
    cwd: join(root, directory),
    encoding: "utf8"
  })
  const [{ filename }] = JSON.parse(packed)
  const tarball = join(root, directory, filename)
  packedTarballs.push(tarball)
  return tarball
}

const consumer = mkdtempSync(join(tmpdir(), "ts-release-standalone-consumer-"))
try {
  const core = pack("core")
  const provider = pack("provider")
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
    classification: "informational",
    capability: "prebuilt-single-file-cli-loads-consumer-installed-provider",
    status: run.status,
    signal: run.signal,
    stdout: run.stdout.trim(),
    stderr: run.stderr.trim(),
    loadedUnknownProvider: run.status === 0 && run.stdout.includes("outside://standalone")
  }
  console.log(JSON.stringify(result, null, 2))

  if (result.loadedUnknownProvider) {
    console.error("INFORMATIONAL RESULT: the compiled executable loaded the consumer-installed provider in this environment")
  } else {
    console.error("INFORMATIONAL LIMITATION: the compiled executable did not load the consumer-installed provider")
  }

  if (process.env.REQUIRE_STANDALONE_UNKNOWN_PROVIDER === "1" && !result.loadedUnknownProvider) {
    throw new Error("standalone executable did not load the consumer-installed provider")
  }
} finally {
  rmSync(consumer, { recursive: true, force: true })
  rmSync(output, { force: true })
  for (const tarball of packedTarballs) rmSync(tarball, { force: true })
}
