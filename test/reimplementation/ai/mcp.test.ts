import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import type { HttpResponse, TrustedPublisherHost } from "@mannyc1/ts-release/http"
import {
  Icon,
  Manifest,
  McpbPackage,
  NamedArgument,
  NamedInput,
  NpmPackage,
  NugetPackage,
  OciPackage,
  OidcAuthorization,
  PublishIntent,
  PyPiPackage,
  RemoteHttp,
  RemoteSse,
  Repository,
  Sse,
  Stdio,
  StreamableHttp,
  TokenAuthorization,
  authorizeOidc,
  authorizeToken,
  definitions,
  publish,
  render,
  schemaUrl,
  validate,
} from "../../../packages/mcp/src/index.js"

const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
const tokenAuthorization = () =>
  new TokenAuthorization({
    principal: "mcp-publisher",
    namespace: "io.github.acme",
  })
const oidcAuthorization = () =>
  new OidcAuthorization({
    principal: "mcp-publisher",
    issuer: "https://token.actions.githubusercontent.com",
    audience: "https://registry.modelcontextprotocol.io",
    repository: "acme/release-server",
    workflow: ".github/workflows/release.yml",
    workflowRef: "refs/heads/main",
  })
const manifestInput = () =>
  new Manifest({
    $schema: schemaUrl,
    name: "io.github.acme/release-server",
    description: "Release evidence over the Model Context Protocol.",
    title: "Release server",
    version: "1.2.3",
    repository: new Repository({
      url: "https://github.com/acme/release-server",
      source: "github",
      id: "acme/release-server",
      subfolder: "packages/server",
    }),
    websiteUrl: "https://example.test/release-server",
    icons: [
      new Icon({
        src: "https://example.test/icon.png",
        mimeType: "image/png",
        sizes: ["128x128"],
        theme: "light",
      }),
    ],
    packages: [
      new NpmPackage({
        registryType: "npm",
        registryBaseUrl: "https://registry.npmjs.org",
        identifier: "@acme/release-server",
        version: "1.2.3",
        runtimeHint: "node",
        transport: new Stdio({ type: "stdio" }),
        runtimeArguments: [
          new NamedArgument({
            type: "named",
            name: "--enable-source-maps",
            value: "true",
          }),
        ],
      }),
      new PyPiPackage({
        registryType: "pypi",
        registryBaseUrl: "https://pypi.org",
        identifier: "release-server",
        version: "1.2.3",
        transport: new Stdio({ type: "stdio" }),
      }),
      new OciPackage({
        registryType: "oci",
        identifier: "ghcr.io/acme/release-server:1.2.3",
        transport: new StreamableHttp({
          type: "streamable-http",
          url: "https://localhost.test/mcp",
          headers: [
            new NamedInput({
              name: "X-Tenant",
              value: "public-fixture",
            }),
          ],
        }),
      }),
      new NugetPackage({
        registryType: "nuget",
        registryBaseUrl: "https://api.nuget.org/v3/index.json",
        identifier: "Acme.Release.Server",
        version: "1.2.3",
        transport: new Sse({ type: "sse", url: "https://localhost.test/events" }),
      }),
      new McpbPackage({
        registryType: "mcpb",
        identifier:
          "https://github.com/acme/release-server/releases/download/v1.2.3/release-server.mcpb",
        version: "1.2.3",
        fileSha256: "a".repeat(64),
        transport: new Stdio({ type: "stdio" }),
      }),
    ],
    remotes: [
      new RemoteHttp({ type: "streamable-http", url: "https://example.test/mcp" }),
      new RemoteSse({ type: "sse", url: "https://example.test/events" }),
    ],
    _meta: {
      "io.modelcontextprotocol.registry/publisher-provided": { channel: "stable" },
    },
  })
const makeIntent = (
  authorization: TokenAuthorization | OidcAuthorization = tokenAuthorization(),
) =>
  new PublishIntent({
    registry: "https://registry.modelcontextprotocol.io",
    manifest: manifestInput(),
    authorization,
  })
const response = (server: Manifest, status: "active" | "deprecated" | "deleted" = "active") =>
  ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: json({
      server: Schema.encodeSync(Manifest)(server),
      _meta: {
        "io.modelcontextprotocol.registry/official": {
          status,
          statusChangedAt: "2026-09-07T00:00:00Z",
          publishedAt: "2026-09-07T00:00:00Z",
          isLatest: true,
        },
      },
    }),
  }) satisfies HttpResponse

