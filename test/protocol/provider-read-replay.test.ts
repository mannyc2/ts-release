import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("opt-in provider read replay", () => {
  test("is disabled by default and its source admits only anonymous manual-redirect GETs", () => {
    const script = join(process.cwd(), "scripts", "replay-provider-reads.ts")
    const result = Bun.spawnSync(["bun", "run", script], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH ?? "" },
      stdout: "pipe",
      stderr: "pipe"
    })
    expect(result.exitCode).toBe(2)
    expect(result.stdout.toString()).toBe("")
    expect(result.stderr.toString()).toContain("Provider replay is disabled")

    const source = readFileSync(script, "utf8")
    expect(source).toContain('TS_RELEASE_PROVIDER_REPLAY === "read-only"')
    expect(source).toContain('method: "GET"')
    expect(source).toContain('redirect: "manual"')
    expect(source).toContain('authority: "anonymous-read-only"')
    expect(source).toContain("mutationRequests: 0")
    expect(source).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/u)
    expect(source).not.toMatch(/authorization|NPM_TOKEN|GITHUB_TOKEN|NODE_AUTH_TOKEN/iu)
  })
})
