import assert from "node:assert/strict"
import { fork } from "node:child_process"
import { fileURLToPath } from "node:url"
import { once } from "node:events"
import { Effect } from "effect"
import { makeHttpRead } from "@mannyc1/ts-release/node"

const peer = fork(fileURLToPath(new URL("./http-pending-tls-peer.mjs", import.meta.url)), [], {
  execPath: process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node",
  silent: true,
})
const events = [],
  waiters = new Map()
peer.on("message", (message) => {
  events.push(message)
  waiters.get(message.event)?.(message)
})
const waitFor = (event) =>
  new Promise((resolve, reject) => {
    const existing = events.find((message) => message.event === event)
    if (existing) {
      resolve(existing)
      return
    }
    const timeout = setTimeout(() => reject(new Error(`Missing native peer event: ${event}`)), 2000)
    waiters.set(event, (message) => {
      clearTimeout(timeout)
      resolve(message)
    })
  })
try {
  const { port } = await waitFor("ready")
  const read = makeHttpRead({
    timeoutMilliseconds: 5000,
    maximumResponseBytes: 100,
    credentials: () => Effect.succeed({}),
  })
  const controller = new AbortController()
  const result = Effect.runPromise(
    read({
      url: `https://127.0.0.1:${port}/`,
      method: "GET",
      headers: [],
      principal: "native-handshake",
      scope: "read",
    }),
    { signal: controller.signal },
  ).then(
    () => "resolved",
    () => "interrupted",
  )
  await waitFor("handshake")
  controller.abort()
  assert.equal(await result, "interrupted")
  assert.equal((await waitFor("closed")).count, 0)
  assert.equal(events.filter((event) => event.event === "handshake").length, 1)
  console.log(
    JSON.stringify({ runtime: process.version, bun: process.versions.bun ?? null, assertions: 3 }),
  )
} finally {
  peer.kill()
  await once(peer, "exit")
}