describe("MCP official manifest", () => {
  test("admits all five package kinds and all three transports deterministically", async () => {
    const selected = await Effect.runPromise(validate(manifestInput()))
    expect(selected.packages?.map((entry) => entry.registryType)).toEqual([
      "npm",
      "pypi",
      "oci",
      "nuget",
      "mcpb",
    ])
    expect([
      ...new Set([
        ...selected.packages!.map((entry) => entry.transport.type),
        ...selected.remotes!.map((entry) => entry.type),
      ]),
    ]).toEqual(["stdio", "streamable-http", "sse"])
    const first = await Effect.runPromise(render(selected))
    const second = await Effect.runPromise(validate(new TextDecoder().decode(first)).pipe(Effect.flatMap(render)))
    expect(second).toEqual(first)
    expect(new TextDecoder().decode(first).endsWith("\n")).toBe(true)
  })

  test("rejects mutable coordinates, unsupported transports, secrets, and duplicate JSON keys", async () => {
    const latest = Schema.encodeSync(Manifest)(manifestInput()) as any
    latest.packages[2].identifier = "ghcr.io/acme/release-server:latest"
    await expect(Effect.runPromise(validate(latest))).rejects.toThrow()
    const websocket = structuredClone(Schema.encodeSync(Manifest)(manifestInput())) as any
    websocket.packages[0].transport = { type: "websocket", url: "wss://example.test" }
    await expect(Effect.runPromise(validate(websocket))).rejects.toThrow()
    const embedded = structuredClone(Schema.encodeSync(Manifest)(manifestInput())) as any
    embedded.packages[0].environmentVariables = [
      { name: "TOKEN", isSecret: true, value: "github_pat_abcdefghijklmnopqrstuvwxyz" },
    ]
    await expect(Effect.runPromise(validate(embedded))).rejects.toThrow()
    await expect(
      Effect.runPromise(
        validate(
          '{"$schema":"' +
            schemaUrl +
            '","name":"io.github.acme/a","name":"io.github.acme/b"}',
        ),
      ),
    ).rejects.toThrow()
  })
})

describe("MCP native publication and recovery", () => {
  test("owns one exact POST, accepts exact active facts, and observes without replay", async () => {
    let observed: HttpResponse = response(manifestInput())
    const definition = definitions({ read: () => Effect.succeed(observed) })[0]!
    const operation = await Effect.runPromise(publish(makeIntent()))
    const context = { own: { operation, receipts: [], observations: [] }, dependencies: [] }
    const prepared = await Effect.runPromise(definition.prepare(operation, context))
    expect(prepared.facts).toMatchObject({
      endpoint: "https://registry.modelcontextprotocol.io/v0.1/publish",
      method: "POST",
      principal: "mcp-publisher",
      replay: { _tag: "None" },
    })
    expect(definition.ownsRequest(prepared)).toBe(true)
    expect(
      definition.ownsRequest({
        facts: { ...prepared.facts, bodyDigest: "0".repeat(64) },
        body: prepared.body,
      }),
    ).toBe(false)
    const accepted = await Effect.runPromise(definition.decodeResponse(prepared, observed))
    expect(accepted._tag).toBe("Accepted")
    const exact = await Effect.runPromise(definition.observe!(operation, context))
    expect(exact.status).toBe("Satisfied")

    const changed = manifestInput()
    observed = response(new Manifest({ ...changed, description: "Different immutable facts." }))
    expect((await Effect.runPromise(definition.observe!(operation, context))).status).toBe("Conflict")
    observed = { status: 404, headers: {}, body: json({ error: "not found" }) }
    expect((await Effect.runPromise(definition.observe!(operation, context))).status).toBe("Pending")
    observed = { status: 503, headers: {}, body: json({ error: "unavailable" }) }
    expect((await Effect.runPromise(definition.observe!(operation, context))).status).toBe(
      "Inconclusive",
    )
    expect(prepared.facts.replay._tag).toBe("None")
  })

  test("binds token and OIDC credentials to the exact registry operation", async () => {
    const definition = definitions({ read: () => Effect.succeed(response(manifestInput())) })[0]!
    const tokenOperation = await Effect.runPromise(publish(makeIntent()))
    const context = { own: { operation: tokenOperation, receipts: [], observations: [] }, dependencies: [] }
    const tokenRequest = await Effect.runPromise(definition.prepare(tokenOperation, context))
    expect(
      await Effect.runPromise(
        authorizeToken({
          authorization: tokenAuthorization(),
          binding: {
            endpoint: tokenRequest.facts.endpoint,
            principal: tokenRequest.facts.principal,
            scope: tokenRequest.facts.scope,
          },
          token: Redacted.make("registry-token"),
        }),
      ),
    ).toEqual({ authorization: "Bearer registry-token" })

    const authorization = oidcAuthorization(), operation = await Effect.runPromise(publish(makeIntent(authorization)))
    const request = await Effect.runPromise(
      definition.prepare(operation, { own: { operation, receipts: [], observations: [] }, dependencies: [] }),
    )
    let oidcAudience = "", exchangeUrl = "", exchangeBody = ""
    const host: TrustedPublisherHost = {
      oidc: (input) => {
        oidcAudience = input.audience
        expect(input.repository).toBe("acme/release-server")
        return Effect.succeed(Redacted.make("header.payload.signature"))
      },
      exchange: (input) => {
        exchangeUrl = input.url
        exchangeBody = new TextDecoder().decode(input.body)
        return Effect.succeed({
          status: 200,
          headers: {},
          body: json({
            registry_token: "exchanged-registry-token",
            expires_at: Math.floor(Date.now() / 1000) + 300,
          }),
        })
      },
    }
    const headers = await Effect.runPromise(
      authorizeOidc(
        {
          authorization,
          binding: {
            endpoint: request.facts.endpoint,
            principal: request.facts.principal,
            scope: request.facts.scope,
          },
        },
        host,
      ),
    )
    expect(oidcAudience).toBe("https://registry.modelcontextprotocol.io")
    expect(exchangeUrl).toBe("https://registry.modelcontextprotocol.io/v0.1/auth/github-oidc")
    expect(exchangeBody).toContain("header.payload.signature")
    expect(headers).toEqual({ authorization: "Bearer exchanged-registry-token" })
  })
})
