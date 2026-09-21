import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { readDistribution } from "./release.js"

const root = resolve(import.meta.dir, "..")
const directory = resolve(process.argv[2] ?? ".release/distribution")
const manifest = await readDistribution(directory)
const workspace = JSON.parse(await readFile(join(root, "package.json"), "utf8"))
const consumer = process.argv.includes("--hosted")
  ? join(root, ".release/distribution-consumer")
  : await mkdtemp(join(tmpdir(), "ts-release-distribution-consumer-"))
await mkdir(consumer, { recursive: true })
const run = async (argv: string[]) => {
  const child = Bun.spawn(argv, { cwd: consumer, stdout: "pipe", stderr: "pipe" })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert.equal(exit, 0, stdout + stderr)
  return stdout
}
await writeFile(
  join(consumer, "package.json"),
  JSON.stringify({
    private: true,
    type: "module",
    dependencies: {
      ...Object.fromEntries(
        manifest.packages.map((entry) => [entry.name, `file:${join(directory, entry.file)}`]),
      ),
      effect: workspace.devDependencies.effect,
    },
  }),
)
await run([process.execPath, "install", "--ignore-scripts"])
await writeFile(
  join(consumer, "imports.mjs"),
  manifest.packages.map((entry) => `await import(${JSON.stringify(entry.name)});`).join("\n"),
)
await run(["node", "imports.mjs"])
await run([process.execPath, "imports.mjs"])
assert.equal(
  (await run([process.execPath, "run", "ts-release", "--help"])).trim(),
  "Usage: ts-release [--observe] <application.mjs> <input.json>",
)
const git = Bun.which("git")
assert.ok(git)
const journal = join(consumer, "journal.git")
await run([git, "init", "--bare", "--initial-branch=main", journal])
await cp(
  join(root, "test/reimplementation/hosts/action-application.mjs"),
  join(consumer, "fixture.mjs"),
)
await writeFile(
  join(consumer, "input.json"),
  JSON.stringify({
    empty: true,
    authorize: false,
    gitExecutable: git,
    journalRemote: pathToFileURL(journal).href,
    cacheDirectory: join(consumer, "journal-cache"),
    sendLog: join(consumer, "must-not-send"),
  }),
)
await writeFile(
  join(consumer, "application.mjs"),
  `import { readFileSync } from "node:fs";
import { createApplication as fixture } from "./fixture.mjs";
export const createApplication = () => fixture(JSON.parse(readFileSync(new URL("./input.json", import.meta.url), "utf8")));
`,
)
const report = JSON.parse(
  await run([
    process.execPath,
    "run",
    "ts-release",
    "--observe",
    "./application.mjs",
    "./input.json",
  ]),
)
assert.deepEqual(report.operations, [])
assert.equal(await Bun.file(join(consumer, "must-not-send")).exists(), false)
console.log(
  JSON.stringify({
    version: manifest.version,
    packages: manifest.packages.length,
    consumer,
    status: "installed-and-observed",
  }),
)
