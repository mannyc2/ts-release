import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, writeFile, lstat } from "node:fs/promises"
import { join, resolve, dirname, delimiter } from "node:path"
import { tmpdir } from "node:os"

const root = resolve(import.meta.dir, "..")
const work = await mkdtemp(join(tmpdir(), "ts-release-packed-external-"))
const node =
  process.env.TS_RELEASE_ACCEPTANCE_NODE ?? process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node"
const commands: unknown[] = []
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
async function run(cwd: string, argv: string[], env: Record<string, string> = {}) {
  const child = Bun.spawn(argv, {
    cwd,
    env: { ...process.env, PATH: `${dirname(node)}${delimiter}${process.env.PATH}`, ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  commands.push({ cwd, argv, exitCode, output: (stdout + stderr).slice(-8000) })
  await writeFile(join(work, "commands.json"), JSON.stringify(commands, null, 2) + "\n")
  assert.equal(exitCode, 0, stdout + stderr)
  return stdout
}
async function sourceSnapshot() {
  const rows = []
  for (const pattern of [
    "packages/*/src/**/*",
    "packages/*/package.json",
    "apps/action/src/**/*",
    "apps/self-release/src/**/*",
  ])
    for await (const path of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true }))
      rows.push({ path, sha256: hash(await readFile(join(root, path))) })
  return rows.sort((a, b) => a.path.localeCompare(b.path))
}
await run(root, [process.execPath, "run", "build"])
const core = join(work, "kernel.tgz")
await run(join(root, "packages/ts-release"), [
  process.execPath,
  "pm",
  "pack",
  "--ignore-scripts",
  "--filename",
  core,
])
const frozenAt = new Date().toISOString()
const frozen = await sourceSnapshot()
const coreHash = hash(await readFile(core))
const producer = join(work, "provider")
await mkdir(join(producer, "src"), { recursive: true })
for await (const name of new Bun.Glob("*.ts").scan({
  cwd: join(root, "test/reimplementation/external/provider"),
}))
  await writeFile(
    join(producer, "src", name),
    await readFile(join(root, "test/reimplementation/external/provider", name)),
  )
await writeFile(
  join(producer, "package.json"),
  JSON.stringify(
    {
      name: "@fixture/external-provider",
      version: "1.0.0",
      type: "module",
      files: ["dist"],
      exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
      peerDependencies: {
        "@mannyc1/ts-release": "0.4.0",
        effect: ">=4.0.0-beta.107 <4.0.0-beta.108",
      },
      devDependencies: {
        "@mannyc1/ts-release": `file:${core}`,
        effect: "4.0.0-beta.107",
        typescript: "6.0.3",
      },
    },
    null,
    2,
  ),
)
await writeFile(
  join(producer, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "ESNext.Disposable"],
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: false,
      declaration: true,
      outDir: "dist",
      rootDir: "src",
      types: [],
    },
    include: ["src/**/*.ts"],
  }),
)
await run(producer, [
  process.execPath,
  "install",
  "--ignore-scripts",
  "--cache-dir",
  join(work, "producer-cache"),
])
await run(producer, [process.execPath, "node_modules/typescript/bin/tsc", "-p", "tsconfig.json"])
const providerArchive = join(work, "provider.tgz")
await run(producer, [
  process.execPath,
  "pm",
  "pack",
  "--ignore-scripts",
  "--filename",
  providerArchive,
])
const providerBuiltAt = new Date().toISOString()
const providerHash = hash(await readFile(providerArchive))
const certificate = join(work, "certificate.pem"),
  key = join(work, "key.pem")
await run(work, [
  "openssl",
  "req",
  "-x509",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  key,
  "-out",
  certificate,
  "-days",
  "1",
  "-subj",
  "/CN=127.0.0.1",
  "-addext",
  "subjectAltName=IP:127.0.0.1",
])
const outcomes = []
for (const manager of ["bun", "npm"]) {
  const cwd = join(work, manager)
  await mkdir(cwd)
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@mannyc1/ts-release": `file:${core}`,
        "@fixture/external-provider": `file:${providerArchive}`,
        effect: "4.0.0-beta.107",
        typescript: "6.0.3",
      },
    }),
  )
  await run(
    cwd,
    manager === "bun"
      ? [
          process.execPath,
          "install",
          "--ignore-scripts",
          "--cache-dir",
          join(work, "consumer-cache"),
        ]
      : ["npm", "install", "--ignore-scripts", "--omit=optional"],
  )
  for (const name of ["@mannyc1/ts-release", "@fixture/external-provider"]) {
    assert.equal((await lstat(join(cwd, "node_modules", name))).isSymbolicLink(), false)
    const original =
      name === "@mannyc1/ts-release"
        ? join(root, "packages/ts-release/dist")
        : join(producer, "dist")
    for await (const path of new Bun.Glob("**/*").scan({ cwd: original, onlyFiles: true }))
      assert.deepEqual(
        await readFile(join(cwd, "node_modules", name, "dist", path)),
        await readFile(join(original, path)),
      )
  }
  for (const name of [
    "@effect/platform-node",
    "@effect/platform-bun",
    "effect-build-apple",
    "@mannyc1/ts-release-npm",
    "@mannyc1/ts-release-pypi",
    "@mannyc1/ts-release-github",
    "@mannyc1/ts-release-catalog",
  ])
    assert.equal(
      await Bun.file(join(cwd, "node_modules", name, "package.json")).exists(),
      false,
      name,
    )
  for (const file of ["application.mjs", "consumer.mjs", "consumer.ts"])
    await writeFile(
      join(cwd, file),
      await readFile(
        join(
          root,
          "test/reimplementation/external",
          file === "consumer.ts" ? "consumer.ts.txt" : file,
        ),
      ),
    )
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
        noEmit: true,
        types: [],
      },
      files: ["consumer.ts"],
    }),
  )
  await run(cwd, [process.execPath, "node_modules/typescript/bin/tsc", "-p", "tsconfig.json"])
  // Exercise the package-manager-installed bin, not an equivalent local launcher.
  assert.equal(
    await run(cwd, [join(cwd, "node_modules/.bin/ts-release"), "--help"]),
    "Usage: ts-release <application.mjs> <input.json>\n",
  )
  for (const runtime of [node, process.execPath]) {
    const output = await run(cwd, [runtime, "consumer.mjs", certificate, key], {
      NODE_EXTRA_CA_CERTS: certificate,
    })
    outcomes.push({ manager, runtime, result: JSON.parse(output) })
  }
}
assert.deepEqual(
  await sourceSnapshot(),
  frozen,
  "External composition changed core/host/CLI/first-party provider source",
)
assert.equal(hash(await readFile(core)), coreHash)
assert.equal(hash(await readFile(providerArchive)), providerHash)
const record = {
  format: "ts-release/packed-external/1",
  work,
  frozenAt,
  providerBuiltAt,
  core: { sha256: coreHash },
  provider: { sha256: hash(await readFile(providerArchive)) },
  frozenSources: frozen,
  sourceEdits: 0,
  outcomes,
  commands,
}
await writeFile(
  join(root, "docs/refactor/execution/current-packed-external.json"),
  JSON.stringify(record, null, 2) + "\n",
)
console.log(
  JSON.stringify({
    work,
    consumers: outcomes.length,
    sourceEdits: 0,
    outcomes: outcomes.map(({ manager, result }) => ({ manager, ...result })),
  }),
)
