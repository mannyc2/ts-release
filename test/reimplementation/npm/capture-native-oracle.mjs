import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

// Runs unchanged official npm encoders. Only the outbound registry port is
// intercepted: no credentials, network, package mutation or production imports.
const [npmRoot, fixtureDirectory] = process.argv.slice(2)
const require = createRequire(join(npmRoot, "package.json"))
const fetchPath = require.resolve("npm-registry-fetch")
const nativeFetch = require(fetchPath)
const requests = []
const capture = async (path, options) => {
  requests.push({
    endpoint: new URL(path, options.registry).href,
    method: options.method,
    body: typeof options.body === "string" ? options.body : JSON.stringify(options.body),
  })
  return { status: 201 }
}
capture.pickRegistry = nativeFetch.pickRegistry
require.cache[fetchPath].exports = capture
const publishPath = require.resolve("libnpmpublish/lib/publish.js")
const tagPath = join(npmRoot, "lib/commands/dist-tag.js")
const publish = require(publishPath)
const DistTag = require(tagPath)
const manifest = JSON.parse(readFileSync(join(fixtureDirectory, "native-manifest.json")))
const tarball = readFileSync(join(fixtureDirectory, "native-package.tgz"))
const options = { registry: "https://registry.npmjs.org/", access: "public", defaultTag: "latest" }
await publish(manifest, tarball, options)
await DistTag.prototype.add.call(
  { npm: {}, fetchTags: async () => ({ latest: "1.0.0" }) },
  `${manifest.name}@${manifest.version}`,
  "next",
  options,
)
assert.equal(requests.length, 2)
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
writeFileSync(
  join(fixtureDirectory, "native-oracle.json"),
  JSON.stringify(
    {
      format: "ts-release/npm-native-request-oracle/1",
      npm: require(join(npmRoot, "package.json")).version,
      libnpmpublish: require("libnpmpublish/package.json").version,
      nodeVersion: process.versions.node,
      sources: [publishPath, tagPath].map((path) => ({
        path: path.slice(npmRoot.length + 1),
        sha256: hash(readFileSync(path)),
      })),
      tarballSha256: hash(tarball),
      manifestSha256: hash(readFileSync(join(fixtureDirectory, "native-manifest.json"))),
      requests,
      limits: [
        "Official native request encoders with intercepted registry port; no remote publication",
        "Publish comparison excludes only npm-injected _nodeVersion and JSON object key order",
        "Dist-tag compares exact body bytes; provenance trust has a separate authentic native witness",
      ],
    },
    null,
    2,
  ) + "\n",
)
