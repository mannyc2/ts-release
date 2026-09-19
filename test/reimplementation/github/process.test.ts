import { expect, test } from "bun:test"
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  fixture,
  repository,
  base,
  refDocument,
  releaseDocument,
  assetDocument,
} from "./fixtures.js"

test("GitHub protocol HTTP and native Git journal preserve returned IDs across SIGKILL and Node/Bun restarts", async () => {
  const root = await mkdtemp(join(tmpdir(), "github-process-acceptance-")),
    f = await fixture(3, true),
    sends: string[] = []
  const gitExecutable = await realpath(Bun.which("git")!),
    node = process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node"
  const initialized = Bun.spawnSync([gitExecutable, "init", "--bare", join(root, "journal.git")], {
    stdout: "pipe",
    stderr: "pipe",
  })
  expect(initialized.exitCode).toBe(0)
  await writeFile(
    join(root, "config.json"),
    JSON.stringify({
      repository,
      plan: f.plan,
      bundle: f.access.bundle,
      contents: Object.fromEntries(
        f.files.map((file, i) => [
          file.content.sha256,
          Buffer.from(f.bytes[i]!).toString("base64"),
        ]),
      ),
      gitExecutable,
    }),
  )
  let visible = true
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      expect(request.headers.get("authorization")).toBe("Bearer protocol-fixture-token")
      expect(request.headers.get("user-agent")).toBe("ts-release")
      expect(request.headers.get("x-github-api-version")).toBe("2022-11-28")
      const url = new URL(request.url),
        path = url.pathname.replace("/repos/owner/repo", "")
      if (request.method === "GET") {
        if (path === "")
          return Response.json({ full_name: "owner/repo", url: base, permissions: { push: true } })
        if (path === "/git/ref/tags/v1.0.0")
          return f.state.ref ? Response.json(f.state.ref) : new Response(null, { status: 404 })
        if (path.startsWith("/git/tags/"))
          return f.state.object && path.endsWith(String(f.state.object.sha))
            ? Response.json(f.state.object)
            : new Response(null, { status: 404 })
        if (path === "/releases") return Response.json(f.state.releases)
        if (path === "/releases/731")
          return f.state.releases[0]
            ? Response.json(f.state.releases[0])
            : new Response(null, { status: 404 })
        if (path === "/releases/731/assets") return Response.json(visible ? f.state.assets : [])
        return new Response(null, { status: 404 })
      }
      sends.push(`${request.method} ${path}`)
      if (path === "/releases/731/assets") {
        const name = url.searchParams.get("name")!,
          bytes = new Uint8Array(await request.arrayBuffer()),
          index = f.files.findIndex((file) => file.logicalName === name)
        expect(bytes).toEqual(f.bytes[index]!)
        expect(f.state.assets.some((asset) => asset.name === name)).toBe(false)
        const asset = assetDocument(1001 + index, name, bytes)
        f.state.assets.push(asset)
        return Response.json(asset, { status: 201 })
      }
      const data = (await request.json()) as Record<string, any>
      if (path === "/git/tags") {
        f.state.object = {
          sha: "b".repeat(40),
          tag: data.tag,
          message: data.message,
          tagger: data.tagger,
          url: `${base}/git/tags/${"b".repeat(40)}`,
          object: { sha: data.object, type: "commit", url: `${base}/git/commits/${data.object}` },
        }
        return Response.json(f.state.object, { status: 201 })
      }
      if (path === "/git/refs") {
        expect(data.sha).toBe("b".repeat(40))
        f.state.ref = refDocument(data.sha, "tag")
        return Response.json(f.state.ref, { status: 201 })
      }
      if (path === "/releases") {
        expect(data.draft).toBe(true)
        expect(data.target_commitish).toBe("a".repeat(40))
        f.state.releases.push(releaseDocument())
        return Response.json(f.state.releases[0], { status: 201 })
      }
      if (path === "/releases/731" && request.method === "PATCH") {
        expect(f.state.assets).toHaveLength(3)
        expect(data).toEqual({ draft: false })
        f.state.releases[0]!.draft = false
        return Response.json(f.state.releases[0])
      }
      return new Response(null, { status: 404 })
    },
  })
  const run = async (runtime: string, mode: string) => {
    const child = Bun.spawn(
      [runtime, join(import.meta.dir, "process-worker.mjs"), root, server.url.origin, mode],
      { stdout: "pipe", stderr: "pipe" },
    )
    const [exitCode, out, err] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    return { exitCode, out, err }
  }
  try {
    const killed = await run(node, "kill-after-second-asset")
    expect(killed.exitCode).not.toBe(0)
    expect(sends).toHaveLength(5)
    expect(f.state.assets).toHaveLength(2)
    visible = false
    const hidden = await run(process.execPath, "restart")
    expect(hidden.exitCode, hidden.err).toBe(0)
    const interim = JSON.parse(hidden.out)
    expect(interim.dispatches).toBe(6)
    expect(interim.receipts).toBe(5)
    expect(f.state.assets).toHaveLength(3)
    expect(f.state.releases[0]!.draft).toBe(true)
    visible = true
    const restored = await run(node, "restart")
    expect(restored.exitCode, restored.err).toBe(0)
    const final = JSON.parse(restored.out)
    expect(
      final.report.operations.every((op: { status: string }) => op.status === "Satisfied"),
    ).toBe(true)
    expect(final.dispatches).toBe(7)
    expect(final.receipts).toBe(6)
    const repeated = await run(process.execPath, "restart")
    expect(repeated.exitCode, repeated.err).toBe(0)
    expect(
      JSON.parse(repeated.out).report.operations.every(
        (op: { status: string }) => op.status === "Satisfied",
      ),
    ).toBe(true)
    expect(sends).toHaveLength(7)
  } finally {
    server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
}, 60000)
