import { expect, test } from "bun:test"
import { Repository } from "../../../packages/github/src/Model.js"
import { releaseFacts, refFacts, assetFacts } from "../../../packages/github/src/Native.js"
import release from "./fixtures/v030-release.json" with { type: "json" }
import ref from "./fixtures/v030-ref.json" with { type: "json" }

const repository = new Repository({
  apiUrl: "https://api.github.com",
  owner: "mannyc2",
  name: "ts-release",
})
test("real public v0.3.0 REST responses retain exact native tag, release and all eleven asset identities", () => {
  expect(refFacts(ref, repository)).toMatchObject({
    ref: "refs/tags/v0.3.0",
    objectType: "commit",
    objectOid: "cea8c957090d89c88838782c4d3265521f47d895",
  })
  expect(releaseFacts(release, repository)).toMatchObject({
    releaseId: "380698559",
    tag: "v0.3.0",
    draft: false,
    title: "@mannyc1/ts-release 0.3.0",
  })
  expect(release.assets).toHaveLength(11)
  for (const asset of release.assets) {
    const admitted = assetFacts(asset, repository, "v0.3.0")
    expect(admitted.assetId).toBe(String(asset.id))
    expect(admitted.bytes).toBe(String(asset.size))
    expect(admitted.sha256).toBe(asset.digest.slice(7))
    expect(admitted.storedName).toBe(asset.name)
  }
})
test("native URL binding accepts GitHub's case-insensitive repository coordinates and rejects foreign parent/origin paths", () => {
  const mixed = new Repository({ ...repository, owner: "MannyC2", name: "TS-Release" })
  expect(() => releaseFacts(release, mixed)).not.toThrow()
  expect(() => refFacts(ref, mixed)).not.toThrow()
  expect(() => assetFacts(release.assets[0]!, mixed, "v0.3.0")).not.toThrow()
  for (const upload_url of [
    release.upload_url.replace("uploads.github.com", "uploads.github.com.evil.invalid"),
    release.upload_url.replace("380698559", "380698558"),
    release.upload_url.replace("mannyc2", "another"),
    release.upload_url.replace("{?name,label}", "?token=fixture"),
  ])
    expect(() => releaseFacts({ ...release, upload_url }, repository)).toThrow()
})
test("native missing digests and starter states remain distinct from malformed and conflicting data", () => {
  const asset = release.assets[0]!
  expect(assetFacts({ ...asset, digest: null }, repository, "v0.3.0").sha256).toBeNull()
  expect(
    assetFacts({ ...asset, state: "starter", size: 0, digest: null }, repository, "v0.3.0").state,
  ).toBe("starter")
  for (const patch of [
    { digest: "invalid" },
    { size: -1 },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { url: asset.url + "/other" },
    { browser_download_url: asset.browser_download_url.replace("v0.3.0", "v0.2.0") },
  ])
    expect(() => assetFacts({ ...asset, ...patch }, repository, "v0.3.0")).toThrow()
})
