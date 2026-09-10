import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ProvenanceSource } from "../packages/npm/src/index.js"

// Authentic public npm provenance; this check refreshes native TUF metadata.
const fixturePath = join(
  import.meta.dir,
  "../test/reimplementation/npm/fixtures/sigstore-5.0.0-attestations.json",
)
const fixtureBytes = new Uint8Array(await Bun.file(fixturePath).arrayBuffer())
const fixture = JSON.parse(new TextDecoder().decode(fixtureBytes))
const bundle = fixture.attestations.find(
  (entry: { predicateType: string }) => entry.predicateType === "https://slsa.dev/provenance/v1",
).bundle
const source = new ProvenanceSource({
  format: "npm-github-actions-provenance-source/v1",
  serverUrl: "https://github.com",
  repository: "sigstore/sigstore-js",
  workflow: ".github/workflows/release.yml",
  workflowRef: "refs/heads/main",
  sourceRef: "refs/heads/main",
  sourceCommit: "7d2900eca1c22b3f87c13987c8d4b7c9a29b733a",
  eventName: "push",
  repositoryId: "495574555",
  repositoryOwnerId: "71096353",
  runnerEnvironment: "github-hosted",
  runId: "26781866618",
  runAttempt: "1",
  repositoryVisibility: "public",
})
const work = await mkdtemp(join(tmpdir(), "ts-release-native-sigstore-"))
const seeds = await Bun.file(
  join(import.meta.dir, "../node_modules/@sigstore/tuf/seeds.json"),
).json()
await Bun.$`mkdir -p ${import.meta.dir + "/../.release/checks"}`

const root = Buffer.from(seeds["https://tuf-repo-cdn.sigstore.dev"]["root.json"], "base64")
const tufRootPath = join(work, "root.json")
await Bun.write(tufRootPath, root)
const sourcePath = join(work, "source.json"),
  resultPath = join(work, "result.json")
await Bun.write(sourcePath, JSON.stringify(source))
const node = process.env.TS_RELEASE_NATIVE_NODE ?? "node"
const child = Bun.spawn(
  [
    node,
    join(import.meta.dir, "../test/reimplementation/npm/native-sigstore-consumer.mjs"),
    fixturePath,
    sourcePath,
    tufRootPath,
    join(work, "tuf"),
    resultPath,
  ],
  { stdout: "pipe", stderr: "pipe" },
)
const [exit, stdout, stderr] = await Promise.all([
  child.exited,
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
])
assert.equal(exit, 0, `${stdout}\n${stderr}`)
const result = await Bun.file(resultPath).json()
const receipt = {
  format: "ts-release/native-npm-sigstore/1",
  checkedAt: new Date().toISOString(),
  registrySource: "https://registry.npmjs.org/-/npm/v1/attestations/sigstore@5.0.0",
  fixtureSha256: createHash("sha256").update(fixtureBytes).digest("hex"),
  tufSeedSha256: createHash("sha256").update(root).digest("hex"),
  sigstore: "5.0.0",
  success:
    "Authentic npm SLSA provenance verified by the actual Sigstore native client, production TUF, certificate/SCT/transparency/signature, anchored issuer/workflow and source extension binding",
  runtime: result.runtime,
  rejectedControls: result.rejectedControls,
  work,
  limits: [
    "read-only existing public package witness",
    "no signing/OIDC exchange/publication",
    "read-only verification; no publication",
    "Bun1.3.14 native TUF verification fails on the same authentic root (0/3ECDSA signatures); this Node witness does not qualify Bun Sigstore",
  ],
}
await Bun.write(
  join(import.meta.dir, "../.release/checks/native-sigstore.json"),
  JSON.stringify(receipt, null, 2) + "\n",
)
console.log(JSON.stringify(receipt, null, 2))
