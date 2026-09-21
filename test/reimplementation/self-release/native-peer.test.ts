import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { pack } from "../npm/fixtures.js"
import { startNativeReleasePeer } from "./native-peer.js"

const node =
  process.env.TS_RELEASE_ACCEPTANCE_NODE ?? process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node"
const worker = join(import.meta.dir, "native-consumer.mjs")
type Peer = Awaited<ReturnType<typeof startNativeReleasePeer>>
const spawn = (peer: Peer, mode: string, input?: string, trust = true) => {
  const child = Bun.spawn([node, worker, mode, ...(input ? [input] : [])], {
    env: { ...process.env, ...peer.environment, ...(trust ? {} : { NODE_EXTRA_CA_CERTS: "" }) },
    stdout: "pipe",
    stderr: "pipe",
  })
  const output = Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]).then(([exit, stdout, stderr]) => ({ exit, stdout, stderr }))
  return { child, output }
}
const run = async (peer: Peer, mode: string, input?: string) => {
  const result = await spawn(peer, mode, input).output
  expect(result.exit, result.stderr).toBe(0)
  return JSON.parse(result.stdout)
}
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "ts-release-native-consumer-"))
  const gitExecutable = Bun.which("git")!
  const journal = join(root, "journal.git")
  const initialize = Bun.spawn([gitExecutable, "init", "--bare", "--quiet", journal], {
    stdout: "pipe",
    stderr: "pipe",
  })
  expect(await initialize.exited).toBe(0)
  const tarball = join(root, "package.tgz")
  await writeFile(tarball, pack({ name: "@other-scope/native-harness", version: "2.3.4" }))
  const base = {
    tarball,
    gitExecutable,
    journalRemote: pathToFileURL(journal).href,
    repository: { owner: "another-owner", name: "native-repository" },
    commit: "d".repeat(40),
  }
  let attempt = 0
  return {
    root,
    tarball,
    async input() {
      const path = join(root, `input-${++attempt}.json`)
      await writeFile(
        path,
        JSON.stringify({ ...base, cacheDirectory: join(root, `cache-${attempt}`) }),
      )
      return path
    },
    async close() {
      await rm(root, { recursive: true, force: true })
    },
  }
}

test("native peer trusts only its certificate and denies every unlisted socket destination", async () => {
  const peer = await startNativeReleasePeer()
  try {
    const untrusted = await spawn(peer, "read", undefined, false).output
    expect(untrusted.exit).not.toBe(0)
    expect(peer.requests).toHaveLength(0)
    expect(await run(peer, "denied")).toMatchObject({ denied: 4 })
    expect(peer.requests).toHaveLength(0)
    expect(await run(peer, "read")).toMatchObject({ status: 404 })
    expect(peer.requests).toHaveLength(1)
    expect(peer.requests[0]).toMatchObject({
      host: "registry.npmjs.org",
      method: "GET",
      path: "/@fixture%2ftls",
      authenticated: false,
    })
    expect(peer.failures).toEqual([])
  } finally {
    await peer.close()
  }
}, 20000)

test("public npm/GitHub providers execute exact native HTTPS bytes through the real transport", async () => {
  const peer = await startNativeReleasePeer(),
    f = await fixture()
  try {
    const before = await run(peer, "observe", await f.input())
    expect(before.report.operations).toHaveLength(5)
    expect(peer.mutations).toHaveLength(0)
    const result = await run(peer, "release", await f.input())
    expect(
      result.report.operations.every((entry: { status: string }) => entry.status === "Satisfied"),
    ).toBe(true)
    expect(peer.mutations).toHaveLength(5)
    expect(peer.mutations.map((entry) => [entry.host, entry.method])).toEqual([
      ["registry.npmjs.org", "PUT"],
      ["api.github.com", "POST"],
      ["api.github.com", "POST"],
      ["uploads.github.com", "POST"],
      ["api.github.com", "PATCH"],
    ])
    const npm = JSON.parse(new TextDecoder().decode(peer.mutations[0]!.body))
    expect(npm.name).toBe("@other-scope/native-harness")
    expect(npm["dist-tags"].latest).toBe("2.3.4")
    expect(peer.mutations[0]!.path).toBe("/@other-scope%2fnative-harness")
    const attachment = Object.values(npm._attachments)[0] as { data: string }
    expect(Buffer.from(attachment.data, "base64")).toEqual(await readFile(f.tarball))
    expect(peer.mutations[3]!.body).toEqual(new Uint8Array(await readFile(f.tarball)))
    expect(JSON.parse(new TextDecoder().decode(peer.mutations[1]!.body))).toEqual({
      ref: "refs/tags/v2.3.4",
      sha: "d".repeat(40),
    })
    expect(peer.mutations.every((entry) => entry.authenticated)).toBe(true)
    expect(peer.requests.every((entry) => !("authorization" in entry.headers))).toBe(true)
    const repeated = await run(peer, "release", await f.input())
    expect(
      repeated.report.operations.every((entry: { status: string }) => entry.status === "Satisfied"),
    ).toBe(true)
    expect(peer.mutations).toHaveLength(5)
    expect(JSON.stringify(repeated.journal)).not.toContain("127.0.0.1")
    expect(peer.failures).toEqual([])
  } finally {
    await peer.close()
    await f.close()
  }
}, 40000)

for (const subject of [
  "npm:@other-scope/native-harness@2.3.4",
  "github:another-owner/native-repository:asset:v2.3.4:package.tgz",
])
  test(`native committed response loss retains ${subject} across fresh journal caches`, async () => {
    const peer = await startNativeReleasePeer(),
      f = await fixture()
    let child: ReturnType<typeof spawn>["child"] | undefined
    try {
      const pause = peer.pauseAfterCommit((mutation) => mutation.subject === subject)
      const pending = spawn(peer, "release", await f.input())
      child = pending.child
      let timer: ReturnType<typeof setTimeout> | undefined
      const committed = await Promise.race([
        pause.committed,
        pending.output.then((result) => {
          throw new Error(`Consumer exited before commit: ${result.exit} ${result.stderr}`)
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Timed out waiting for native commit")), 15000)
        }),
      ]).finally(() => clearTimeout(timer))
      expect(committed.subject).toBe(subject)
      peer.hide(subject)
      child.kill("SIGKILL")
      expect((await pending.output).exit).not.toBe(0)
      pause.resume()
      const hidden = await run(peer, "release", await f.input())
      expect(
        hidden.report.operations.some((entry: { status: string }) => entry.status !== "Satisfied"),
      ).toBe(true)
      expect(peer.mutations.filter((entry) => entry.subject === subject)).toHaveLength(1)
      peer.reveal(subject)
      const complete = await run(peer, "release", await f.input())
      expect(
        complete.report.operations.every(
          (entry: { status: string }) => entry.status === "Satisfied",
        ),
      ).toBe(true)
      expect(peer.mutations).toHaveLength(5)
      expect(
        complete.journal.events.filter(
          (entry: { body: { _tag: string } }) => entry.body._tag === "DispatchStarted",
        ),
      ).toHaveLength(5)
      expect(
        complete.journal.events.filter(
          (entry: { body: { _tag: string } }) => entry.body._tag === "ReceiptAccepted",
        ),
      ).toHaveLength(4)
      await run(peer, "release", await f.input())
      expect(peer.mutations).toHaveLength(5)
      expect(peer.failures).toEqual([])
    } finally {
      child?.kill()
      await peer.close()
      await f.close()
    }
  }, 45000)
