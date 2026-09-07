import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, writeFile, lstat, realpath } from "node:fs/promises"
import { join, dirname, delimiter, resolve } from "node:path"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
const root = resolve(import.meta.dir, ".."),
  work = await mkdtemp(join(tmpdir(), "ts-release-packed-npm-"))
const includePyPi = process.argv.includes("--pypi")
const includeTransports = process.argv.includes("--transports")
const owners = includePyPi ? ["ts-release", "npm", "pypi"] : ["ts-release", "npm"]
const node = process.env.TS_RELEASE_ACCEPTANCE_NODE ?? "node"
const commands: unknown[] = []
async function run(cwd: string, argv: string[], environment: Record<string, string> = {}) {
  const child = Bun.spawn(argv, {
    cwd,
    env: {
      ...process.env,
      PATH: `${dirname(node)}${delimiter}${process.env.PATH}`,
      ...environment,
    },
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
for (const owner of owners) {
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
const certificate = join(work, "fixture-cert.pem"),
  key = join(work, "fixture-key.pem")
if (includeTransports)
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
        ...(includePyPi ? { "@mannyc1/ts-release-pypi": `file:${archives[2]!.archive}` } : {}),
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
  for (const owner of owners) {
    const name = owner === "ts-release" ? "ts-release" : `ts-release-${owner}`
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
  if (includePyPi) {
    await writeFile(
      join(cwd, "pypi-consumer.mjs"),
      await readFile(join(root, "test/reimplementation/warehouse/packed-consumer.mjs")),
    )
    const source = await readFile(join(cwd, "consumer.ts"), "utf8")
    await writeFile(
      join(cwd, "consumer.ts"),
      source +
        `import * as PyPi from "@mannyc1/ts-release-pypi";\nconst pythonProviders: readonly HttpProviderDefinition[] = PyPi.definitions(null as never);\nconst pythonIntent: PyPi.UploadIntent = null as never;\nvoid [pythonProviders, pythonIntent, PyPi.inspectDistribution, PyPi.author, PyPi.upload, PyPi.authorizeToken, PyPi.authorizeTrusted];\n`,
    )
  }
  if (includeTransports) {
    for (const name of [
      "git-native-consumer.mjs",
      "http-wire-consumer.mjs",
      "http-tls-consumer.mjs",
    ])
      await writeFile(
        join(cwd, name),
        await readFile(join(root, "test/reimplementation/transports", name)),
      )
    await writeFile(
      join(cwd, "consumer.ts"),
      (await readFile(join(cwd, "consumer.ts"), "utf8")) +
        `
import * as Git from "@mannyc1/ts-release/git";
import * as Node from "@mannyc1/ts-release/node";
import type { HttpRead, ResolveCredentials, CredentialExchange } from "@mannyc1/ts-release/http";
const gitHost: Git.NativeHost = null as never;
const gitOptions: Node.GitCatalogHostOptions = null as never;
const journalOptions: Node.GitJournalOptions = null as never;
const readHttp: HttpRead = Node.makeHttpRead(null as never);
const exchange: CredentialExchange = Node.makeCredentialExchange(null as never);
void [gitHost, gitOptions, journalOptions, readHttp, exchange, Git.prepare, Git.update, Git.makeCoreGitTransport, Node.makeGitCatalogHost, Node.openGitJournal, Node.makeGithubOidcTokenSource, Node.makeGithubTrustedPublisherHost];
`,
    )
  }
  await run(cwd, [process.execPath, "node_modules/typescript/bin/tsc", "-p", "tsconfig.json"])
  const runtimes = []
  for (const runtime of [node, process.execPath])
    for (const [artifact, name] of [
      [tarball, "@fixture/packed-npm"],
      ...archives.map(({ owner, archive }) => [
        archive,
        owner === "ts-release" ? "@mannyc1/ts-release" : `@mannyc1/ts-release-${owner}`,
      ]),
    ] as const)
      runtimes.push(JSON.parse(await run(cwd, [runtime, "consumer.mjs", artifact, name])))
  if (includePyPi)
    for (const runtime of [node, process.execPath])
      runtimes.push(
        JSON.parse(
          await run(cwd, [
            runtime,
            "pypi-consumer.mjs",
            join(root, "test/reimplementation/warehouse/fixtures"),
          ]),
        ),
      )
  if (includeTransports)
    for (const runtime of [node, process.execPath]) {
      runtimes.push(
        JSON.parse(
          await run(cwd, [runtime, "git-native-consumer.mjs", await realpath(Bun.which("git")!)]),
        ),
      )
      runtimes.push(JSON.parse(await run(cwd, [runtime, "http-wire-consumer.mjs"])))
      runtimes.push(
        JSON.parse(
          await run(cwd, [runtime, "http-tls-consumer.mjs", key, certificate], {
            NODE_EXTRA_CA_CERTS: certificate,
          }),
        ),
      )
    }
  outcomes.push({
    manager,
    strictDeclarations: true,
    exactArchiveFiles: true,
    optionalPeersAbsent: true,
    runtimes,
  })
}
const receipt = {
  format: includePyPi ? "ts-release/packed-providers/1" : "ts-release/packed-npm/1",
  checkedAt: new Date().toISOString(),
  work,
  archives,
  outcomes,
  commands,
  limits: [
    `${owners.length} of7 packages; local unpublished candidate archives`,
    includeTransports
      ? "Local native HTTP/TLS and Git host/journal consumers pass; hosted policies, native macOS/Windows, CLI/Action and full cohort remain open"
      : "native HTTP transport/CLI/Action and full cohort remain open",
    "Sigstore trust has a separate Node-native public-attestation witness; Bun native Sigstore remains unqualified",
    "no registry publication",
    "A preceding Bun1.3.14 run stalled in the shared cache and was terminated; the same consumer installed successfully with an isolated cache. This fresh run uses its own cache; shared-cache cause is not diagnosed.",
  ],
}
await writeFile(
  join(
    root,
    `docs/refactor/execution/${includeTransports ? "current-packed-transports" : includePyPi ? "current-packed-providers" : "current-packed-npm"}.json`,
  ),
  JSON.stringify(receipt, null, 2) + "\n",
)
console.log(JSON.stringify({ work, archives, outcomes }, null, 2))
