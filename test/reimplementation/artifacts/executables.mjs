import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Layer, Schema } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as BunCompiler from "effect-build-bun/Command"
import * as DenoCompiler from "effect-build-deno/Command"
import * as Esbuild from "effect-build-esbuild/Api"
import * as NodeSea from "effect-build-node-sea/Command"
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
const absolute = Schema.decodeUnknownSync(Artifact.AbsolutePath)
const owner = fileContentOwner(owned)
const source = `const runtime = globalThis as { Deno?: { args: string[] }; process?: { argv: string[] } }
const args = runtime.Deno?.args ?? runtime.process!.argv.slice(2)
if (args.length !== 1 || args[0] !== "--version") throw new Error("expected --version")
console.log("ts-release producer fixture 1.0.0")
`
const entrypoint = join(producer, "main.ts")
await writeFile(entrypoint, source)
const bunCells = [
  ["bun-darwin-x64", "macos-x64"],
  ["bun-darwin-arm64", "macos-aarch64"],
  ["bun-linux-x64", "linux-x64-gnu"],
  ["bun-linux-x64-musl", "linux-x64-musl"],
  ["bun-linux-arm64", "linux-aarch64-gnu"],
  ["bun-windows-x64", "windows-x64"],
]
const denoCells = [
  ["x86_64-apple-darwin", "macos-x64"],
  ["aarch64-apple-darwin", "macos-aarch64"],
  ["x86_64-unknown-linux-gnu", "linux-x64-gnu"],
  ["aarch64-unknown-linux-gnu", "linux-aarch64-gnu"],
  ["x86_64-pc-windows-msvc", "windows-x64"],
  ["aarch64-pc-windows-msvc", "windows-aarch64"],
]
const records = [],
  checks = []
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, label)
  checks.push(label)
}
const layers = Layer.mergeAll(
  BunCompiler.layer({ executable: absolute(bun) }),
  DenoCompiler.layer({
    executable: absolute(join(tools, "deno")),
    denoDir: absolute(join(work, "deno-cache")),
  }),
  NodeSea.layer({ builderExecutable: absolute(join(tools, "node")) }),
)
const application = Effect.gen(function* () {
  const bunReport = yield* BunCompiler.CompileExecutable.compileExecutableMatrix({
    concurrency: 1,
    inputs: bunCells.map(([target]) => ({
      entrypoints: [entrypoint],
      outfile: join(producer, `${target}${target.includes("windows") ? ".exe" : ""}`),
      target,
      observation: "hashed",
      options: {
        autoloadDotenv: false,
        autoloadBunfig: false,
        autoloadTsconfig: false,
        autoloadPackageJson: false,
      },
    })),
  })
  const denoReport = yield* DenoCompiler.CompileExecutable.compileExecutableMatrix({
    concurrency: 1,
    inputs: denoCells.map(([target]) => ({
      entrypoint,
      outfile: join(producer, `deno-${target}${target.includes("windows") ? ".exe" : ""}`),
      target,
      observation: "hashed",
      config: false,
      lock: false,
      noNpm: true,
      noRemote: true,
      check: false,
    })),
  })
  for (const [provider, report, cells, version] of [
    ["bun", bunReport, bunCells, "1.3.14"],
    ["deno", denoReport, denoCells, "2.9.5"],
  ]) {
    check(`${provider} exact matrix length`, report.cells.length, 6)
    for (const [index, cell] of report.cells.entries()) {
      if (cell._tag !== "Success")
        throw new Error(`${provider}/${index} native build failed: ${JSON.stringify(cell.error)}`)
      const native = cell.artifact
      check(`${provider}/${index} matrix identity`, cell.identity, {
        provider,
        operation: "compileExecutable",
        index,
      })
      check(`${provider}/${index} exact target`, native.target, cells[index][1])
      check(`${provider}/${index} exact runtime`, native.runtime, { name: provider, version })
      const file = yield* adoptFile(
        owner,
        `${provider}-${native.target}${native.nativeFormat === "pe" ? ".exe" : ""}`,
        native,
      )
      check(`${provider}/${index} exact owned size`, file.content.bytes, native.bytes)
      check(`${provider}/${index} exact owned digest`, file.content.sha256, native.digest.value)
      check(`${provider}/${index} executable mode`, file.deliveryMode, 0o755)
      check(`${provider}/${index} native metadata`, file.executable, {
        nativeFormat: native.nativeFormat,
        runtime: native.runtime,
        target: native.target,
      })
      records.push({ provider, native, file })
    }
  }
  const built = yield* Esbuild.Build.build({
    stdin: { contents: source, loader: "ts" },
    write: false,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node26",
  })
  check("esbuild exact single in-memory output", built.outputFiles.length, 1)
  const native = yield* NodeSea.AssembleExecutable.assembleDirect({
    main: { _tag: "Bytes", contents: built.outputFiles[0].contents, format: "commonjs" },
    outfile: join(producer, "node-sea"),
    observation: "hashed",
    disableExperimentalSEAWarning: true,
  })
  check("SEA exact runtime", native.runtime, { name: "node", version: "26.7.0" })
  check("SEA exact native cell", [native.nativeFormat, native.target], ["elf", "linux-x64-gnu"])
  const file = yield* adoptFile(owner, "node-linux-x64-gnu", native)
  records.push({
    provider: "node-sea",
    native,
    file,
    esbuild: {
      version: "0.28.2",
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
    if (row.file.executable.target !== "linux-x64-gnu") continue
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
    format: "ts-release/native-producer-executables/1",
    work,
    runtime: process.version,
    bun: process.versions.bun ?? null,
    checks,
    records,
    executions,
    producerDeleted: true,
    limits: [
      "Three native Linux x64 GNU executions only; macOS/Windows/arm64/musl clean-host execution remains separate.",
      "Cross-target runtime acquisition evidence gates in producer artifacts are retained, not silently treated as closed.",
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
