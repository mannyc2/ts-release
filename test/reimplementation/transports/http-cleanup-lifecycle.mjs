import assert from "node:assert/strict"
import net from "node:net"
import { createRequire } from "node:module"
import { Cause, Effect, Exit, Fiber } from "effect"

// Real loopback TCP, Undici dispatch and both native shutdown operations. Only
// completion delivery is instrumented: this is not a native failed-close claim.
const require = createRequire(import.meta.url)
const nativeConnect = net.connect
const Client = require("undici/lib/dispatcher/client.js")
const ownDestroy = Object.getOwnPropertyDescriptor(Client.prototype, "destroy")
const nativeDestroy = Client.prototype.destroy
const socketClosed = Promise.withResolvers()
const releaseClose = Promise.withResolvers()
const clientClosed = Promise.withResolvers()
const injected = new Error("synthetic private cleanup completion failure")
const sockets = new Set()
/** @type {Promise<void> | undefined} */
let closeDelivery
let clientDelivery
let fiber
let completed
let pendingBeforeRelease = false
let nativeClientClosed = false
let causesPreserved = false
let nativeSocketClosed = false
const server = net.createServer((socket) => {
  sockets.add(socket)
  socket.once("close", () => sockets.delete(socket))
  socket.once("data", () => {
    // A genuine truncated HTTP response produces the independent body failure.
    socket.end("HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\nx")
  })
})
try {
  net.connect = (...args) => {
    const socket = Reflect.apply(nativeConnect, net, args)
    // Native connect has installed its listeners; the connector then installs
    // connect/error listeners. The next once(close) is HttpTransport's signal.
    const once = socket.once
    socket.once = function (event, listener) {
      if (event !== "close") return Reflect.apply(once, this, [event, listener])
      this.once = once
      return Reflect.apply(once, this, [
        event,
        (...values) => {
          nativeSocketClosed = true
          socketClosed.resolve()
          closeDelivery = releaseClose.promise.then(() => Reflect.apply(listener, socket, values))
        },
      ])
    }
    return socket
  }
  Client.prototype.destroy = function (...args) {
    // Undici's Promise overload recursively calls the callback overload. Preserve
    // that internal call; instrument only the owner's zero-argument shutdown.
    if (args.length) return Reflect.apply(nativeDestroy, this, args)
    clientDelivery = Reflect.apply(nativeDestroy, this, args).then(() => {
      nativeClientClosed = true
      clientClosed.resolve()
      throw injected
    })
    return clientDelivery
  }
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const { makeHttpRead } = await import("@mannyc1/ts-release/node")
  const read = makeHttpRead({
    credentials: () => Effect.succeed({}),
    timeoutMilliseconds: 5000,
    maximumResponseBytes: 1024,
  })
  fiber = Effect.runFork(
    read({
      method: "GET",
      url: `http://127.0.0.1:${server.address().port}/truncated`,
      principal: "fixture",
      scope: "fixture",
      headers: [],
    }),
  )
  const finished = Promise.withResolvers()
  fiber.addObserver((exit) => {
    completed = exit
    finished.resolve()
  })
  await Promise.race([
    Promise.all([socketClosed.promise, clientClosed.promise]),
    finished.promise.then(() => {
      throw new Error("HTTP owner exited before both real shutdown barriers")
    }),
  ])
  // Drain the actual rejected completion and Effect continuation, not a sleep.
  await clientDelivery.catch(() => undefined)
  fiber.currentDispatcher.flush()
  pendingBeforeRelease = completed === undefined
  assert(pendingBeforeRelease, "HTTP owner exited before socket-close delivery")
  releaseClose.resolve()
  const exit = await Effect.runPromise(Fiber.await(fiber))
  assert(Exit.isFailure(exit), "Truncated response must fail")
  assert.equal(Cause.hasDies(exit.cause), false)
  const codes = exit.cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error.code)
  assert.deepEqual(codes.toSorted(), ["http-cleanup", "http-outcome-unknown"])
  assert.equal(Cause.pretty(exit.cause).includes(injected.message), false)
  assert.equal(JSON.stringify(exit).includes(injected.message), false)
  causesPreserved = true
} finally {
  releaseClose.resolve()
  if (closeDelivery) await closeDelivery
  if (clientDelivery) await clientDelivery.catch(() => undefined)
  if (fiber) await Effect.runPromise(Fiber.interrupt(fiber))
  net.connect = nativeConnect
  if (ownDestroy) Object.defineProperty(Client.prototype, "destroy", ownDestroy)
  else delete Client.prototype.destroy
  for (const socket of sockets) socket.destroy()
  await new Promise((resolve) => server.close(resolve))
  console.log(
    JSON.stringify({
      runtime: process.version,
      pendingBeforeRelease,
      nativeClientClosed,
      nativeSocketClosed,
      causesPreserved,
    }),
  )
}
