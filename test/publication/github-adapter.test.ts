import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { createHash } from "node:crypto"
import { Digest, NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { PreparedArtifact, PreparedGitHubAsset, PreparedGitHubPublication, PreparedProject, PreparedReleaseV1, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { makeGitHubPublicationAuthorityIntent } from "../../src/release/graph.js"
import { makeGithubSubjects } from "../../src/publication/github.js"
import { publishSubject } from "../../src/publication/observation.js"
import type { HttpResponse, PublicationHttp } from "../../src/publication/http.js"

const fixture = (): { readonly bundle: PreparedBundle, readonly bytes: Uint8Array, readonly publication: PreparedGitHubPublication } => {
  const bytes = new TextEncoder().encode("github asset bytes\n")
  const hash = createHash("sha256").update(bytes).digest("hex")
  const artifact = PreparedArtifact.make({ id: OutputId.make("asset"), path: SafeRelativePath.make("asset.zip"), kind: "archive",
    size: bytes.length, digest: Digest.make(hash), blob: Digest.make(hash), mediaType: "application/zip" })
  const publication = PreparedGitHubPublication.make({ id: NonEmptyName.make("github-release"), repository: "owner/project", tag: NonEmptyName.make("v1.0.0"),
    title: NonEmptyName.make("Project 1.0.0"), draft: false, prerelease: false, targetCommit: NonEmptyName.make("commit"), body: "notes",
    assets: [PreparedGitHubAsset.make({ artifactId: artifact.id, name: "asset.zip", mediaType: "application/zip" })],
    authority: makeGitHubPublicationAuthorityIntent({ repository: "owner/project", tag: "v1.0.0" }) })
  const manifest = PreparedReleaseV1.make({ schemaVersion: "prepared-release/v1",
    source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: Digest.make(hash) }),
    project: PreparedProject.make({ name: NonEmptyName.make("project"), version: Version.make("1.0.0"), tag: publication.tag }),
    artifacts: [artifact], publications: [publication] })
  return { bundle: { directory: "/tmp/prepared/github", manifest, blobs: new Map([[artifact.id.toString(), bytes]]) }, bytes, publication }
}
const releaseBody = (bytes: Uint8Array, includeAsset = true, digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`) => ({
  id: 7, upload_url: "https://uploads.github.example/repos/owner/project/releases/7/assets{?name,label}", tag_name: "v1.0.0", target_commitish: "commit",
  name: "Project 1.0.0", body: "notes", draft: false, prerelease: false,
  assets: includeAsset ? [{ name: "asset.zip", size: bytes.length, content_type: "application/zip", digest }] : []
})
const response = (status: number, body: unknown): HttpResponse => ({ status, headers: {}, body: JSON.stringify(body) })

describe("GitHub publication adapter", () => {
  test("release and exact asset metadata converge without mutation", async () => {
    const { bundle, bytes, publication } = fixture()
    let posts = 0
    const http: PublicationHttp = { request: ({ method }) => Effect.sync(() => { if (method === "POST") posts++; return response(200, releaseBody(bytes)) }) }
    const subjects = makeGithubSubjects(bundle, publication, http, { read: "read-token", publish: "publish-token" })
    expect((await Effect.runPromise(publishSubject(subjects[0]!)))._tag).toBe("PublicationConverged")
    expect((await Effect.runPromise(publishSubject(subjects[1]!)))._tag).toBe("PublicationConverged")
    expect(posts).toBe(0)
  })

  test("an absent release is created once and reobserved", async () => {
    const { bundle, bytes, publication } = fixture()
    const responses = [response(404, {}), response(201, releaseBody(bytes, false)), response(200, releaseBody(bytes, false))]
    let index = 0
    let postBody = ""
    const http: PublicationHttp = { request: ({ method, body }) => Effect.sync(() => {
      if (method === "POST") postBody = String(body)
      return responses[index++]!
    }) }
    const result = await Effect.runPromise(publishSubject(makeGithubSubjects(bundle, publication, http, { read: "read-token", publish: "publish-token" })[0]!))
    expect(result._tag).toBe("PublicationConverged")
    expect(postBody).toContain('"tag_name":"v1.0.0"')
    expect(index).toBe(3)
  })

  test("same-name different-byte assets conflict and never upload", async () => {
    const { bundle, bytes, publication } = fixture()
    let uploads = 0
    const http: PublicationHttp = { request: ({ method }) => Effect.sync(() => { if (method === "POST") uploads++; return response(200, releaseBody(bytes, true, "sha256:different")) }) }
    const result = await Effect.runPromise(publishSubject(makeGithubSubjects(bundle, publication, http, { read: "token", publish: "token" })[1]!))
    expect(result._tag).toBe("PublicationBlocked")
    expect(uploads).toBe(0)
  })

  test("malformed or unavailable release observations are inconclusive", async () => {
    const { bundle, publication } = fixture()
    for (const current of [response(401, {}), response(429, {}), response(500, {}), { status: 200, headers: {}, body: "not-json" }]) {
      let posts = 0
      const http: PublicationHttp = { request: ({ method }) => Effect.sync(() => { if (method === "POST") posts++; return current }) }
      const result = await Effect.runPromise(publishSubject(makeGithubSubjects(bundle, publication, http, { read: "r", publish: "p" })[0]!))
      expect(result._tag).toBe("PublicationBlocked")
      expect(result._tag === "PublicationBlocked" ? result.observation._tag : "").toBe("Inconclusive")
      expect(posts).toBe(0)
    }
  })

  test("an absent asset uploads only after exact release observation", async () => {
    const { bundle, bytes, publication } = fixture()
    const responses = [response(200, releaseBody(bytes, false)), response(201, {}), response(200, releaseBody(bytes, true))]
    let index = 0
    let upload: Uint8Array | undefined
    const http: PublicationHttp = { request: ({ method, body }) => Effect.sync(() => {
      if (method === "POST") upload = body instanceof Uint8Array ? body : undefined
      return responses[index++]!
    }) }
    const result = await Effect.runPromise(publishSubject(makeGithubSubjects(bundle, publication, http, { read: "token", publish: "token" })[1]!))
    expect(result._tag).toBe("PublicationConverged")
    expect(upload).toEqual(bytes)
    expect(index).toBe(3)
  })
})
