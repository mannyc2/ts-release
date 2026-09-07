import { expect, test } from "bun:test"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const cli = resolve(import.meta.dir, "../../../packages/ts-release/dist/bin/ts-release.js")
const application = join(import.meta.dir, "cli-fixture.mjs")
const node = process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node"
for (const runtime of [node, process.execPath]) {
  test(`built shared CLI input, report, redaction and exit status: ${runtime}`, async () => {
    const work = await mkdtemp(join(tmpdir(), "ts-release-cli-"))
    const input = join(work, "input.json")
    async function run(args: string[]) {
      const child = Bun.spawn([runtime, cli, ...args], { stdout: "pipe", stderr: "pipe" })
      const [exit, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      return { exit, stdout, stderr }
    }
    expect(await run(["--help"])).toEqual({
      exit: 0,
      stdout: "Usage: ts-release <application.mjs> <input.json>\n",
      stderr: "",
    })
    expect((await run([])).exit).toBe(1)
    for (const unresolved of [false, true]) {
      await writeFile(input, JSON.stringify({ unresolved }))
      const result = await run([application, input])
      expect(result.exit).toBe(unresolved ? 2 : 0)
      expect(result.stderr).toBe("")
      const report = JSON.parse(result.stdout)
      expect(report.format).toBe("ts-release/report/1")
      expect(report.journal).toEqual({
        journalId: report.plan.journalId,
        revision: 0,
        events: [],
      })
      expect(report.operations.map((op: { status: string }) => op.status)).toEqual(
        unresolved ? ["Unattempted"] : [],
      )
    }
    for (const body of ["{invalid-fixture-private-json", '{"failure":true}']) {
      await writeFile(input, body)
      expect(await run([application, input])).toEqual({
        exit: 1,
        stdout: "",
        stderr: "ts-release: application failed; inspect the durable journal before resuming.\n",
      })
    }
    expect((await run(["/fixture-private-missing.mjs", input])).stderr).not.toContain(
      "fixture-private",
    )
    await writeFile(input, '{"log":true}')
    const logged = await run([application, input])
    expect(logged.exit).toBe(0)
    expect(JSON.parse(logged.stdout).format).toBe("ts-release/report/1")
    expect(logged.stderr).toContain("fixture-application-log")
  }, 30_000)

  for (const [signal, expected] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    test(`shared CLI ${signal} awaits scoped cleanup: ${runtime}`, async () => {
      const work = await mkdtemp(join(tmpdir(), "ts-release-cli-signal-"))
      const marker = join(work, "lifecycle")
      const input = join(work, "input.json")
      await writeFile(input, JSON.stringify({ marker, wait: true }))
      const child = Bun.spawn([runtime, cli, application, input], {
        stdout: "pipe",
        stderr: "pipe",
      })
      const stdout = new Response(child.stdout).text()
      const stderr = new Response(child.stderr).text()
      try {
        const deadline = Date.now() + 5000
        while (
          (await readFile(marker, "utf8").catch(() => "")) !== "acquire\n" &&
          Date.now() < deadline
        )
          await Bun.sleep(10)
        expect(await readFile(marker, "utf8")).toBe("acquire\n")
        child.kill(signal)
        expect(await child.exited).toBe(expected)
        expect(await stdout).toBe("")
        expect(await stderr).toBe("")
        expect(await readFile(marker, "utf8")).toBe("acquire\nrelease\n")
      } finally {
        child.kill("SIGKILL")
        await child.exited
      }
    }, 10_000)
  }
  test(`shared CLI native pipe cancellation and closed output: ${runtime}`, async () => {
    const child = Bun.spawn(
      ["python3", join(import.meta.dir, "cli-pipes.py"), runtime, cli, application],
      { stdout: "pipe", stderr: "pipe" },
    )
    const [exit, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect({ exit, stderr }).toEqual({ exit: 0, stderr: "" })
    expect(JSON.parse(stdout)).toEqual({ cases: 3, assertions: 13 })
  }, 15_000)
}
