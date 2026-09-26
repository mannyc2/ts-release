import { expect, test } from "bun:test"
import { Effect, Redacted } from "effect"
import { createPlan } from "@mannyc1/ts-release"
import { Bundle } from "@mannyc1/ts-release/bundle"
import * as Npm from "@mannyc1/ts-release-npm"
import { npmCredentials } from "../../../apps/self-release/src/application.js"
import { accessFor, artifact, pack, structuralBundle } from "../npm/fixtures.js"
import { checkCredentials, failureCode } from "../../../templates/npm-github/check-credentials.mjs"

for (const status of [201, 401])
  test(`credential preflight diagnoses ${status} without publication or secret output`, async () => {
    const fixture = accessFor(pack({ name: "@fixture/example", version: "1.2.3" }))
    const authorization = new Npm.TrustedAuthorization({
      principal: "npm-publisher",
      repository: "fixture/example",
      workflow: ".github/workflows/release.yml",
      workflowRef: "refs/heads/main",
      issuer: "https://token.actions.githubusercontent.com",
      audience: "npm:registry.npmjs.org",
    })
    const source = new Npm.ProvenanceSource({
      format: "npm-github-actions-provenance-source/v1",
      serverUrl: "https://github.com",
      repository: "fixture/example",
      workflow: authorization.workflow,
      workflowRef: authorization.workflowRef,
      sourceRef: "refs/heads/main",
      sourceCommit: "a".repeat(40),
      eventName: "workflow_dispatch",
      repositoryId: "1",
      repositoryOwnerId: "2",
      runnerEnvironment: "github-hosted",
      runId: "3",
      runAttempt: "1",
      repositoryVisibility: "public",
    })
    // The explicit Attest fixture supplies structure only, never native trust.
    const provenance = await Effect.runPromise(
      Npm.createProvenance(
        {
          authorize: true,
          name: fixture.publication.name,
          version: fixture.publication.version,
          tarball: fixture.publication.tarball,
          source,
        },
        {
          ...fixture.access,
          attest: ({ payload }) => Effect.succeed({ bundleBytes: structuralBundle(payload) }),
        },
      ),
    )
    const provenanceFile = artifact("structural-credential-fixture", provenance.bytes)
    const intent = new Npm.PublishIntent({
      ...fixture.publication,
      authorization,
      provenance: new Npm.GitHubActionsProvenance({
        source,
        bundle: provenanceFile,
        mediaType: provenance.mediaType,
      }),
    })
    const operation = await Effect.runPromise(Npm.publish(intent))
    const plan = await Effect.runPromise(
      createPlan("a".repeat(64), [operation], "credential-preflight"),
    )
    let reads = 0,
      writes = 0,
      exchanges = 0
    const forbidden = () =>
      Effect.sync(() => {
        writes++
        throw new Error("Preflight must not publish or append history")
      })
    const app = {
      options: { plan, authorize: true },
      host: {
        providers: Npm.definitions({
          bundle: new Bundle({
            format: "ts-release/bundle/2",
            artifacts: [intent.tarball, provenanceFile],
          }),
          readContent: (content) =>
            content.sha256 === provenanceFile.content.sha256
              ? Effect.succeed(provenance.bytes.slice())
              : fixture.access.readContent(content),
          read: () => Effect.die(new Error("Preflight must not read the registry")),
          // This deliberate port permits structural/credential-policy coverage;
          // the actual native Sigstore profile owns cryptographic trust proof.
          verifyProvenance: () => Effect.void,
        }),
        store: {
          read: () =>
            Effect.sync(() => {
              reads++
              return { revision: 1, events: [] }
            }),
          append: forbidden,
        },
        transport: { prepare: forbidden, send: forbidden },
      },
    }
    const events = []
    const identity = "sensitive-identity-token",
      credential = "sensitive-registry-token"
    const result = await Effect.runPromise(
      Effect.exit(
        checkCredentials({
          app,
          npmCredentials,
          authentication: { mode: "Trusted", githubTokenEnvironment: "GH_TOKEN" },
          emit: (event) => events.push(event),
          trusted: {
            oidc: (request) =>
              Effect.sync(() => {
                expect(request.repository).toBe("fixture/example")
                expect(request.audience).toBe("npm:registry.npmjs.org")
                return Redacted.make(identity)
              }),
            exchange: (request) =>
              Effect.sync(() => {
                exchanges++
                expect(request.headers.authorization).toBe(`Bearer ${identity}`)
                return {
                  status,
                  headers: {},
                  body: new TextEncoder().encode(
                    JSON.stringify({
                      token_type: "oidc",
                      token: credential,
                      ...(status === 401 ? { message: identity, unknown: credential } : {}),
                    }),
                  ),
                }
              }),
          },
        }),
      ),
    )
    expect(result._tag).toBe(status === 201 ? "Success" : "Failure")
    expect(reads).toBe(1)
    expect(exchanges).toBe(1)
    expect(writes).toBe(0)
    expect(events.find((event) => event.stage === "npm-exchange")).toMatchObject({
      status,
      tokenTypeMatches: true,
      tokenPresent: true,
      createdType: "undefined",
      expiresType: "undefined",
      unexpectedFields: status === 401,
    })
    expect(events.some((event) => event.stage === "npm-credentials-ready")).toBe(status === 201)
    expect(JSON.stringify(events)).not.toContain(identity)
    expect(JSON.stringify(events)).not.toContain(credential)
  })

test("credential diagnostics never emit arbitrary failure codes or messages", () => {
  expect(failureCode({ code: "npm-oidc-exchange", message: "sensitive-credential" })).toBe(
    "npm-oidc-exchange",
  )
  expect(failureCode({ code: "sensitive-credential", message: "sensitive-credential" })).toBe(
    "unclassified",
  )
})
