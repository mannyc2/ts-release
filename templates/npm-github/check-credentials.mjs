import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Schema } from "effect"
import { makeGithubTrustedPublisherHost } from "@mannyc1/ts-release/node"
import { PublishIntent } from "@mannyc1/ts-release-npm"

// Expose protocol stages and non-secret shape checks, never tokens or raw bodies.
export const diagnosticHost = (host, emit, now = Date.now) => ({
  oidc: Effect.fn("release.preflightOidc")(function* (request) {
    emit({ stage: "oidc-request", audience: request.audience })
    const token = yield* host.oidc(request)
    emit({ stage: "oidc-verified" })
    return token
  }),
  exchange: Effect.fn("release.preflightExchange")(function* (request) {
    const response = yield* host.exchange(request)
    let shape = { responseShape: "invalid-json" }
    try {
      const value = JSON.parse(new TextDecoder().decode(response.body))
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const created = Date.parse(value.created),
          expires = Date.parse(value.expires),
          time = now()
        shape = {
          responseShape: "object",
          tokenTypeMatches: value.token_type === "oidc",
          tokenPresent: typeof value.token === "string" && value.token.length > 0,
          createdType: typeof value.created,
          expiresType: typeof value.expires,
          unexpectedFields: Object.keys(value).some(
            (key) => !["token_type", "token", "created", "expires"].includes(key),
          ),
          createdAgeMilliseconds: Number.isFinite(created) ? time - created : null,
          expiresInMilliseconds: Number.isFinite(expires) ? expires - time : null,
        }
      }
    } catch {}
    emit({ stage: "npm-exchange", status: response.status, ...shape })
    return response
  }),
})

export const checkCredentials = Effect.fn("release.checkCredentials")(function* ({
  app,
  npmCredentials,
  authentication,
  trusted,
  emit,
}) {
  if (authentication.mode !== "Trusted") throw new Error("Trusted authentication is required")
  const snapshot = yield* app.host.store.read(app.options.plan.journalId)
  emit({ stage: "journal-readable", revision: snapshot.revision })
  const operations = app.options.plan.operations.filter(
    (operation) => operation.definitionId === "npm.publish",
  )
  if (operations.length === 0) throw new Error("A nonempty npm release is required")
  const publications = operations.map((operation) =>
    Schema.decodeUnknownSync(PublishIntent)(operation.intent),
  )
  for (const operation of operations) {
    const provider = app.host.providers.find(
      (provider) => provider.definitionId === operation.definitionId,
    )
    const emptyEvidence = (operation) => ({ operation, receipts: [], observations: [] })
    // npm request bytes are fixed by the retained intent; this supplies no dispatch authority.
    const request = yield* provider.prepare(operation, {
      own: emptyEvidence(operation),
      dependencies: operation.dependsOn.map((id) =>
        emptyEvidence(
          app.options.plan.operations.find((operation) => operation.operationId === id),
        ),
      ),
    })
    emit({ stage: "npm-request-prepared", package: operation.intent.name })
    const facts = request.facts
    yield* npmCredentials(
      {
        endpoint: new URL(facts.endpoint).href,
        principal: facts.principal,
        scope: facts.scope,
        method: facts.method,
        bodyDigest: facts.bodyDigest,
      },
      {
        publications,
        authentication,
        trusted: diagnosticHost(trusted, emit),
        local: null,
      },
    )
    emit({ stage: "npm-credentials-ready", package: operation.intent.name })
  }
  // No journal append, transport.send or returned send callback is invoked here.
})

const knownCodes = new Set([
  "github-oidc",
  "http-credentials",
  "npm-oidc-exchange",
  "npm-data",
  "npm-credential-lifetime",
  "npm-credential-token",
  "npm-credential-binding",
  "npm-credential-package",
  "npm-sigstore-verify",
  "npm-sigstore-source-identity",
  "invalid-data",
  "git-journal",
  "npm",
])
export const failureCode = (error) => (knownCodes.has(error?.code) ? error.code : "unclassified")

if (import.meta.main) {
  try {
    const [application, inputFile] = process.argv.slice(2)
    const input = JSON.parse(await readFile(inputFile, "utf8"))
    const loaded = await import(pathToFileURL(resolve(application)).href)
    const emit = (value) => process.stderr.write(`${JSON.stringify(value)}\n`)
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* loaded.createApplication(input)
          yield* checkCredentials({
            app,
            npmCredentials: loaded.npmCredentials,
            authentication: input.authentication,
            trusted: makeGithubTrustedPublisherHost({
              timeoutMilliseconds: 30000,
              maximumResponseBytes: 16 * 1024 * 1024,
            }),
            emit,
          })
        }),
      ),
    )
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ stage: "credential-preflight-failed", code: failureCode(error) })}\n`,
    )
    process.exitCode = 1
  }
}
