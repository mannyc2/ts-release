import { Schema } from "effect"
import { PackageExports } from "./ReleaseMetadata.js"
import manifest from "../packages/ts-release/package.json" with { type: "json" }
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, lstat, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, dirname, join, resolve } from "node:path"

// Installed import and declaration smoke tests without optional runtime peers.
await Bun.$`mkdir -p ${import.meta.dir + "/../.release/checks"}`

const root = resolve(import.meta.dir, "..")
const work = await mkdtemp(join(tmpdir(), "ts-release-packed-kernel-"))
const node = process.env.TS_RELEASE_ACCEPTANCE_NODE ?? "node"
const nodePath = node.includes("/")
  ? `${dirname(node)}${delimiter}${process.env.PATH}`
  : process.env.PATH
const commands: Array<{ cwd: string; argv: string[]; exitCode: number; output: string }> = []
async function command(cwd: string, argv: string[], expectFailure = false) {
  const child = Bun.spawn(argv, {
    cwd,
    env: { ...process.env, PATH: nodePath },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [output, errors, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const combined = output + errors
  commands.push({ cwd, argv, exitCode, output: combined.slice(-8000) })
  assert.equal(exitCode === 0, !expectFailure, combined)
  return combined
}
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
await command(root, [process.execPath, "run", "build"])
await command(join(root, "packages/ts-release"), [
  process.execPath,
  "pm",
  "pack",
  "--ignore-scripts",
  "--filename",
  join(work, "kernel.tgz"),
])
const archive = join(work, "kernel.tgz")
const consumers = []
for (const manager of ["bun", "npm"] as const) {
  const cwd = join(work, manager)
  await mkdir(cwd)
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify(
      {
        name: `kernel-${manager}-acceptance`,
        private: true,
        type: "module",
        dependencies: { "@mannyc1/ts-release": `file:${archive}`, effect: "4.0.0-rc.115" },
        devDependencies: { typescript: "7.0.2", "@effect/tsgo": "0.45.0" },
      },
      null,
      2,
    ),
  )
  await command(
    cwd,
    manager === "bun"
      ? [process.execPath, "install", "--ignore-scripts"]
      : ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"],
  )
  await command(cwd, [
    process.execPath,
    "node_modules/@effect/tsgo/dist/effect-tsgo.cjs",
    "patch",
    "--typescript",
  ])
  const compiler = (
    await command(cwd, [process.execPath, "node_modules/typescript/bin/tsc", "--version"])
  ).trim()
  assert.equal(compiler, "Version 7.0.2+effect-tsgo.0.45.0")
  const installed = join(cwd, "node_modules/@mannyc1/ts-release")
  assert.equal((await lstat(installed)).isSymbolicLink(), false)
  for (const optional of ["@effect/platform-node", "@effect/platform-bun", "effect-build-apple"])
    assert.equal(
      await Bun.file(join(cwd, "node_modules", optional, "package.json")).exists(),
      false,
      optional,
    )
  const effect = Schema.decodeSync(
    Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
  )(await Bun.file(join(cwd, "node_modules/effect/package.json")).text())
  assert.equal(effect.version, "4.0.0-rc.115")
  const packed = Schema.decodeSync(Schema.fromJsonString(PackageExports))(
    await Bun.file(join(installed, "package.json")).text(),
  )
  assert.deepEqual(packed.exports, manifest.exports)
  const bytes: Record<string, string> = {}
  for await (const path of new Bun.Glob("**/*").scan({
    cwd: join(root, "packages/ts-release/dist"),
    onlyFiles: true,
  })) {
    const original = await readFile(join(root, "packages/ts-release/dist", path))
    const actual = await readFile(join(installed, "dist", path))
    assert.deepEqual(actual, original, path)
    bytes[path] = hash(actual)
  }
  const declarations = {
    ".": 'import { Plan, createOperation } from "@mannyc1/ts-release"; export { Plan, createOperation };',
    "./http":
      'import { HttpReceipt, corresponds } from "@mannyc1/ts-release/http"; export { HttpReceipt, corresponds };',
    "./bun":
      'import { openSqliteJournal, runApplication, runApplicationEffect, FinalizedReport, type Application, type CreateApplication } from "@mannyc1/ts-release/bun"; export { openSqliteJournal, runApplication, runApplicationEffect, FinalizedReport }; export type { Application, CreateApplication };',
    "./bundle":
      'import { Bundle, finalize, loadBundle } from "@mannyc1/ts-release/bundle"; export { Bundle, finalize, loadBundle };',
    "./node":
      'import { fileContentOwner, runApplication, runApplicationEffect, FinalizedReport, type Application, type CreateApplication } from "@mannyc1/ts-release/node"; export { fileContentOwner, runApplication, runApplicationEffect, FinalizedReport }; export type { Application, CreateApplication };',
  }
  for (const [entry, source] of Object.entries(declarations)) {
    // The adapter must preserve an external factory's error/service inference while consuming Scope.
    // Compile this at the installed public boundary; runtime booleans cannot prove those equalities.
    const inference =
      entry === "./node" || entry === "./bun"
        ? `
import type * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import type { ReleaseError } from "@mannyc1/ts-release";
import type { AdoptionError } from "@mannyc1/ts-release/bundle";
interface FactoryError { readonly _tag: "FactoryError" }
interface FactoryService { readonly _tag: "FactoryService" }
declare const factory: (input: unknown) => Effect.Effect<Application, FactoryError, FactoryService | Scope.Scope>;
const composed = runApplicationEffect(factory, null);
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type FactoryErrorPreserved = Assert<Equal<Effect.Error<typeof composed>, FactoryError | ReleaseError | AdoptionError>>;
export type FactoryServicePreserved = Assert<Equal<Effect.Services<typeof composed>, FactoryService>>;
`
        : ""
    await writeFile(join(cwd, "consumer.ts"), source + inference)
    await writeFile(
      join(cwd, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          types: [],
          lib: ["ES2022", "DOM", "ESNext.Disposable"],
        },
        files: ["consumer.ts"],
      }),
    )
    await command(cwd, [process.execPath, "node_modules/typescript/bin/tsc", "-p", "tsconfig.json"])
  }
  for (const fixture of ["portable.mjs", "bun.mjs", "application.mjs"])
    await writeFile(
      join(cwd, fixture),
      await readFile(join(root, "test/reimplementation/packed-kernel", fixture)),
    )
  const nodeVersion = (await command(cwd, [node, "--version"])).trim()
  await command(cwd, [node, "portable.mjs"])
  await command(cwd, [process.execPath, "portable.mjs"])
  await command(cwd, [process.execPath, "bun.mjs"])
  consumers.push({
    manager,
    cwd,
    nodeVersion,
    compiler,
    effect: effect.version,
    optionalPeersAbsent: true,
    entries: Object.keys(declarations),
    installedFiles: bytes,
  })
}
const evidence = {
  format: "ts-release/packed-kernel/1",
  observedAt: new Date().toISOString(),
  work,
  scope:
    "Installed import and declaration smoke tests. Provider and entrypoint acceptance run separately.",
  version: manifest.version,
  archive,
  archiveSha256: hash(await readFile(archive)),
  consumers,
  commands,
}
await writeFile(
  join(root, ".release/checks/packed-kernel.json"),
  JSON.stringify(evidence, null, 2) + "\n",
)
console.log(
  JSON.stringify({
    work,
    archiveSha256: evidence.archiveSha256,
    managers: consumers.map((c) => c.manager),
    entries: Object.keys(manifest.exports),
  }),
)
