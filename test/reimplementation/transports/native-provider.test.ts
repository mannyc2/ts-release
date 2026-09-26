import { expect, test } from "bun:test"
import { Schema } from "effect"
import { join } from "node:path"
import { nativeServer } from "../warehouse/native-server.js"
import { nativeGit } from "./git-fixture.js"

const readWorkerResult = Schema.decodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      report: Schema.Struct({ operations: Schema.Array(Schema.Struct({ status: Schema.String })) }),
      dispatches: Schema.Finite,
      receipts: Schema.Finite,
    }),
  ),
)

for (const implementation of ["pypiserver", "devpi-server"] as const)
  test(`${implementation}: actual Node/Bun HTTP providers and Git journal survive process loss across runtimes`, async () => {
    const server = await nativeServer(implementation, 4),
      node = process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node"
    const initialized = Bun.spawnSync(
      [nativeGit, "init", "--bare", "--quiet", "--template=", join(server.root, "journal.git")],
      { stdout: "pipe", stderr: "pipe" },
    )
    expect(initialized.exitCode).toBe(0)
    const run = async (runtime: string, mode: string) => {
      const child = Bun.spawn(
        [
          runtime,
          join(import.meta.dir, "warehouse-native-host-worker.mjs"),
          server.root,
          mode,
          join(import.meta.dir, "../warehouse/fixtures"),
          nativeGit,
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, NODE_EXTRA_CA_CERTS: join(server.root, "cert.pem") },
        },
      )
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      return { code, stdout, stderr }
    }
    try {
      const killed = await run(node, "kill")
      expect(killed.code, killed.stderr).not.toBe(0)
      expect(server.uploads).toHaveLength(2)
      expect(server.uploads.every((upload) => upload.status === 200)).toBe(true)
      server.hide(true)
      const hidden = await run(process.execPath, "restart")
      expect(hidden.code, hidden.stderr).toBe(0)
      expect(
        readWorkerResult(hidden.stdout).report.operations.some(
          (operation) => operation.status === "Inconclusive",
        ),
      ).toBe(true)
      expect(server.uploads).toHaveLength(4)
      expect(new Set(server.uploads.map((upload) => upload.filename)).size).toBe(4)
      server.hide(false)
      for (const runtime of [node, process.execPath]) {
        const observed = await run(runtime, "restart")
        expect(observed.code, observed.stderr).toBe(0)
        const result = readWorkerResult(observed.stdout)
        expect(
          result.report.operations.every((operation) => operation.status === "Satisfied"),
        ).toBe(true)
        expect(result.dispatches).toBe(4)
        expect(result.receipts).toBe(3)
        expect(server.uploads).toHaveLength(4)
      }
    } finally {
      await server.close()
    }
  }, 60000)
