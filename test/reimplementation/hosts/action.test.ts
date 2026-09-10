import { beforeAll, expect, test } from "bun:test"
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const root = resolve(import.meta.dir, "../../..")
const node =
  process.env.TS_RELEASE_HTTP_PEER_NODE ??
  "/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node"
const git = Bun.which("git")!
const launcher = join(root, "apps/action/dist/launcher.cjs")
const application = join(import.meta.dir, "action-application.mjs")

beforeAll(async () => {
  const child = Bun.spawn([process.execPath, "run", "build:delivery"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [code, output] = await Promise.all([child.exited, new Response(child.stderr).text()])
  expect(code, output).toBe(0)
}, 60_000)

const bare = async (directory: string) => {
  const child = Bun.spawn([git, "init", "--bare", "--initial-branch=main", directory], {
    stdout: "pipe",
    stderr: "pipe",
  })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
}
const spawnAction = async (
  work: string,
  input: Record<string, unknown>,
  selectedApplication = application,
) => {
  const output = join(work, `output-${crypto.randomUUID()}`)
  await writeFile(output, "")
  const child = Bun.spawn([node, launcher], {
    cwd: root,
    env: {
      ...process.env,
      GITHUB_ACTIONS: "true",
      GITHUB_WORKSPACE: root,
      GITHUB_OUTPUT: output,
      INPUT_APPLICATION: selectedApplication,
      INPUT_INPUT: JSON.stringify(input),
      TS_RELEASE_AUTHORIZE: "true",
      TS_RELEASE_TRANSPORT: "hostile-ambient-override",
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exit, stdout, stderr, output: await readFile(output, "utf8") }
}

test("packed node Action uses one explicit shared journal and survives a fresh runner", async () => {
  const work = await mkdtemp(join(tmpdir(), "ts-release-action-"))
  const remote = join(work, "journal.git")
  const sendLog = join(work, "sends")
  await bare(remote)
  const base = {
    authorize: true,
    hostile: true,
    gitExecutable: git,
    journalRemote: pathToFileURL(remote).href,
    sendLog,
  }
  const first = await spawnAction(work, { ...base, cacheDirectory: join(work, "cache-a") })
  expect({ exit: first.exit, stderr: first.stderr }).toEqual({ exit: 0, stderr: "" })
  const report = JSON.parse(first.stdout)
  expect(report.operations.map((row: { status: string }) => row.status)).toEqual(["Satisfied"])
  expect(report.journal.revision).toBe(2)
  expect(first.output).toBe(
    `plan-id=${report.plan.planId}\njournal-revision=${report.journal.revision}\n`,
  )

  const second = await spawnAction(work, { ...base, cacheDirectory: join(work, "cache-b") })
  expect({ exit: second.exit, stderr: second.stderr }).toEqual({ exit: 0, stderr: "" })
  expect(JSON.parse(second.stdout)).toEqual(report)
  expect(second.output).toBe(first.output)
  expect((await readFile(sendLog, "utf8")).trim().split("\n")).toHaveLength(1)
}, 30_000)

test("Action path and failure boundaries fail closed without private diagnostics", async () => {
  const work = await mkdtemp(join(tmpdir(), "ts-release-action-failure-"))
  const outside = join(work, "outside.mjs")
  const link = join(root, "test/reimplementation/hosts/outside-link.mjs")
  await writeFile(outside, "export const createApplication = () => null\n")
  await symlink(outside, link)
  try {
    for (const selected of [outside, link]) {
      const result = await spawnAction(work, {}, selected)
      expect(result.exit).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("Rerun with observe: true")
      expect(result.stderr).not.toContain("outside")
    }
    const marker = join(work, "marker")
    const result = await spawnAction(work, { marker, failure: true })
    expect(result.exit).toBe(1)
    expect(result.stderr).not.toContain("Private fixture diagnostic")
    expect(await readFile(marker, "utf8")).toBe("acquire\nrelease\n")
  } finally {
    await Bun.file(link).delete()
  }
})

for (const [signal, exit] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const)
  test(`Action ${signal} awaits scoped application cleanup`, async () => {
    const work = await mkdtemp(join(tmpdir(), "ts-release-action-signal-"))
    const marker = join(work, "marker")
    const output = join(work, "output")
    await writeFile(output, "")
    const child = Bun.spawn([node, launcher], {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_ACTIONS: "true",
        GITHUB_WORKSPACE: root,
        GITHUB_OUTPUT: output,
        INPUT_APPLICATION: application,
        INPUT_INPUT: JSON.stringify({ marker, wait: true }),
      },
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = new Response(child.stdout).text()
    const stderr = new Response(child.stderr).text()
    try {
      const deadline = Date.now() + 5000
      while ((await readFile(marker, "utf8").catch(() => "")) !== "acquire\n") {
        if (Date.now() > deadline) throw new Error("Action application did not acquire its scope")
        await Bun.sleep(10)
      }
      child.kill(signal)
      expect(await child.exited).toBe(exit)
      expect(await stdout).toBe("")
      expect(await stderr).toBe("")
      expect(await readFile(marker, "utf8")).toBe("acquire\nrelease\n")
      expect(await readFile(output, "utf8")).toBe("")
    } finally {
      child.kill("SIGKILL")
      await child.exited
    }
  }, 10_000)
