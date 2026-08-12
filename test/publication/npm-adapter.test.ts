import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { createHash } from "node:crypto"
import { Digest, NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { PreparedArtifact, PreparedNpmPublication, PreparedProject, PreparedReleaseV1, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { makeNpmPublicationAuthorityIntent } from "../../src/release/graph.js"
import { PublicationError, publishSubject } from "../../src/publication/observation.js"
import { makeNpmSubject } from "../../src/publication/npm.js"
import type { HttpResponse, PublicationHttp } from "../../src/publication/http.js"

const fixture = (): { readonly bundle: PreparedBundle, readonly bytes: Uint8Array, readonly publication: PreparedNpmPublication } => {
  const bytes = new TextEncoder().encode("npm tarball bytes\n")
  const hash = createHash("sha256").update(bytes).digest("hex")
  const artifact = PreparedArtifact.make({ id: OutputId.make("npm-tarball"), path: SafeRelativePath.make("package.tgz"), kind: "archive",
    size: bytes.length, digest: Digest.make(hash), blob: Digest.make(hash), mediaType: "application/gzip" })
  const publication = PreparedNpmPublication.make({ id: NonEmptyName.make("npm-release"), packageName: NonEmptyName.make("@fixture/package"),
    version: Version.make("1.0.0"), registryUrl: "https://registry.example/", artifactId: artifact.id,
    authority: makeNpmPublicationAuthorityIntent({ packageName: "@fixture/package", version: "1.0.0", registryUrl: "https://registry.example/" }) })
  const manifest = PreparedReleaseV1.make({ schemaVersion: "prepared-release/v1",
    source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: Digest.make(hash) }),
    project: PreparedProject.make({ name: NonEmptyName.make("fixture"), packageName: publication.packageName, version: publication.version, tag: NonEmptyName.make("v1.0.0") }),
    artifacts: [artifact], publications: [publication] })
  return { bundle: { directory: "/tmp/prepared/npm", manifest, blobs: new Map([[artifact.id.toString(), bytes]]) }, bytes, publication }
}
const response = (status: number, body: unknown): HttpResponse => ({ status, headers: {}, body: JSON.stringify(body) })
const registryBody = (bytes: Uint8Array) => ({ dist: {
  integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  shasum: createHash("sha1").update(bytes).digest("hex")
} })

describe("npm publication adapter", () => {
  test("exact registry integrity is equivalent without mutation", async () => {
    const { bundle, bytes, publication } = fixture()
    let requests = 0
    let publishes = 0
    const http: PublicationHttp = { request: () => Effect.sync(() => { requests++; return response(200, registryBody(bytes)) }) }
    const subject = makeNpmSubject(bundle, publication, http, { read: "read-token", publish: "publish-token" }, { publish: () => Effect.sync(() => { publishes++; return { started: true, exitCode: 0 } }) })
    const result = await Effect.runPromise(publishSubject(subject))
    expect(result._tag).toBe("PublicationConverged")
    expect(requests).toBe(1)
    expect(publishes).toBe(0)
  })

  test("authoritative absence publishes the exact bytes and converges on re-observation", async () => {
    const { bundle, bytes, publication } = fixture()
    const observations = [response(404, {}), response(200, registryBody(bytes))]
    let requestIndex = 0
    let published: Uint8Array | undefined
    const http: PublicationHttp = { request: () => Effect.sync(() => observations[requestIndex++]!) }
    const subject = makeNpmSubject(bundle, publication, http, { read: "read-token", publish: "publish-token" }, { publish: (request) => Effect.sync(() => { published = request.bytes; return { started: true, exitCode: 0 } }) })
    const result = await Effect.runPromise(publishSubject(subject))
    expect(result._tag).toBe("PublicationConverged")
    expect(result._tag === "PublicationConverged" ? result.mutation._tag : "").toBe("Applied")
    expect(published).toEqual(bytes)
    expect(requestIndex).toBe(2)
  })

  test("authentication, throttling, and occupied content are never absence", async () => {
    const { bundle, bytes, publication } = fixture()
    for (const current of [response(401, {}), response(429, {}), response(200, { dist: { integrity: "sha512-different" } })]) {
      let publishes = 0
      const http: PublicationHttp = { request: () => Effect.succeed(current) }
      const subject = makeNpmSubject(bundle, publication, http, { read: "read-token", publish: "publish-token" }, { publish: () => Effect.sync(() => { publishes++; return { started: true, exitCode: 0 } }) })
      const result = await Effect.runPromise(publishSubject(subject))
      expect(result._tag).toBe(current.status === 200 ? "PublicationBlocked" : "PublicationBlocked")
      expect(publishes).toBe(0)
    }
    const failingHttp: PublicationHttp = { request: () => Effect.fail(PublicationError.make({ phase: "observe", commitment: "unknown", reason: "timeout" })) }
    const result = await Effect.runPromise(publishSubject(makeNpmSubject(bundle, publication, failingHttp, { read: "read-token", publish: "publish-token" }, { publish: () => Effect.succeed({ started: true, exitCode: 0 }) })))
    expect(result._tag).toBe("PublicationBlocked")
  })

  test("process-start failure, child rejection, and response loss remain distinct", async () => {
    const { bundle, bytes, publication } = fixture()
    for (const process of [
      () => Effect.fail(PublicationError.make({ phase: "mutate", commitment: "before-dispatch", reason: "spawn failed" })),
      () => Effect.succeed({ started: true, exitCode: 1 })
    ]) {
      const http: PublicationHttp = { request: () => Effect.succeed(response(404, {})) }
      const result = await Effect.runPromise(publishSubject(makeNpmSubject(bundle, publication, http, { read: "r", publish: "p" }, { publish: process })))
      expect(result._tag).toBe("PublicationObserved")
      expect(result._tag === "PublicationObserved" ? result.mutation._tag : "").toBe("Rejected")
    }
    const observations = [response(404, {}), response(200, registryBody(bytes))]
    let index = 0
    const http: PublicationHttp = { request: () => Effect.succeed(observations[index++]!) }
    const result = await Effect.runPromise(publishSubject(makeNpmSubject(bundle, publication, http, { read: "r", publish: "p" }, {
      publish: () => Effect.fail(PublicationError.make({ phase: "mutate", commitment: "unknown", reason: "response lost" }))
    })))
    expect(result._tag).toBe("PublicationConverged")
    expect(result._tag === "PublicationConverged" ? result.mutation._tag : "").toBe("OutcomeUnknown")
  })
})
