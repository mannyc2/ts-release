import assert from "node:assert/strict"
import { createServer } from "node:https"
import { readFileSync } from "node:fs"
import { once } from "node:events"
import { Effect, Schema } from "effect"
import { makeRequest, NoReplay, PROVIDER_CONTRACT } from "@mannyc1/ts-release"
import { makeCredentialResolver, HttpReceipt } from "@mannyc1/ts-release/http"
import { makeHttpTransport, makeHttpRead, makeCredentialExchange } from "@mannyc1/ts-release/node"

const writes = []
const server = createServer(
  { key: readFileSync(process.argv[2]), cert: readFileSync(process.argv[3]) },
  async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    writes.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
      body: Buffer.concat(chunks).toString(),
    })
    if (request.url === "/redirect") response.writeHead(307, { location: "/other" }).end()
    else
      response
        .writeHead(request.url === "/artifact" ? 201 : 200, { "content-type": "application/json" })
        .end('{"value":"fixture-ephemeral"}')
  },
)
server.listen(0, "127.0.0.1")
await once(server, "listening")
let assertions = 0
try {
  const origin = `https://127.0.0.1:${server.address().port}`
  const request = await Effect.runPromise(
    makeRequest({
      transport: "core.http/1",
      endpoint: `${origin}/artifact`,
      method: "PUT",
      headers: [["content-type", "application/octet-stream"]],
      body: new TextEncoder().encode("immutable-native-body"),
      principal: "native-publisher",
      scope: "artifact@1.0.0",
      replay: new NoReplay({}),
    }),
  )
  const binding = {
    endpoint: request.facts.endpoint,
    principal: request.facts.principal,
    scope: request.facts.scope,
  }
  let acquisitions = 0
  const credentials = makeCredentialResolver([
    {
      binding,
      acquire: () =>
        Effect.sync(() => {
          acquisitions++
          return { authorization: "Bearer fixture-private" }
        }),
    },
  ])
  const provider = {
    contract: PROVIDER_CONTRACT,
    definitionId: "fixture.tls",
    intentVersion: "1",
    intentCodec: Schema.Unknown,
    receiptVersion: "fixture.tls/1",
    receiptCodec: HttpReceipt,
    receiptCorresponds: () => true,
    classifyReceipt: () => "Satisfied",
    prepare: () => Effect.succeed(request),
    ownsRequest: (input) =>
      input.facts.endpoint === request.facts.endpoint &&
      input.facts.bodyDigest === request.facts.bodyDigest &&
      input.facts.principal === binding.principal &&
      input.facts.scope === binding.scope,
    decodeResponse: (input, response) =>
      Effect.succeed({
        _tag: "Accepted",
        receipt: {
          status: response.status,
          body: "",
          endpoint: input.facts.endpoint,
          method: input.facts.method,
          bodyDigest: input.facts.bodyDigest,
        },
      }),
  }
  const options = { timeoutMilliseconds: 1000, maximumResponseBytes: 1024 }
  const transport = makeHttpTransport({ ...options, credentials, providers: [provider] })
  const send = await Effect.runPromise(transport.prepare(request))
  assert.equal(writes.length, 0)
  assert.equal(acquisitions, 1)
  const result = await Effect.runPromise(send(request))
  assert.equal(result.receipt.status, 201)
  assert.deepEqual(writes, [
    {
      method: "PUT",
      path: "/artifact",
      authorization: "Bearer fixture-private",
      body: "immutable-native-body",
    },
  ])
  assert.equal(JSON.stringify(request).includes("fixture-private"), false)
  assertions += 5
  const read = makeHttpRead({
    ...options,
    credentials: () => Effect.succeed({ authorization: "Bearer fixture-read" }),
  })
  const response = await Effect.runPromise(
    read({
      url: `${origin}/redirect`,
      method: "GET",
      headers: [],
      principal: "reader",
      scope: "read",
    }),
  )
  assert.equal(response.status, 307)
  assert.equal(writes.length, 2)
  assert.equal(writes[1].authorization, "Bearer fixture-read")
  const exchange = makeCredentialExchange(options)
  const credential = await Effect.runPromise(
    exchange({
      url: `${origin}/exchange`,
      headers: { authorization: "Bearer fixture-oidc", "content-type": "application/json" },
      body: new TextEncoder().encode('{"token":"fixture-jwt"}'),
    }),
  )
  assert.equal(credential.status, 200)
  assert.deepEqual(writes[2], {
    method: "POST",
    path: "/exchange",
    authorization: "Bearer fixture-oidc",
    body: '{"token":"fixture-jwt"}',
  })
  assertions += 5
  // The disposable certificate has only an IP SAN. Hostname mismatch must fail
  // despite NODE_EXTRA_CA_CERTS trusting its issuing key.
  await assert.rejects(
    Effect.runPromise(
      read({
        url: origin.replace("127.0.0.1", "localhost") + "/wrong-host",
        method: "GET",
        headers: [],
        principal: "reader",
        scope: "read",
      }),
    ),
  )
  assert.equal(writes.length, 3)
  assertions += 2
} finally {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
console.log(
  JSON.stringify({
    runtime: process.version,
    bun: process.versions.bun ?? null,
    assertions,
    writes: writes.length,
  }),
)
