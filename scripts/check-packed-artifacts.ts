import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cp, lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { delimiter, dirname, join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const work = await mkdtemp("/tmp/ts-release-packed-artifacts-")
const node = process.env.TS_RELEASE_ACCEPTANCE_NODE ?? process.env.TS_RELEASE_HTTP_PEER_NODE
assert(node?.startsWith("/"), "Choose an absolute supported native Node executable")
assert(process.env.TS_RELEASE_ALPINE_DEPENDENCIES, "Choose retained Alpine dependency archives")
const nodeExecutable = node as string
// Keep native declaration fixtures on the same Node types as the frozen workspace;
// bun-types accepts any @types/node version and an older transitive copy conflicts.
const nodeTypesVersion = (
  await Bun.file(join(root, "node_modules/@types/node/package.json")).json()
).version
const commands: unknown[] = [],
  outcomes: unknown[] = []
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const run = async (cwd: string, argv: string[], env: Record<string, string> = {}) => {
  const child = Bun.spawn(argv, {
    cwd,
    env: {
      ...process.env,
      PATH: `${dirname(nodeExecutable)}${delimiter}${process.env.PATH}`,
      TS_RELEASE_HTTP_PEER_NODE: nodeExecutable,
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  commands.push({ cwd, argv, exitCode, output: (stdout + stderr).slice(-12_000) })
  await writeFile(join(work, "commands.json"), JSON.stringify(commands, null, 2) + "\n")
  assert.equal(exitCode, 0, stdout + stderr)
  return stdout
}
if (!process.argv.includes("--skip-build")) await run(root, [process.execPath, "run", "build"])
const archive = join(work, "kernel.tgz")
await run(join(root, "packages/ts-release"), [
  process.execPath,
  "pm",
  "pack",
  "--ignore-scripts",
  "--filename",
  archive,
])
const kernelSha256 = hash(await readFile(archive))
const sourceBindings = []
for await (const path of new Bun.Glob("**/*").scan({
  cwd: join(root, "packages/ts-release/src"),
  onlyFiles: true,
}))
  sourceBindings.push({
    path,
    sha256: hash(await readFile(join(root, "packages/ts-release/src", path))),
  })
sourceBindings.sort((a, b) => a.path.localeCompare(b.path))
const upstreamRoot = join(root, "test/fixtures/producer-upstream")
const upstream = JSON.parse(await readFile(join(upstreamRoot, "registry.json"), "utf8")) as {
  packages: { name: string; version: string; sha256: string; retainedTarball: string }[]
}
const upstreamDependencies: Record<string, string> = {}
for (const row of upstream.packages) {
  const archive = join(upstreamRoot, row.retainedTarball)
  assert.equal(hash(await readFile(archive)), row.sha256)
  upstreamDependencies[row.name] = `file:${archive}`
}
for (const manager of ["bun", "npm"]) {
  const cwd = join(work, manager)
  await mkdir(cwd)
  const manifest = {
    private: true,
    type: "module",
    dependencies: {
      "@mannyc1/ts-release": `file:${archive}`,
      effect: "4.0.0-rc.108",
      typescript: "6.0.3",
      "@types/node": nodeTypesVersion,
    },
    overrides: { "@effect/platform-node-shared": "4.0.0-rc.108" },
  }
  await writeFile(join(cwd, "package.json"), JSON.stringify(manifest))
  const install = () =>
    run(
      cwd,
      manager === "bun"
        ? [
            process.execPath,
            "install",
            "--ignore-scripts",
            "--cache-dir",
            join(work, manager + "-cache"),
          ]
        : ["npm", "install", "--ignore-scripts"],
    )
  await install()
  for (const absent of ["@effect/platform-node", "@effect/platform-bun", "effect-build-apple"])
    assert.equal(
      await Bun.file(join(cwd, "node_modules", absent, "package.json")).exists(),
      false,
      absent,
    )
  const portable = `await Promise.all(["@mannyc1/ts-release", "@mannyc1/ts-release/bundle", "@mannyc1/ts-release/effect-build"].map((name) => import(name))); console.log("portable-without-optional-peers")`
  await writeFile(join(cwd, "portable.mjs"), portable)
  for (const runtime of [nodeExecutable, process.execPath])
    assert.equal(
      (await run(cwd, [runtime, "portable.mjs"])).trim(),
      "portable-without-optional-peers",
    )
  Object.assign(manifest.dependencies, upstreamDependencies, {
    "@effect/platform-node": "4.0.0-rc.108",
    "@effect/platform-bun": "4.0.0-rc.108",
  })
  await writeFile(join(cwd, "package.json"), JSON.stringify(manifest))
  await install()
  for (const name of ["@mannyc1/ts-release", ...upstream.packages.map((row) => row.name)])
    assert.equal((await lstat(join(cwd, "node_modules", name))).isSymbolicLink(), false, name)
  for await (const path of new Bun.Glob("**/*").scan({
    cwd: join(root, "packages/ts-release/dist"),
    onlyFiles: true,
  }))
    assert.deepEqual(
      await readFile(join(cwd, "node_modules/@mannyc1/ts-release/dist", path)),
      await readFile(join(root, "packages/ts-release/dist", path)),
    )
  const fixture = join(root, "test/reimplementation/artifacts")
  for (const name of ["executables", "archives", "python", "packages", "sbom"])
    await cp(join(fixture, name + ".mjs"), join(cwd, name + ".mjs"))
  await cp(join(fixture, "fixtures"), join(cwd, "fixtures"), { recursive: true })
  await cp(join(fixture, "public-contract.ts"), join(cwd, "public-contract.ts"))
  await writeFile(
    join(cwd, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "ESNext.Disposable"],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: false,
        outDir: "types-consumer",
        types: [],
      },
      files: ["public-contract.ts"],
    }),
  )
  await run(cwd, [process.execPath, "node_modules/typescript/bin/tsc", "-p", "tsconfig.json"])
  for (const runtime of [nodeExecutable, process.execPath]) {
    await run(cwd, [runtime, "types-consumer/public-contract.js"])
    const executableOutput = await run(cwd, [runtime, "executables.mjs"], {
      TS_RELEASE_PRODUCER_BUN: process.execPath,
    })
    const executable = JSON.parse(executableOutput.trim().split("\n").at(-1)!) as { work: string }
    const evidence: Record<string, unknown> = { executables: executable }
    for (const name of ["archives", "python", "packages", "sbom"])
      evidence[name] = JSON.parse(
        (
          await run(cwd, [runtime, name + ".mjs"], {
            TS_RELEASE_EXECUTABLE_WITNESS: executable.work,
          })
        )
          .trim()
          .split("\n")
          .at(-1)!,
      )
    outcomes.push({ manager, runtime, evidence })
    await writeFile(join(work, "outcomes.json"), JSON.stringify(outcomes, null, 2) + "\n")
  }
}
assert.equal(hash(await readFile(archive)), kernelSha256)
for (const row of sourceBindings)
  assert.equal(hash(await readFile(join(root, "packages/ts-release/src", row.path))), row.sha256)
await writeFile(
  join(work, "evidence.json"),
  JSON.stringify(
    {
      format: "ts-release/packed-artifact-consumers/1",
      work,
      archive,
      kernelSha256,
      sourceBindings,
      upstream: upstream.packages,
      outcomes,
      commands,
      limits: [
        "Native Linux consumers; cross-target execution and credentialed Apple/Windows acceptance remain open.",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify({ work, kernelSha256, cells: outcomes.length, commands: commands.length }),
)
