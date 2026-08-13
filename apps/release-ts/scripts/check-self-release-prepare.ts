import { createHash } from "node:crypto"
import { join } from "node:path"
import { readFileSync } from "node:fs"
import * as Effect from "effect/Effect"
import { makeReleaseApi } from "../../../src/api/api.js"
import { makeNodeReleaseLayer } from "../../../src/platform/node.js"
import { makeLocalPreparedReleaseStore } from "../../../src/release/prepared-store.js"
import { encodeCompletePreparedReleaseRef } from "../../../src/release/prepared-ref.js"
import { candidateActionReference, preparedRoot, report, root, selfReleaseConfig } from "./self-release-facts.js"

const failures: Array<string> = []
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const requiredArtifacts = [
  "cli-linux-x64", "cli-linux-arm64", "cli-darwin-x64", "cli-darwin-arm64",
  "cli-linux-x64-tar-gz", "cli-linux-x64-zip",
  "cli-linux-arm64-tar-gz", "cli-linux-arm64-zip",
  "cli-darwin-x64-tar-gz", "cli-darwin-x64-zip",
  "cli-darwin-arm64-tar-gz", "cli-darwin-arm64-zip",
  "checksum-digests"
]
const requiredAgentMembers = ["ts-release-claude.zip", "ts-release-codex.zip"]

const store = makeLocalPreparedReleaseStore(join(root, preparedRoot))
const api = makeReleaseApi(makeNodeReleaseLayer(store))
try {
  const prepared = await api.prepare({ config: selfReleaseConfig(), workspace: root })
  const bundle = await Effect.runPromise(store.load(prepared))
  const manifestBytes = new Uint8Array(readFileSync(join(bundle.directory, "prepared-release.json")))
  const manifestDigest = sha256(manifestBytes)
  if (prepared.scheme !== "local" || prepared.digest !== manifestDigest) failures.push("Prepared reference does not match the manifest SHA-256.")
  if (bundle.manifest.schemaVersion !== "prepared-release/v2") failures.push("Prepared bundle has the wrong schema version.")
  if (bundle.manifest.source.clean !== true) failures.push("Prepared source is not marked clean.")
  const artifactIds = new Set(bundle.manifest.artifacts.map((artifact) => artifact.id.toString()))
  for (const id of requiredArtifacts) if (!artifactIds.has(id)) failures.push(`Prepared bundle is missing artifact ${id}.`)
  const agentCollection = bundle.manifest.collections.find((collection) => collection.contract.id.toString() === "agents")
  if (agentCollection === undefined) failures.push("Prepared bundle is missing the agents artifact collection.")
  else {
    const keys = agentCollection.members.map((member) => member.key.toString())
    if (keys.join(",") !== requiredAgentMembers.join(",")) failures.push(`Agent collection members are ${keys.join(",")}, expected ${requiredAgentMembers.join(",")}.`)
    for (const member of agentCollection.members) if (!artifactIds.has(member.artifactId.toString())) {
      failures.push(`Agent collection member ${member.key} references missing artifact ${member.artifactId}.`)
    }
    if (agentCollection.contract.artifactKind !== "archive" || agentCollection.contract.pathSuffix !== ".zip" ||
        agentCollection.contract.mediaType !== "application/zip") failures.push("Agent collection contract does not describe ZIP archives.")
  }
  for (const artifact of bundle.manifest.artifacts) {
    const bytes = bundle.blobs.get(artifact.id.toString())
    if (bytes === undefined) failures.push(`Prepared bundle is missing blob ${artifact.id}.`)
    else if (bytes.length !== artifact.size || sha256(bytes) !== artifact.digest.toString() || artifact.blob !== artifact.digest) failures.push(`Prepared artifact ${artifact.id} failed size/digest verification.`)
  }
  if (!bundle.manifest.publications.some((publication) => publication._tag === "PreparedNpmPublication")) failures.push("Prepared bundle has no npm publication intent.")
  if (!bundle.manifest.publications.some((publication) => publication._tag === "PreparedGitHubPublication")) failures.push("Prepared bundle has no GitHub publication intent.")
  const github = bundle.manifest.publications.find((publication) => publication._tag === "PreparedGitHubPublication")
  if (github?._tag === "PreparedGitHubPublication" && agentCollection !== undefined) {
    const published = new Set(github.assets.map((asset) => asset.artifactId.toString()))
    for (const member of agentCollection.members) if (!published.has(member.artifactId.toString())) {
      failures.push(`GitHub publication omitted agent collection member ${member.key}.`)
    }
  }
  if (bundle.manifest.publications.map((publication) => publication._tag).join(",") !== "PreparedGitHubPublication,PreparedNpmPublication") {
    failures.push("Prepared publication order must create the immutable GitHub Action ref before npm publishes its README.")
  }
  const inspection = await api.inspect({ prepared })
  if (!("project" in inspection)) failures.push("Prepared inspection did not return the durable bundle projection.")
  report("self-release-prepare-report/v1", failures, {
    preparedReference: encodeCompletePreparedReleaseRef(prepared), manifestDigest, schemaVersion: bundle.manifest.schemaVersion,
    artifacts: bundle.manifest.artifacts.length, collections: bundle.manifest.collections.length,
    agentCollectionMembers: agentCollection?.members.length ?? 0, publications: bundle.manifest.publications.length,
    actionReference: candidateActionReference(), evidenceState: "contract-tested"
  })
} catch (cause) {
  report("self-release-prepare-report/v1", [`Public prepare failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`], { evidenceState: "contract-tested" })
} finally {
  await api.dispose()
}
