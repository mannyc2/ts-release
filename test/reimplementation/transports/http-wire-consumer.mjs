import assert from "node:assert/strict"
import { createServer } from "node:net"
import { once } from "node:events"
import { Effect } from "effect"
import { makeHttpRead } from "@mannyc1/ts-release/node"

let assertions = 0
for (const scenario of [
  "duplicate",
  "late-duplicate",
  "many",
  "oversized",
  "padding",
  "chunk-extension",
  "trailer-padding",
]) {
  let requests = 0
  const extra =
    scenario === "duplicate" ? "" : "X: a\r\n".repeat(scenario === "oversized" ? 3000 : 2100)
  const ambiguous = scenario.endsWith("duplicate") ? "Content-Type: text/html\r\n" : ""
  const server = createServer((socket) => {
    socket.on("error", () => {})
    socket.once("data", () => {
      requests++
      const padding = " ".repeat(70_000)
      const raw =
        scenario === "padding"
          ? `HTTP/1.1 200 OK\r\nX: ${padding}a\r\nContent-Length: 2\r\n\r\n{}`
          : scenario === "chunk-extension"
            ? `HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n1;x=${"a".repeat(70_000)}\r\na\r\n0\r\n\r\n`
            : scenario === "trailer-padding"
              ? `HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n1\r\na\r\n0\r\nX: ${padding}a\r\n\r\n`
              : `HTTP/1.1 200 OK\r\nContent-Length: 2\r\n${extra}Content-Type: application/vnd.pypi.simple.v1+json\r\n${ambiguous}X-Final: retained\r\nConnection: close\r\n\r\n{}`
      socket.end(raw)
    })
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  try {
    const read = makeHttpRead({
      credentials: () => Effect.succeed({}),
      timeoutMilliseconds: 1000,
      maximumResponseBytes: 100,
    })
    const result = await Effect.runPromise(
      read({
        url: `http://127.0.0.1:${server.address().port}/`,
        method: "GET",
        headers: [],
        principal: "native-wire",
        scope: "read",
      }),
    ).then(
      (response) => ({ response }),
      (error) => ({ error }),
    )
    if (scenario === "many") {
      assert.equal(result.response?.headers["x-final"], "retained")
      assert.equal(result.response.headers.x.split(", ").length, 2100)
      assertions += 2
    } else {
      assert.match(
        String(result.error),
        /Native HTTP response was not completely observed/u,
        scenario,
      )
      assertions++
    }
    assert.equal(requests, 1)
    assertions++
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}
console.log(
  JSON.stringify({
    runtime: process.version,
    bun: process.versions.bun ?? null,
    assertions,
    scenarios: 7,
  }),
)
