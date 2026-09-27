import workspace from "../package.json" with { type: "json" }
import assert from "node:assert/strict"
import { cp, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { join, resolve } from "node:path"
import { Effect, Schema } from "effect"
import { owners, packageName, readCandidate } from "./prepare-release.js"
import { PackageExports } from "./ReleaseMetadata.js"

const [candidatePath, consumerPath, executorOption, unexpected] = process.argv.slice(2)
assert.ok(
  candidatePath && consumerPath,
  "Usage: bun scripts/install-release-runtime.ts <candidate> <new-consumer-directory> [--executor=checkout]",
)
assert.ok(
  unexpected === undefined &&
    (executorOption === undefined || executorOption === "--executor=checkout"),
  "Unknown executor selection",
)
const checkoutExecutor = executorOption === "--executor=checkout"
const root = resolve(import.meta.dir, "..")
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const execute = async (argv: string[], cwd: string) => {
  const child = Bun.spawn(argv, { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert.equal(code, 0, `${argv[0]} ${argv[1]} failed\n${stdout}\n${stderr}`)
  return stdout.trim()
}
const candidate = await readCandidate(resolve(candidatePath))
const consumer = resolve(consumerPath)
await mkdir(consumer)
await mkdir(join(consumer, "archives"))
const dependencies: Record<string, string> = {
  "@mannyc1/ts-release": "",
  effect: workspace.devDependencies.effect,
  "@effect/platform-node": workspace.devDependencies["@effect/platform-node"],
}
const archives: Array<{ name: string; version: string; file: string; sha256: string }> = []
for (const entry of candidate.packages) {
  assert.ok(/^[A-Za-z0-9._-]+\.tgz$/u.test(entry.tarball.logicalName))
  let archive = join(consumer, "archives", entry.tarball.logicalName)
  let version = entry.version
  if (checkoutExecutor) {
    const selected = owners.find((owner) => packageName(owner) === entry.name)
    assert.ok(selected, "Executor package has no repository owner")
    const directory = join(root, "packages", selected)
    const manifest = Schema.decodeSync(Schema.fromJsonString(PackageExports))(
      await readFile(join(directory, "package.json"), "utf8"),
    )
    assert.equal(manifest.name, entry.name)
    assert.equal(manifest.version, workspace.version, "Executor packages must remain aligned")
    version = manifest.version
    archive = join(consumer, "archives", `${selected}-${version}.tgz`)
    // The caller builds this reviewed checkout first. Packing selects executor
    // code only; retained publication artifacts are never regenerated or replaced.
    await execute(
      [process.execPath, "pm", "pack", "--ignore-scripts", "--filename", archive],
      directory,
    )
  } else {
    await writeFile(
      archive,
      await Effect.runPromise(candidate.readContent(entry.tarball.content)),
      {
        flag: "wx",
      },
    )
  }
  dependencies[entry.name] = `file:${archive}`
  archives.push({ name: entry.name, version, file: archive, sha256: hash(await readFile(archive)) })
}
await writeFile(
  join(consumer, "package.json"),
  JSON.stringify({
    private: true,
    type: "module",
    dependencies,
    overrides: {
      "@effect/platform-node-shared": workspace.devDependencies["@effect/platform-node"],
    },
  }),
)
const install = Bun.spawn(
  [process.execPath, "install", "--ignore-scripts", "--cache-dir", join(consumer, ".bun-cache")],
  { cwd: consumer, stdout: "inherit", stderr: "inherit", timeout: 120000 },
)
assert.equal(await install.exited, 0, "Selected release executor could not be installed")
for (const entry of candidate.packages)
  assert.equal((await lstat(join(consumer, "node_modules", entry.name))).isSymbolicLink(), false)
const applicationFiles: Array<{ file: string; sha256: string }> = []
const application = new URL("../templates/npm-github/release/", import.meta.url)
for (const file of await readdir(application))
  if (file.endsWith(".js")) {
    await cp(new URL(file, application), join(consumer, file), { errorOnExist: true, force: false })
    applicationFiles.push({ file, sha256: hash(await readFile(join(consumer, file))) })
  }
for (const file of ["verify.mjs", "check-credentials.mjs"]) {
  await cp(new URL(`../templates/npm-github/${file}`, import.meta.url), join(consumer, file), {
    errorOnExist: true,
    force: false,
  })
  applicationFiles.push({ file, sha256: hash(await readFile(join(consumer, file))) })
}
// This is an executor receipt, not publication authority or a replacement Plan.
const executor = {
  selection: checkoutExecutor ? "checkout" : "retained",
  candidate: { ...candidate.identity, source: candidate.source },
  applicationSource: {
    commit: await execute(["git", "rev-parse", "HEAD"], root),
    tree: await execute(["git", "rev-parse", "HEAD^{tree}"], root),
    dirty: (await execute(["git", "status", "--porcelain"], root)) !== "",
  },
  archives,
  applicationFiles,
}
await writeFile(join(consumer, "executor.json"), JSON.stringify(executor, null, 2) + "\n", {
  flag: "wx",
})
console.log(
  JSON.stringify({
    consumer,
    application: join(consumer, "application.js"),
    packages: candidate.packages.length,
    executor: join(consumer, "executor.json"),
    planId: candidate.plan.planId,
  }),
)
