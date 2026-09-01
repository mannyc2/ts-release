import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import {
  chmodSync,
  copyFileSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const bootstrapSource = "apps/ts-release-action/report-handoff/bootstrap.cjs"
const requestUrl = "https://pipelines.actions.githubusercontent.com/token?api-version=2.0"
const requestToken = "runner-oidc-request-secret-73c1"

const fixture = (reportText: string, linkedParent = false, mode = 0o600) => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-report-handoff-bootstrap-"))
  const actionRoot = join(root, "action")
  const workspace = join(root, "workspace")
  const probe = join(root, "probe.json")
  mkdirSync(join(actionRoot, "dist"), { recursive: true })
  mkdirSync(workspace, { recursive: true })
  copyFileSync(bootstrapSource, join(actionRoot, "bootstrap.cjs"))
  writeFileSync(join(actionRoot, "dist", "index.cjs"), `
    "use strict";
    const fs = require("node:fs");
    exports.main = (sourceProof) => {
      fs.writeFileSync(process.env.PROBE_PATH, JSON.stringify({
        sourceProof,
        oidcUrl: process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? null,
        oidcToken: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? null
      }));
    };
  `, { mode: 0o600 })
  const canonicalParent = join(workspace, ".release", "ts-release")
  if (linkedParent) {
    const target = join(root, "linked-report-parent")
    mkdirSync(target, { recursive: true })
    mkdirSync(join(workspace, ".release"), { recursive: true })
    symlinkSync(target, canonicalParent)
    writeFileSync(join(target, "npm-oidc-certification.json"), reportText, { mode })
  } else {
    mkdirSync(canonicalParent, { recursive: true })
    writeFileSync(join(canonicalParent, "npm-oidc-certification.json"), reportText, { mode })
  }
  const reportPath = join(canonicalParent, "npm-oidc-certification.json")
  const run = () => spawnSync(Bun.which("node")!, [join(actionRoot, "bootstrap.cjs")], {
    cwd: actionRoot,
    encoding: "utf8",
    env: {
      LANG: "C",
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      INPUT_KIND: "npm-oidc-certification",
      GITHUB_WORKSPACE: workspace,
      PROBE_PATH: probe,
      ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: requestToken
    }
  })
  return { root, probe, reportPath, run }
}

test("authority-dropping bootstrap binds exact scanned bytes before loading dependencies", () => {
  const report = '{"status":"redacted"}\n'
  const current = fixture(report)
  try {
    const result = current.run()
    expect(result.status).toBe(0)
    expect(JSON.parse(readFileSync(current.probe, "utf8"))).toEqual({
      sourceProof: {
        reportBytes: String(Buffer.byteLength(report)),
        reportSha256: createHash("sha256").update(report).digest("hex")
      },
      oidcUrl: null,
      oidcToken: null
    })
  } finally {
    rmSync(current.root, { recursive: true, force: true })
  }
})

test("authority-dropping bootstrap refuses OIDC leakage and linked report parents before dependencies", () => {
  for (const current of [
    fixture(`${requestToken}\n`),
    fixture(`${requestUrl}\n`),
    fixture('{"status":"redacted"}\n', true)
  ]) {
    try {
      const result = current.run()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("failed closed [bootstrap]")
      expect(() => readFileSync(current.probe)).toThrow()
    } finally {
      rmSync(current.root, { recursive: true, force: true })
    }
  }
})

test("authority-dropping bootstrap rejects missing, public, linked, or oversized reports", () => {
  const missing = fixture('{"status":"redacted"}\n')
  rmSync(missing.reportPath)
  const publicMode = fixture('{"status":"redacted"}\n')
  chmodSync(publicMode.reportPath, 0o644)
  const hardLinked = fixture('{"status":"redacted"}\n')
  linkSync(hardLinked.reportPath, join(hardLinked.root, "report-alias.json"))
  const oversized = fixture(`{"padding":"${"x".repeat(1024 * 1024)}"}\n`)
  for (const current of [missing, publicMode, hardLinked, oversized]) {
    try {
      const result = current.run()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("failed closed [bootstrap]")
      expect(() => readFileSync(current.probe)).toThrow()
    } finally {
      rmSync(current.root, { recursive: true, force: true })
    }
  }
})

test("authority-dropping bootstrap rejects missing or noncanonical OIDC coordinates", () => {
  for (const patch of [
    { ACTIONS_ID_TOKEN_REQUEST_URL: "" },
    { ACTIONS_ID_TOKEN_REQUEST_TOKEN: "" },
    { ACTIONS_ID_TOKEN_REQUEST_URL: "http://pipelines.actions.githubusercontent.com/token" },
    { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid/token" }
  ]) {
    const current = fixture('{"status":"redacted"}\n')
    try {
      const result = spawnSync(Bun.which("node")!, [join(current.root, "action", "bootstrap.cjs")], {
        cwd: join(current.root, "action"),
        encoding: "utf8",
        env: {
          LANG: "C",
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          INPUT_KIND: "npm-oidc-certification",
          GITHUB_WORKSPACE: join(current.root, "workspace"),
          PROBE_PATH: current.probe,
          ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: requestToken,
          ...patch
        }
      })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("failed closed [bootstrap]")
      expect(() => readFileSync(current.probe)).toThrow()
    } finally {
      rmSync(current.root, { recursive: true, force: true })
    }
  }
})

test("authority-dropping bootstrap rejects normalized process-injection aliases before dependencies", () => {
  for (const patch of [
    { NODE_PATH: "/tmp/hostile-modules" },
    { NoDe_ExTrA_Ca_CeRtS: "/tmp/hostile-ca.pem" },
    { HTTPS_PROXY: "http://hostile.invalid" },
    { BUN_CONFIG_PRELOAD: "/tmp/hostile.ts" },
    { Ld_AuDiT: "/tmp/hostile.so" },
    { DyLd_InSeRt_LiBrArIeS: "/tmp/hostile.dylib" }
  ]) {
    const current = fixture('{"status":"redacted"}\n')
    try {
      const result = spawnSync(Bun.which("node")!, [join(current.root, "action", "bootstrap.cjs")], {
        cwd: join(current.root, "action"),
        encoding: "utf8",
        env: {
          LANG: "C",
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          INPUT_KIND: "npm-oidc-certification",
          GITHUB_WORKSPACE: join(current.root, "workspace"),
          PROBE_PATH: current.probe,
          ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: requestToken,
          ...patch
        }
      })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("failed closed [bootstrap]")
      expect(() => readFileSync(current.probe)).toThrow()
    } finally {
      rmSync(current.root, { recursive: true, force: true })
    }
  }
})
