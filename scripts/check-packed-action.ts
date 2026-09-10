import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cp, lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

await Bun.$`mkdir -p ${import.meta.dir + "/../.release/checks"}`

const root = resolve(import.meta.dir, "..")
const work = await mkdtemp(join(tmpdir(), "ts-release-packed-action-"))
const node =
  process.env.TS_RELEASE_ACCEPTANCE_NODE ??
  process.env.TS_RELEASE_HTTP_PEER_NODE ??
  Bun.which("node")!
const git = Bun.which("git")
assert.ok(git, "native Git is required")
const path = `${dirname(node)}${delimiter}${process.env.PATH}`
const commands: Array<{ readonly argv: string[]; readonly cwd: string; readonly exit: number }> = []
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const command = async (
  cwd: string,
  argv: string[],
  options: { readonly env?: Record<string, string>; readonly exit?: number } = {},
) => {
  const child = Bun.spawn(argv, {
    cwd,
    env: { ...process.env, PATH: path, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  commands.push({ argv, cwd, exit })
  assert.equal(exit, options.exit ?? 0, stdout + stderr)
  return { stdout, stderr }
}

await command(root, [process.execPath, "run", "build:delivery"])
const archive = join(work, "ts-release.tgz")
await command(join(root, "packages/ts-release"), [
  process.execPath,
  "pm",
  "pack",
  "--ignore-scripts",
  "--filename",
  archive,
])
const action = join(work, "action")
await mkdir(join(action, "dist"), { recursive: true })
await cp(join(root, "apps/action/action.yml"), join(action, "action.yml"))
await cp(join(root, "apps/action/dist/launcher.cjs"), join(action, "dist/launcher.cjs"))
const launcher = join(action, "dist/launcher.cjs")
const launcherSha256 = hash(await readFile(launcher))
const outcomes = []

for (const manager of ["bun", "npm"] as const) {
  const cwd = join(work, manager)
  await mkdir(cwd)
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({
      name: `packed-action-${manager}`,
      private: true,
      type: "module",
      dependencies: {
        "@mannyc1/ts-release": `file:${archive}`,
        effect: "4.0.0-beta.107",
      },
    }),
  )
  await command(
    cwd,
    manager === "bun"
      ? [process.execPath, "install", "--ignore-scripts", "--cache-dir", join(work, "bun-cache")]
      : ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"],
  )
  const installed = join(cwd, "node_modules/@mannyc1/ts-release")
  assert.equal((await lstat(installed)).isSymbolicLink(), false)
  for (const peer of ["@effect/platform-node", "@effect/platform-bun", "effect-build-apple"])
    assert.equal(await Bun.file(join(cwd, "node_modules", peer, "package.json")).exists(), false)
  await cp(
    join(root, "test/reimplementation/hosts/action-application.mjs"),
    join(cwd, "application.mjs"),
  )
  const remote = join(cwd, "journal.git")
  await command(cwd, [git, "init", "--bare", "--initial-branch=main", remote])
  const sendLog = join(cwd, "sends")
  const input = {
    authorize: true,
    hostile: true,
    gitExecutable: git,
    journalRemote: pathToFileURL(remote).href,
    sendLog,
  }
  let firstReport: unknown
  for (const cache of ["cache-a", "cache-b"]) {
    const output = join(cwd, `output-${cache}`)
    await writeFile(output, "")
    const result = await command(cwd, [node, launcher], {
      env: {
        GITHUB_ACTIONS: "true",
        GITHUB_OUTPUT: output,
        GITHUB_WORKSPACE: cwd,
        INPUT_APPLICATION: "application.mjs",
        INPUT_INPUT: JSON.stringify({ ...input, cacheDirectory: join(cwd, cache) }),
        TS_RELEASE_AUTHORIZE: "true",
        TS_RELEASE_TRANSPORT: "hostile-ambient-override",
      },
    })
    assert.equal(result.stderr, "")
    const report = JSON.parse(result.stdout)
    assert.deepEqual(
      report.operations.map((entry: { readonly status: string }) => entry.status),
      ["Satisfied"],
    )
    assert.equal(
      await readFile(output, "utf8"),
      `plan-id=${report.plan.planId}\njournal-revision=${report.journal.revision}\n`,
    )
    if (firstReport) assert.deepEqual(report, firstReport)
    else firstReport = report
  }
  assert.equal((await readFile(sendLog, "utf8")).trim().split("\n").length, 1)
  outcomes.push({
    manager,
    node: (await command(cwd, [node, "--version"])).stdout.trim(),
    installedPackageSymlink: false,
    optionalPeersAbsent: true,
    freshRunnerEquivalent: true,
    sends: 1,
  })
}

const record = {
  format: "ts-release/packed-action/1",
  work,
  action: {
    metadataSha256: hash(await readFile(join(action, "action.yml"))),
    launcherSha256,
  },
  package: { sha256: hash(await readFile(archive)) },
  outcomes,
  commands,
  limitation: "Local native Node acceptance; hosted node24 execution is separate acceptance.",
}
await writeFile(
  join(root, ".release/checks/current-packed-action.json"),
  `${JSON.stringify(record, null, 2)}\n`,
)
console.log(JSON.stringify({ work, launcherSha256, outcomes }))
