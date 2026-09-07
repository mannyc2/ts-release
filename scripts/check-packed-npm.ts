import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, writeFile, lstat } from "node:fs/promises"
import { join, dirname, delimiter, resolve } from "node:path"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
const root = resolve(import.meta.dir, ".."),
  work = await mkdtemp(join(tmpdir(), "ts-release-packed-npm-"))
const node = process.env.TS_RELEASE_ACCEPTANCE_NODE ?? "node"
const commands: unknown[] = []
async function run(cwd: string, argv: string[]) {
  const child = Bun.spawn(argv, {
    cwd,
    env: { ...process.env, PATH: `${dirname(node)}${delimiter}${process.env.PATH}` },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, out, err] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  commands.push({ cwd, argv, exitCode, output: (out + err).slice(-8000) })
  assert.equal(exitCode, 0, out + err)
  return out
}
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
await run(root, [process.execPath, "run", "build"])
const archives = []
for (const owner of ["ts-release", "npm"]) {
  const archive = join(work, `${owner}.tgz`)
  await run(join(root, "packages", owner), [
    process.execPath,
    "pm",
    "pack",
    "--ignore-scripts",
    "--filename",
    archive,
  ])
  archives.push({ owner, archive, sha256: hash(await readFile(archive)) })
}
const producer = join(work, "producer")
await mkdir(producer)
await writeFile(
  join(producer, "package.json"),
  JSON.stringify({
    name: "@fixture/packed-npm",
    version: "1.2.3",
    type: "module",
    files: ["index.js"],
  }),
)
await writeFile(join(producer, "index.js"), "export const fixture = true\n")
const tarball = join(work, "native-fixture.tgz")
await run(producer, [process.execPath, "pm", "pack", "--ignore-scripts", "--filename", tarball])
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
        "@mannyc1/ts-release": `file:${archives[0]!.archive}`,
        "@mannyc1/ts-release-npm": `file:${archives[1]!.archive}`,
        effect: "4.0.0-beta.107",
        typescript: "6.0.3",
      },
    }),
  )
  await run(
    cwd,
    manager === "bun"
      ? [process.execPath, "install", "--ignore-scripts", "--cache-dir", join(work, "bun-cache")]
      : ["npm", "install", "--ignore-scripts", "--omit=optional"],
  )
  for (const owner of ["ts-release", "npm"]) {
    const name = owner === "npm" ? "ts-release-npm" : "ts-release"
    const installed = join(cwd, "node_modules/@mannyc1", name)
    assert.equal((await lstat(installed)).isSymbolicLink(), false)
    for await (const path of new Bun.Glob("**/*").scan({
      cwd: join(root, "packages", owner, "dist"),
      onlyFiles: true,
    }))
      assert.deepEqual(
        await readFile(join(installed, "dist", path)),
        await readFile(join(root, "packages", owner, "dist", path)),
      )
  }
  for (const absent of ["@effect/platform-node", "@effect/platform-bun", "effect-build-apple"])
    assert.equal(
      await Bun.file(join(cwd, "node_modules", absent, "package.json")).exists(),
      false,
      absent,
    )
  await writeFile(
    join(cwd, "consumer.mjs"),
    await readFile(join(root, "test/reimplementation/npm/packed-consumer.mjs")),
  )
  await writeFile(
    join(cwd, "consumer.ts"),
    `import * as Npm from "@mannyc1/ts-release-npm";\nimport type { HttpProviderDefinition } from "@mannyc1/ts-release/http";\nconst inspect = Npm.inspectTarball;\nconst metadata: Npm.PackageMetadata = null as never;\nconst verification: Npm.VerifyProvenance = Npm.makeSigstoreVerifier({ tufRootPath: "root", tufCachePath: "cache", timeoutMilliseconds: 1000 });\nconst providers: readonly HttpProviderDefinition[] = Npm.definitions(null as never);\nvoid [inspect, metadata, verification, providers, Npm.publish, Npm.distTag, Npm.author, Npm.authorizeToken, Npm.authorizeTrusted, Npm.makeSigstoreAttester, Npm.createProvenance];\n`,
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
  const runtimes = []
  for (const runtime of [node, process.execPath])
    for (const [artifact, name] of [
      [tarball, "@fixture/packed-npm"],
      [archives[0]!.archive, "@mannyc1/ts-release"],
      [archives[1]!.archive, "@mannyc1/ts-release-npm"],
    ] as const)
      runtimes.push(JSON.parse(await run(cwd, [runtime, "consumer.mjs", artifact, name])))
  outcomes.push({
    manager,
    strictDeclarations: true,
    exactArchiveFiles: true,
    optionalPeersAbsent: true,
    runtimes,
  })
}
const receipt = {
  format: "ts-release/packed-npm/1",
  checkedAt: new Date().toISOString(),
  work,
  archives,
  outcomes,
  commands,
  limits: [
    "2 of7 packages; local unpublished candidate archives",
    "native HTTP transport/CLI/Action and full cohort remain open",
    "Sigstore trust has a separate Node-native public-attestation witness; Bun native Sigstore remains unqualified",
    "no registry publication",
    "A preceding Bun1.3.14 run stalled in the shared cache and was terminated; the same consumer installed successfully with an isolated cache. This fresh run uses its own cache; shared-cache cause is not diagnosed.",
  ],
}
await writeFile(
  join(root, "docs/refactor/execution/W02-packed-npm.json"),
  JSON.stringify(receipt, null, 2) + "\n",
)
console.log(JSON.stringify({ work, archives, outcomes }, null, 2))
