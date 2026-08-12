import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  formatNpmSha512Sri,
  formatSha256Hex,
  sha256Digest,
  sha512Digest
} from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { encodePreparedRelease, PreparedArtifact, PreparedNpmPublication, PreparedProject, PreparedReleaseV2, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { makeNpmPublicationAuthorityIntent } from "../../src/release/graph.js"
import { makeNpmDeprecationSubject, type NpmDeprecationProcess } from "../../src/correction/npm.js"
import { makeCorrectionIntent, type CorrectionIntent } from "../../src/correction/intent.js"
import { PublicationError, publishSubject } from "../../src/publication/observation.js"
import type { HttpResponse, PublicationHttp } from "../../src/publication/http.js"

const fixture = () => {
  const bytes = new TextEncoder().encode("prepared npm tarball")
  const artifactId = OutputId.make("npm-tarball")
  const publicationId = NonEmptyName.make("npm-release")
  const artifactDigest = sha256Digest(bytes)
  const artifact = PreparedArtifact.make({ id: artifactId, path: SafeRelativePath.make("dist/fixture.tgz"), kind: "package", size: bytes.length, digest: artifactDigest, blob: artifactDigest })
  const publication = PreparedNpmPublication.make({ id: publicationId, packageName: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), registryUrl: "https://registry.example.test/", artifactId, authority: makeNpmPublicationAuthorityIntent({ packageName: "fixture", version: "1.0.0", registryUrl: "https://registry.example.test/" }) })
  const manifest = PreparedReleaseV2.make({ schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true, packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: sha256Digest(new TextEncoder().encode("package manifest")) }),
    project: PreparedProject.make({ name: NonEmptyName.make("fixture"), packageName: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }), artifacts: [artifact], publications: [publication] })
  const preparedDigest = sha256Digest(encodePreparedRelease(manifest))
  const tarballIntegrity = sha512Digest(bytes)
  const correction = makeCorrectionIntent({ schemaVersion: "correction-intent/v2", preparedDigest, correction: {
    _tag: "NpmDeprecationCorrection", provider: "npm", publicationId, registryUrl: publication.registryUrl,
    packageName: publication.packageName, version: publication.version, tarballIntegrity, message: "Use fixture 1.0.1 instead."
  } })
  const bundle: PreparedBundle = { directory: `/tmp/prepared/${formatSha256Hex(preparedDigest)}`, manifest, blobs: new Map([[artifactId.toString(), bytes]]) }
  return { bundle, publication, correction, bytes, tarballIntegrity: formatNpmSha512Sri(tarballIntegrity) }
}

const response = (body: unknown, status = 200): HttpResponse => ({ status, headers: {}, body: JSON.stringify(body) })

describe("npm provider correction", () => {
  test("sets an exact deprecation and converges after reobservation", async () => {
    const { bundle, correction, tarballIntegrity } = fixture()
    let deprecated: string | undefined
    let mutations = 0
    const http: PublicationHttp = { request: () => Effect.sync(() => response({ dist: { integrity: tarballIntegrity }, ...(deprecated === undefined ? {} : { deprecated }) })) }
    const process: NpmDeprecationProcess = { deprecate: (request) => Effect.sync(() => { mutations++; expect(request.message).toBe("Use fixture 1.0.1 instead."); expect(request.credential).toBe("publish-token"); deprecated = request.message; return { started: true, exitCode: 0 } }) }
    const result = await Effect.runPromise(publishSubject(makeNpmDeprecationSubject(bundle, correction.correction as Extract<CorrectionIntent["correction"], { _tag: "NpmDeprecationCorrection" }>, http, { read: "read-token", publish: "publish-token" }, process)))
    expect(result._tag).toBe("PublicationConverged")
    expect(mutations).toBe(1)
  })

  test("different existing deprecation and absent target never mutate", async () => {
    const { bundle, correction, tarballIntegrity } = fixture()
    for (const [status, body] of [[200, { dist: { integrity: tarballIntegrity }, deprecated: "Different correction." }], [404, {}]] as const) {
      let mutations = 0
      const http: PublicationHttp = { request: () => Effect.succeed(response(body, status)) }
      const process: NpmDeprecationProcess = { deprecate: () => Effect.sync(() => { mutations++; return { started: true, exitCode: 0 } }) }
      const subject = makeNpmDeprecationSubject(bundle, correction.correction as Extract<CorrectionIntent["correction"], { _tag: "NpmDeprecationCorrection" }>, http, { read: "read", publish: "publish" }, process)
      const result = await Effect.runPromise(publishSubject(subject))
      expect(result._tag).toBe("PublicationBlocked")
      expect(mutations).toBe(0)
    }
  })

  test("malformed npm integrity wire data is inconclusive and never mutates", async () => {
    const { bundle, correction } = fixture()
    let mutations = 0
    const http: PublicationHttp = {
      request: () => Effect.succeed(response({ dist: { integrity: "sha512-not-canonical" } }))
    }
    const process: NpmDeprecationProcess = {
      deprecate: () => Effect.sync(() => {
        mutations += 1
        return { started: true, exitCode: 0 }
      })
    }
    const result = await Effect.runPromise(publishSubject(makeNpmDeprecationSubject(
      bundle,
      correction.correction as Extract<CorrectionIntent["correction"], { _tag: "NpmDeprecationCorrection" }>,
      http,
      { read: "read", publish: "publish" },
      process
    )))
    expect(result._tag).toBe("PublicationBlocked")
    expect(mutations).toBe(0)
  })

  test("a lost process response is decided only by exact reobservation", async () => {
    const { bundle, correction, tarballIntegrity } = fixture()
    let deprecated: string | undefined
    const http: PublicationHttp = { request: () => Effect.sync(() => response({ dist: { integrity: tarballIntegrity }, ...(deprecated === undefined ? {} : { deprecated }) })) }
    const process: NpmDeprecationProcess = { deprecate: (request) => Effect.fail(new PublicationError({ phase: "mutate", commitment: "unknown", reason: (deprecated = request.message, "response lost") })) }
    const result = await Effect.runPromise(publishSubject(makeNpmDeprecationSubject(bundle, correction.correction as Extract<CorrectionIntent["correction"], { _tag: "NpmDeprecationCorrection" }>, http, { read: "read", publish: "publish" }, process)))
    expect(result._tag).toBe("PublicationConverged")
    expect(result._tag === "PublicationConverged" ? result.mutation._tag : "").toBe("OutcomeUnknown")
  })
})
