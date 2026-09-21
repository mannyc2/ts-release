import assert from "node:assert/strict"
import { cp, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { Effect } from "effect"
import { readCandidate } from "./prepare-release.js"

const [candidatePath, consumerPath] = process.argv.slice(2)
assert.ok(
  candidatePath && consumerPath,
  "Usage: bun scripts/install-release-runtime.ts <candidate> <new-consumer-directory>",
)
const candidate = await readCandidate(resolve(candidatePath))
const consumer = resolve(consumerPath)
await mkdir(consumer)
await mkdir(join(consumer, "archives"))
const workspace = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
const dependencies: Record<string, string> = {
  "@mannyc1/ts-release": "",
  effect: workspace.devDependencies.effect,
  "@effect/platform-node": workspace.devDependencies["@effect/platform-node"],
}
for (const entry of candidate.packages) {
  assert.ok(/^[A-Za-z0-9._-]+\.tgz$/u.test(entry.tarball.logicalName))
  const archive = join(consumer, "archives", entry.tarball.logicalName)
  await writeFile(archive, await Effect.runPromise(candidate.readContent(entry.tarball.content)), {
    flag: "wx",
  })
  dependencies[entry.name] = `file:${archive}`
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
assert.equal(await install.exited, 0, "Retained release runtime could not be installed")
for (const entry of candidate.packages)
  assert.equal((await lstat(join(consumer, "node_modules", entry.name))).isSymbolicLink(), false)
const application = new URL("../templates/npm-github/release/", import.meta.url)
for (const file of await readdir(application))
  if (file.endsWith(".js"))
    await cp(new URL(file, application), join(consumer, file), { errorOnExist: true, force: false })
for (const file of ["verify.mjs", "check-credentials.mjs"])
  await cp(new URL(`../templates/npm-github/${file}`, import.meta.url), join(consumer, file), {
    errorOnExist: true,
    force: false,
  })
console.log(
  JSON.stringify({
    consumer,
    application: join(consumer, "application.js"),
    packages: candidate.packages.length,
    planId: candidate.plan.planId,
  }),
)
