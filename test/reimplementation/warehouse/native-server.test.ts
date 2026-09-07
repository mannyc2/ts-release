import { expect, test } from "bun:test"
import { join } from "node:path"
import { writeFile } from "node:fs/promises"
import { nativeServer, pythonBin, command } from "./native-server.js"

for (const implementation of ["pypiserver", "devpi-server"] as const) {
  for (const count of [2, 4] as const) {
    test(`${implementation} native ${count}-file uploads, lost response, fresh SQLite runner and pip consumer`, async () => {
      const server = await nativeServer(implementation, count)
      const run = async (mode: string) => {
        const child = Bun.spawn(
          [process.execPath, join(import.meta.dir, "process-worker.ts"), server.root, mode],
          { stdout: "pipe", stderr: "pipe" },
        )
        const [code, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ])
        return { code, stdout, stderr }
      }
      try {
        const killed = await run("kill-after-two-commits")
        expect(killed.code, killed.stderr).not.toBe(0)
        expect(server.uploads).toHaveLength(2)
        expect(server.uploads.every((u) => u.status === 200)).toBe(true)
        server.hide(true)
        const hidden = await run("restart")
        expect(hidden.code, hidden.stderr).toBe(0)
        const uncertain = JSON.parse(hidden.stdout)
        expect(
          uncertain.report.operations.some(
            (op: { status: string }) => op.status === "Inconclusive",
          ),
        ).toBe(true)
        expect(server.uploads).toHaveLength(count)
        expect(new Set(server.uploads.map((u) => u.filename)).size).toBe(count)
        server.hide(false)
        const observed = await run("restart")
        expect(observed.code, observed.stderr).toBe(0)
        const result = JSON.parse(observed.stdout)
        expect(
          result.report.operations.every((op: { status: string }) => op.status === "Satisfied"),
        ).toBe(true)
        expect(result.dispatches).toBe(count)
        expect(result.receipts).toBe(count - 1)
        expect(result.sends).toBe(0)
        expect(server.uploads).toHaveLength(count)
        const consumer = join(server.root, "consumer")
        await command([join(pythonBin, "python"), "-m", "venv", consumer])
        const env = {
          ...process.env,
          PIP_CONFIG_FILE: "/dev/null",
          PIP_DISABLE_PIP_VERSION_CHECK: "1",
          PIP_NO_CACHE_DIR: "1",
        }
        await command(
          [
            join(consumer, "bin/python"),
            "-m",
            "pip",
            "install",
            "--no-deps",
            "--index-url",
            server.endpoint.simpleUrl,
            "--cert",
            join(server.root, "cert.pem"),
            "ts-release-native-fixture==1.2.3",
          ],
          env,
        )
        const imported = await command(
          [
            join(consumer, "bin/python"),
            "-c",
            "import ts_release_native_fixture; ts_release_native_fixture.main()",
          ],
          env,
        )
        const cli = await command([join(consumer, "bin/ts-release-native-fixture")], env)
        const pip = await command([join(consumer, "bin/python"), "-m", "pip", "--version"], env)
        expect(imported.trim()).toBe("warehouse-fixture-ok")
        expect(cli.trim()).toBe("warehouse-fixture-ok")
        await writeFile(
          join(server.root, "acceptance.json"),
          JSON.stringify(
            {
              format: "ts-release/warehouse-native-acceptance/1",
              implementation,
              count,
              versions: server.versions,
              endpoint: server.endpoint,
              uploads: server.uploads,
              hidden: uncertain,
              observed: result,
              imported,
              cli,
              pip,
              limits: [
                "Local native servers through TLS gateway",
                "Simple absence deliberately injected after process kill",
                "Retagged platform wheels are pure Python, not platform-host evidence",
                "No hosted Warehouse or trusted-publisher acceptance",
              ],
            },
            null,
            2,
          ) + "\n",
        )
        console.log(
          JSON.stringify({ implementation, count, receipt: join(server.root, "acceptance.json") }),
        )
      } finally {
        await server.close()
      }
    }, 60000)
  }
}
