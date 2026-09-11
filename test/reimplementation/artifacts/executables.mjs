import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Layer } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as BunCompiler from "effect-build-bun"
import * as DenoCompiler from "effect-build-deno"
import * as Esbuild from "effect-build-esbuild"
import * as NodeSea from "effect-build-node-sea"
import { adoptFile } from "@mannyc1/ts-release/effect-build"
import { finalize, encodeBundle, loadBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner } from "@mannyc1/ts-release/node"

const work = await mkdtemp("/tmp/ts-release-producer-executables-")
const producer = join(work, "producer"),
  owned = join(work, "owned"),
  delivery = join(work, "delivery")
await mkdir(producer)
await mkdir(delivery)
const tools = process.env.TS_RELEASE_PRODUCER_TOOLS ?? "/tmp/ts-release-native-producers"
const bun =
  process.env.TS_RELEASE_PRODUCER_BUN ?? execFileSync("which", ["bun"], { encoding: "utf8" }).trim()
const owner = fileContentOwner(owned)
const source = `const runtime = globalThis as { Deno?: { args: string[] }; process?: { argv: string[] } }
const args = runtime.Deno?.args ?? runtime.process!.argv.slice(2)
if (args.length !== 1 || args[0] !== "--version") throw new Error("expected --version")
console.log("ts-release producer fixture 1.0.0")
`
const entrypoint = join(producer, "main.ts")
await writeFile(entrypoint, source)
const bunCells = [
  ["bun-darwin-x64", "darwin-x64"],
  ["bun-darwin-arm64", "darwin-arm64"],
  ["bun-linux-x64", "linux-x64"],
  ["bun-linux-x64-musl", "linux-x64-musl"],
  ["bun-linux-arm64", "linux-arm64"],
  ["bun-windows-x64", "windows-x64"],
]
const denoCells = [
  ["x86_64-apple-darwin", "darwin-x64"],
  ["aarch64-apple-darwin", "darwin-arm64"],
  ["x86_64-unknown-linux-gnu", "linux-x64"],
  ["aarch64-unknown-linux-gnu", "linux-arm64"],
  ["x86_64-pc-windows-msvc", "windows-x64"],
  ["aarch64-pc-windows-msvc", "windows-arm64"],
]
const records = [],
  checks = []
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, label)
  checks.push(label)
}
const layers = Layer.mergeAll(
  BunCompiler.layer({ executable: bun }),
  DenoCompiler.layer({ executable: join(tools, "deno") }),
  NodeSea.layer({ executable: join(tools, "node") }),
)
const adopt = (provider, native) =>
  Effect.gen(function* () {
    const file = yield* adoptFile(
      owner,
      `${provider}-${native.target}${native.format === "pe" ? ".exe" : ""}`,
      native,
    )
    check(`${provider}/${native.target} exact owned size`, file.content.bytes, native.bytes)
    check(`${provider}/${native.target} exact owned digest`, file.content.sha256, native.sha256)
    check(`${provider}/${native.target} executable mode`, file.deliveryMode, 0o755)
    check(`${provider}/${native.target} native metadata`, file.executable, {
      target: native.target,
      format: native.format,
    })
    records.push({ provider, native, file })
  })
const application = Effect.gen(function* () {
  for (const [index, [target, expected]] of bunCells.entries()) {
    const native = yield* BunCompiler.compile({
      entrypoints: [entrypoint],
      outfile: join(producer, `${target}${target.includes("windows") ? ".exe" : ""}`),
      target,
      options: {
        autoloadDotenv: false,
        autoloadBunfig: false,
        autoloadTsconfig: false,
        autoloadPackageJson: false,
      },
    })
    check(`bun/${index} exact target`, native.target, expected)
    check(
      `bun/${index} exact producer`,
      [native.producedBy.name, native.producedBy.version],
      ["bun", "1.3.14"],
    )
    yield* adopt("bun", native)
  }
  for (const [index, [target, expected]] of denoCells.entries()) {
    const native = yield* DenoCompiler.compile({
      entrypoint,
      outfile: join(producer, `deno-${target}${target.includes("windows") ? ".exe" : ""}`),
      target,
      env: { DENO_DIR: join(work, "deno-cache") },
      options: { config: false, lock: false, noNpm: true, noRemote: true, check: false },
    })
    check(`deno/${index} exact target`, native.target, expected)
    check(
      `deno/${index} exact producer`,
      [native.producedBy.name, native.producedBy.version],
      ["deno", "2.9.5"],
    )
    yield* adopt("deno", native)
  }
  const built = yield* Esbuild.build({
    stdin: { contents: source, loader: "ts" },
    write: false,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node26",
  })
  check("esbuild exact single in-memory output", built.outputFiles.length, 1)
  const bundled = join(producer, "main.cjs")
  yield* Effect.promise(() => writeFile(bundled, built.outputFiles[0].contents))
  const main = yield* Artifact.file(bundled, { name: "esbuild", version: Esbuild.tested })
  const native = yield* NodeSea.assemble({
    main,
    outfile: join(producer, "node-sea"),
    disableExperimentalSEAWarning: true,
  })
  check(
    "SEA exact producer",
    [native.producedBy.name, native.producedBy.version],
    ["node", "26.7.0"],
  )
  check("SEA exact native cell", [native.format, native.target], ["elf", "linux-x64"])
  const file = yield* adoptFile(owner, "node-linux-x64", native)
  records.push({
    provider: "node-sea",
    native,
    file,
    esbuild: {
      version: Esbuild.tested,
      bundledSha256: createHash("sha256").update(built.outputFiles[0].contents).digest("hex"),
    },
  })
  return yield* finalize(records.map((row) => row.file))
})
try {
  const bundle = await Effect.runPromise(
    application.pipe(Effect.provide(layers), Effect.provide(NodeServices.layer)),
  )
  await writeFile(join(work, "bundle.json"), encodeBundle(bundle))
  await rm(producer, { recursive: true })
  const reopened = fileContentOwner(owned)
  check(
    "all thirteen survive producer deletion",
    (await Effect.runPromise(loadBundle(reopened, await readFile(join(work, "bundle.json")))))
      .artifacts,
    bundle.artifacts,
  )
  const executions = []
  for (const row of records) {
    if (row.file.executable.target !== "linux-x64") continue
    const path = join(delivery, row.file.logicalName)
    await writeFile(path, await Effect.runPromise(reopened.read(row.file.content)))
    await chmod(path, row.file.deliveryMode)
    const stdout = execFileSync(path, ["--version"], { encoding: "utf8", timeout: 15000 })
    check(
      `${row.provider} native installed --version`,
      stdout,
      "ts-release producer fixture 1.0.0\n",
    )
    executions.push({ provider: row.provider, target: row.file.executable.target, stdout })
  }
  const evidence = {
    format: "ts-release/native-producer-executables/2",
    work,
    runtime: process.version,
    bun: process.versions.bun ?? null,
    checks,
    records,
    executions,
    producerDeleted: true,
    limits: [
      "Three native Linux x64 GNU executions only; macOS/Windows/arm64/musl clean-host execution remains separate.",
      "This local source consumer is not yet the required fresh packed consumer.",
    ],
  }
  await writeFile(join(work, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n")
  console.log(
    JSON.stringify({
      work,
      checks: checks.length,
      artifacts: records.length,
      executions: executions.length,
    }),
  )
} catch (error) {
  await writeFile(
    join(work, "failure.json"),
    JSON.stringify({ message: String(error), records }, null, 2) + "\n",
  )
  throw error
}
