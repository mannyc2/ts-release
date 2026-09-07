import { expect, test } from "bun:test"
import { createServer } from "node:http"
import { once } from "node:events"
import { fork } from "node:child_process"
import { fileURLToPath } from "node:url"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Layer } from "effect"
import {
  Host,
  NoReplay,
  createOperation,
  createPlan,
  makeRequest,
  runRelease,
  type HostShape,
  type PreparedRequest,
} from "@mannyc1/ts-release"
import { makeHttpTransport, makeHttpRead, makeCredentialExchange } from "@mannyc1/ts-release/node"
import type { HttpProviderDefinition, ResolveCredentials } from "@mannyc1/ts-release/http"
import { MemoryJournal, providerFor, runWithHost, startEvents } from "../kernel/fixtures.js"

const peer = async (mode: "accepted" | "drop" | "redirect" | "large" | "truncated" | "hang") => {
  const writes: { method: string; url: string; body: string; authorization: string | undefined }[] =
    []
  const sockets = new Set<import("node:net").Socket>()
  let committed!: () => void
  const received = new Promise<void>((resolve) => {
    committed = resolve
  })
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    writes.push({
      method: request.method!,
      url: request.url!,
      body: Buffer.concat(chunks).toString(),
      authorization: request.headers.authorization,
    })
    committed()
    if (mode === "hang") return
    if (mode === "drop") {
      request.socket.destroy()
      return
    }
    if (mode === "redirect") {
      response.writeHead(307, { location: "/redirect-target" }).end()
      return
    }
    if (mode === "large") {
      response.writeHead(201).end("x".repeat(8192))
      return
    }
    if (mode === "truncated") {
      response.writeHead(201, { "content-length": "1000" })
      response.flushHeaders()
      response.write("short")
      setTimeout(() => request.socket.destroy(), 10)
      return
    }
    response.writeHead(201).end("ok")
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address() as import("node:net").AddressInfo
  return {
    writes,
    received,
    sockets,
    url: `http://127.0.0.1:${address.port}/artifact`,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
const definition = (url: string): HttpProviderDefinition => ({
  ...providerFor(),
  prepare: () => requestFor(url),
  ownsRequest: (request) =>
    request.facts.endpoint === url &&
    request.facts.method === "PUT" &&
    request.facts.scope === "release:write",
  decodeResponse: (request, response) =>
    Effect.succeed(
      response.status === 201
        ? {
            _tag: "Accepted",
            receipt: {
              status: response.status,
              endpoint: request.facts.endpoint,
              bodyDigest: request.facts.bodyDigest,
            },
          }
        : { _tag: "Unknown", reason: "Native status is not a fixture acknowledgement" },
    ),
})
const requestFor = (url: string, extra: Partial<Parameters<typeof makeRequest>[0]> = {}) =>
  makeRequest({
    transport: "core.http/1",
    endpoint: url,
    method: "PUT",
    headers: [["content-type", "application/octet-stream"]],
    body: new TextEncoder().encode("exact artifact bytes"),
    principal: "fixture-user",
    scope: "release:write",
    replay: new NoReplay({}),
    ...extra,
  })
const fixture = async (
  url: string,
  options: {
    credentials?: ResolveCredentials
    timeout?: number
    providers?: HttpProviderDefinition[]
  } = {},
) => {
  const provider = definition(url),
    store = new MemoryJournal()
  let serial = 0
  const operation = await Effect.runPromise(
    createOperation(provider, {
      coordinate: "artifact",
      endpoint: url,
      content: "exact artifact bytes",
    }),
  )
  const plan = await Effect.runPromise(createPlan("fixture-http-bundle", [operation]))
  const host: HostShape = {
    providers: [provider],
    store,
    now: () => 1000,
    uniqueId: () => `http-${++serial}`,
    transport: makeHttpTransport({
      providers: options.providers ?? [provider],
      credentials: options.credentials ?? (() => Effect.succeed({})),
      timeoutMilliseconds: options.timeout ?? 2000,
      maximumResponseBytes: 1024,
    }),
  }
  return { host, store, plan, run: () => runWithHost(host, runRelease({ plan, authorize: true })) }
}

test("HTTP acknowledgement comes from exactly one native write after the fresh journal append", async () => {
  const server = await peer("accepted")
  try {
    let beforeCredentials = -1
    const f = await fixture(server.url, {
      credentials: () =>
        Effect.sync(() => {
          beforeCredentials = f.store.journals.get(f.plan.journalId)?.length ?? 0
          return {}
        }),
    })
    expect((await f.run()).operations[0]?.status).toBe("Satisfied")
    expect(beforeCredentials).toBe(0)
    expect(await startEvents(f.store, f.plan)).toHaveLength(1)
    expect(server.writes).toEqual([
      { method: "PUT", url: "/artifact", body: "exact artifact bytes", authorization: undefined },
    ])
    expect((await f.run()).operations[0]?.status).toBe("Satisfied")
    expect(server.writes).toHaveLength(1)
  } finally {
    await server.close()
  }
})

test("lost, redirected, oversized, truncated and timed-out responses stay uncertain without retry on restart", async () => {
  for (const mode of ["drop", "redirect", "large", "truncated", "hang"] as const) {
    const server = await peer(mode)
    try {
      const f = await fixture(server.url, { timeout: 100 })
      expect((await f.run()).operations[0]?.status).toBe("Inconclusive")
      expect(server.writes).toHaveLength(1)
      expect(await startEvents(f.store, f.plan)).toHaveLength(1)
      expect((await f.run()).operations[0]?.status).toBe("Inconclusive")
      expect(server.writes).toHaveLength(1)
      expect(JSON.stringify(await Effect.runPromise(f.store.read(f.plan.journalId)))).not.toContain(
        "xxxx",
      )
    } finally {
      await server.close()
    }
  }
})

test("interruption after remote commit destroys the socket and leaves restart without dispatch permission", async () => {
  const child = fork(fileURLToPath(new URL("./http-peer.mjs", import.meta.url)), [], {
    execPath: process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node",
    silent: true,
  })
  const messages: { event: string; url?: string; writes?: number }[] = []
  const waiters = new Map<string, (value: (typeof messages)[number]) => void>()
  child.on("message", (message) => {
    const value = message as (typeof messages)[number]
    messages.push(value)
    waiters.get(value.event)?.(value)
  })
  const waitFor = (event: string) =>
    new Promise<(typeof messages)[number]>((resolve) => {
      const previous = messages.find((message) => message.event === event)
      if (previous) resolve(previous)
      else waiters.set(event, resolve)
    })
  try {
    const ready = await waitFor("ready")
    const f = await fixture(ready.url!),
      controller = new AbortController()
    const run = Effect.runPromise(
      Effect.provide(runRelease({ plan: f.plan, authorize: true }), Layer.succeed(Host, f.host)),
      { signal: controller.signal },
    )
    const outcome = run.then(
      () => "resolved",
      () => "interrupted",
    )
    expect((await waitFor("committed")).writes).toBe(1)
    controller.abort()
    expect(await outcome).toBe("interrupted")
    expect((await waitFor("socket-closed")).writes).toBe(1)
    expect(await startEvents(f.store, f.plan)).toHaveLength(1)
    expect((await f.run()).operations[0]?.status).toBe("Inconclusive")
    expect(messages.filter((message) => message.event === "committed")).toHaveLength(1)
  } finally {
    child.kill()
    await once(child, "exit")
  }
})

test("unknown or ambiguous ownership fails before credentials and journal dispatch", async () => {
  const server = await peer("accepted")
  try {
    for (const providers of [[], [definition(server.url), definition(server.url)]]) {
      let secrets = 0
      const f = await fixture(server.url, {
        providers,
        credentials: () =>
          Effect.sync(() => {
            secrets++
            return {}
          }),
      })
      await expect(f.run()).rejects.toThrow("HTTP")
      expect(secrets).toBe(0)
      expect(await startEvents(f.store, f.plan)).toHaveLength(0)
    }
    expect(server.writes).toHaveLength(0)
  } finally {
    await server.close()
  }
})

test("native wire admission rejects ambiguous endpoints, headers, replay and bodies before credentials", async () => {
  const url = "https://fixture.invalid/artifact",
    provider = definition(url)
  let secrets = 0
  const transport = makeHttpTransport({
    providers: [{ ...provider, ownsRequest: () => true }],
    credentials: () =>
      Effect.sync(() => {
        secrets++
        return {}
      }),
    timeoutMilliseconds: 100,
    maximumResponseBytes: 100,
  })
  for (const extra of [
    { endpoint: "https://user:password@fixture.invalid/artifact" },
    { endpoint: url + "#ignored" },
    { endpoint: "https://fixture.invalid" },
    { endpoint: "ftp://fixture.invalid/artifact" },
    { method: "CONNECT" },
    { method: "GET" },
    { transport: "opaque/1" as const },
    { headers: [["host", "wrong.invalid"]] },
    { headers: [["content-length", "0"]] },
    {
      headers: [
        ["X-Test", "1"],
        ["x-test", "2"],
      ],
    },
    { headers: [["authorization", "secret"]] },
    { headers: [["x-test", "bad\r\nheader"]] },
  ] satisfies Partial<Parameters<typeof makeRequest>[0]>[]) {
    const request = await Effect.runPromise(requestFor(url, extra))
    await expect(Effect.runPromise(transport.prepare!(request))).rejects.toThrow()
  }
  expect(secrets).toBe(0)
})

test("live headers cannot collide, change framing, use cleartext, or leak through failures", async () => {
  for (const live of [
    { "CONTENT-TYPE": "wrong" },
    { host: "wrong" },
    { Authorization: "one", authorization: "two" },
    { authorization: "bad\r\nsecret" },
  ]) {
    const url = "https://fixture.invalid/artifact",
      f = await fixture(url, { credentials: () => Effect.succeed(live) })
    await expect(f.run()).rejects.toThrow()
    expect(await startEvents(f.store, f.plan)).toHaveLength(0)
  }
  const f = await fixture("https://fixture.invalid/artifact", {
    credentials: () =>
      Effect.sync(() => {
        throw new Error("credential-secret-private")
      }),
  })
  await expect(f.run()).rejects.toThrow("HTTP credentials could not be acquired")
  expect(await startEvents(f.store, f.plan)).toHaveLength(0)
  const server = await peer("accepted")
  try {
    const f = await fixture(server.url, {
      credentials: () => Effect.succeed({ authorization: "Bearer secret" }),
    })
    await expect(f.run()).rejects.toThrow()
    expect(server.writes).toHaveLength(0)
  } finally {
    await server.close()
  }
})

test("prepared closure owns bytes, methods and exact facts across resolver alias mutation", async () => {
  const server = await peer("accepted")
  try {
    const request = await Effect.runPromise(requestFor(server.url)),
      provider = definition(server.url)
    const options = {
      providers: [provider],
      credentials: () =>
        Effect.sync(() => {
          request.body.fill(0)
          Object.assign(provider, { ownsRequest: () => false })
          return {}
        }),
      timeoutMilliseconds: 1000,
      maximumResponseBytes: 100,
    }
    const transport = makeHttpTransport(options)
    const send = await Effect.runPromise(transport.prepare!(request))
    const actual = await Effect.runPromise(requestFor(server.url))
    await expect(Effect.runPromise(send({ ...actual, body: new Uint8Array() }))).rejects.toThrow()
    const foreign = await Effect.runPromise(requestFor(server.url, { scope: "other" }))
    await expect(Effect.runPromise(send(foreign))).rejects.toThrow()
    expect(server.writes).toHaveLength(0)
    expect((await Effect.runPromise(send(actual)))._tag).toBe("Accepted")
    expect(server.writes[0]?.body).toBe("exact artifact bytes")
  } finally {
    await server.close()
  }
})

test("native observation stays bounded and does not follow redirects; exchange refuses insecure secrets", async () => {
  const server = await peer("redirect")
  try {
    let binding: unknown
    const read = makeHttpRead({
      credentials: (input) =>
        Effect.sync(() => {
          binding = input
          return {}
        }),
      timeoutMilliseconds: 1000,
      maximumResponseBytes: 100,
    })
    const response = await Effect.runPromise(
      read({ url: server.url, method: "GET", headers: [], principal: "reader", scope: "exact" }),
    )
    expect(response.status).toBe(307)
    expect(binding).toEqual({ endpoint: server.url, principal: "reader", scope: "exact" })
    expect(server.writes).toHaveLength(1)
    const exchange = makeCredentialExchange({ timeoutMilliseconds: 100, maximumResponseBytes: 100 })
    await expect(
      Effect.runPromise(
        exchange({ url: server.url, body: new Uint8Array(), headers: { authorization: "secret" } }),
      ),
    ).rejects.toThrow()
    expect(server.writes).toHaveLength(1)
  } finally {
    await server.close()
  }
})

test("Node and Bun retain complete raw headers and reject duplicate singleton evidence", async () => {
  for (const executable of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
    const child = Bun.spawn(
      [executable, fileURLToPath(new URL("./http-wire-consumer.mjs", import.meta.url))],
      { stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" })
    expect(JSON.parse(stdout).assertions).toBe(15)
  }
})

test("native TLS sends exact ephemeral credentials and rejects a certificate hostname mismatch on both hosts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ts-release-native-tls-")),
    key = join(directory, "key.pem"),
    cert = join(directory, "cert.pem")
  try {
    const generated = Bun.spawnSync(
      [
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=127.0.0.1",
        "-addext",
        "subjectAltName=IP:127.0.0.1",
      ],
      { stdout: "pipe", stderr: "pipe" },
    )
    expect(generated.exitCode).toBe(0)
    for (const executable of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
      const child = Bun.spawn(
        [executable, fileURLToPath(new URL("./http-tls-consumer.mjs", import.meta.url)), key, cert],
        { env: { ...process.env, NODE_EXTRA_CA_CERTS: cert }, stdout: "pipe", stderr: "pipe" },
      )
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect({ code, stderr }).toEqual({ code: 0, stderr: "" })
      expect(JSON.parse(stdout)).toMatchObject({ assertions: 12, writes: 3 })
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("interruption closes a pending native TLS socket before secureConnect on Node and Bun", async () => {
  for (const executable of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
    const child = Bun.spawn(
      [executable, fileURLToPath(new URL("./http-pending-tls-consumer.mjs", import.meta.url))],
      { stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" })
    expect(JSON.parse(stdout).assertions).toBe(3)
  }
})
