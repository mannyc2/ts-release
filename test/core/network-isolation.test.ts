import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeRunCommand } from "../../src/drivers/process.js"
import {
  makeNetworkIsolationHelperSource,
  networkIsolationHelperSource
} from "../../src/drivers/seccomp-helper-source.js"

const liveRunner = () => Effect.runPromise(makeRunCommand.pipe(Effect.provide(BunServices.layer)))

describe("fail-closed preparation network isolation", () => {
  test("ordinary commands succeed while TCP, UDP, DNS, and HTTP cannot communicate", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-network-test-"))
    try {
      const run = await liveRunner()
      const build = await Effect.runPromise(run({
        argv: ["bun", "--no-env-file", "--no-install", "-e", "await Bun.write('out/result.txt', 'built\\n'); console.log('built')"],
        cwd: root,
        environmentNames: [],
        network: "deny"
      }))
      expect(build).toMatchObject({ exitCode: 0, stdout: "built\n" })
      expect(readFileSync(join(root, "out", "result.txt"), "utf8")).toBe("built\n")
      expect(build.networkIsolation).toMatchObject({
        protocol: "ts-release-seccomp-network-deny/v1",
        bunVersion: Bun.version,
        architecture: process.arch
      })
      expect(build.networkIsolation?.helperSha256).toMatch(/^[a-f0-9]{64}$/u)
      expect(build.networkIsolation?.librarySha256).toMatch(/^[a-f0-9]{64}$/u)
      expect(build.networkIsolation?.bunSha256).toBe(build.tool?.sha256)

      const probe = await Effect.runPromise(run({
        argv: ["bun", "--no-env-file", "--no-install", "-e", String.raw`
          import net from "node:net";
          import dgram from "node:dgram";
          import dns from "node:dns/promises";
          const tcp = await new Promise((done) => {
            const socket = net.connect(9, "127.0.0.1");
            socket.once("connect", () => done("connected"));
            socket.once("error", (error) => done(error.code ?? error.name));
          });
          const udp = await new Promise((done) => {
            const socket = dgram.createSocket("udp4");
            socket.once("listening", () => { socket.close(); done("listening") });
            socket.once("error", (error) => { socket.close(); done(error.code ?? error.name) });
            socket.bind(0, "127.0.0.1");
          });
          const dnsResult = await dns.lookup("ts-release-network-probe.invalid")
            .then(() => "resolved", (error) => error.code ?? error.name);
          const http = await fetch("http://127.0.0.1:9/")
            .then(() => "connected", (error) => error.cause?.code ?? error.name);
          console.log(JSON.stringify({ tcp, udp, dns: dnsResult, http }));
        `],
        cwd: root,
        environmentNames: [],
        network: "deny"
      }))
      expect(probe.exitCode).toBe(0)
      const result = JSON.parse(probe.stdout) as Record<string, string>
      expect(result.tcp).not.toBe("connected")
      expect(result.udp).not.toBe("listening")
      expect(result.dns).not.toBe("resolved")
      expect(result.http).not.toBe("connected")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 20_000)

  test("an unavailable libseccomp filter refuses execution", () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-network-filter-test-"))
    try {
      const source = makeNetworkIsolationHelperSource("libseccomp-ts-release-missing.so.2")
      const helper = join(root, "helper.mjs")
      const identity = join(root, "identity.json")
      writeFileSync(helper, source, { mode: 0o500 })
      const result = spawnSync("bun", ["--no-env-file", "--no-install", helper, "bun", "--version"], {
        cwd: root,
        encoding: "utf8",
        timeout: 5_000,
        env: {
          PATH: process.env.PATH ?? "",
          TS_RELEASE_NETWORK_IDENTITY_FILE: identity,
          TS_RELEASE_NETWORK_HELPER_SHA256: createHash("sha256").update(source).digest("hex"),
          TS_RELEASE_NETWORK_LIBRARY: "libseccomp-ts-release-missing.so.2"
        }
      })
      expect(result.status).toBe(125)
      expect(result.stderr).toContain("failed closed")
      expect(result.stderr).toContain("unavailable")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("the helper does not pass a non-stdio descriptor to the isolated child", () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-network-fd-test-"))
    try {
      const helper = join(root, "helper.mjs")
      const target = join(root, "target.mjs")
      const marker = join(root, "marker")
      const identity = join(root, "identity.json")
      writeFileSync(helper, networkIsolationHelperSource, { mode: 0o500 })
      writeFileSync(target, `import { readlinkSync } from "node:fs"; let inherited = false; try { inherited = readlinkSync("/proc/self/fd/9") === ${JSON.stringify(marker)} } catch {}; console.log(inherited ? "inherited" : "closed")\n`)
      writeFileSync(marker, "marker\n")
      const result = spawnSync("bash", ["-c", "exec 9<\"$1\"; exec bun --no-env-file --no-install \"$2\" bun --no-env-file --no-install \"$3\"", "_", marker, helper, target], {
        cwd: root,
        encoding: "utf8",
        timeout: 5_000,
        env: {
          PATH: process.env.PATH ?? "",
          TS_RELEASE_NETWORK_IDENTITY_FILE: identity,
          TS_RELEASE_NETWORK_HELPER_SHA256: createHash("sha256").update(networkIsolationHelperSource).digest("hex"),
          TS_RELEASE_NETWORK_LIBRARY: "libseccomp.so.2"
        }
      })
      expect(result.status).toBe(0)
      expect(result.stdout.trim()).toBe("closed")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
