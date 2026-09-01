import { createHash } from "node:crypto"
import { join } from "node:path"
import { readFileSync } from "node:fs"
import * as Effect from "effect/Effect"
import { makeReleaseApi } from "../../../src/api/api.js"
import { makeNodeReleaseLayer } from "../../../src/platform/node.js"
import { makeLocalPreparedReleaseStore } from "../../../src/release/prepared-store.js"
import { encodeCompletePreparedReleaseRef } from "../../../src/release/prepared-ref.js"
import { digestEquals } from "../../../src/model/digest.js"
import {
  candidateActionReference, preparedRoot, report, root, selfReleaseConfigs
} from "./self-release-facts.js"

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
const lanes: Array<Record<string, unknown>> = []
try {
  for (const { lane, config } of selfReleaseConfigs()) {
    const prepared = await api.prepare({ config, workspace: root })
    const bundle = await Effect.runPromise(store.load(prepared))
    const manifestBytes = new Uint8Array(readFileSync(join(bundle.directory, "prepared-release.json")))
    const manifestDigest = sha256(manifestBytes)
    if (prepared.scheme !== "local" || prepared.digest !== manifestDigest) failures.push(`${lane} prepared reference does not match its manifest SHA-256.`)
    if (bundle.manifest.schemaVersion !== "prepared-release/v2") failures.push(`${lane} prepared bundle has the wrong schema version.`)
    if (bundle.manifest.source.clean !== true) failures.push(`${lane} prepared source is not marked clean.`)
    for (const artifact of bundle.manifest.artifacts) {
      const bytes = bundle.blobs.get(artifact.id.toString())
      if (bytes === undefined) failures.push(`${lane} prepared bundle is missing blob ${artifact.id}.`)
      else if (bytes.length !== artifact.size || sha256(bytes) !== artifact.digest.hex ||
          !digestEquals(artifact.blob, artifact.digest)) {
        failures.push(`${lane} prepared artifact ${artifact.id} failed size/digest verification.`)
      }
    }
    const publicationTags = bundle.manifest.publications.map((publication) => publication._tag)
    const expectedTag = lane === "github" ? "PreparedGitHubPublication" : "PreparedNpmPublication"
    if (publicationTags.length !== 1 || publicationTags[0] !== expectedTag) {
      failures.push(`${lane} prepared bundle must carry exactly its one provider-native publication intent.`)
    }

    if (lane === "github") {
      const artifactIds = new Set(bundle.manifest.artifacts.map((artifact) => artifact.id.toString()))
      for (const id of requiredArtifacts) if (!artifactIds.has(id)) failures.push(`GitHub prepared bundle is missing artifact ${id}.`)
      const agentCollection = bundle.manifest.collections.find((collection) => collection.contract.id.toString() === "agents")
      if (agentCollection === undefined) failures.push("GitHub prepared bundle is missing the agents artifact collection.")
      else {
        const keys = agentCollection.members.map((member) => member.key.toString())
        if (keys.join(",") !== requiredAgentMembers.join(",")) failures.push(`Agent collection members are ${keys.join(",")}, expected ${requiredAgentMembers.join(",")}.`)
        for (const member of agentCollection.members) if (!artifactIds.has(member.artifactId.toString())) {
          failures.push(`Agent collection member ${member.key} references missing artifact ${member.artifactId}.`)
        }
        if (agentCollection.contract.artifactKind !== "archive" || agentCollection.contract.pathSuffix !== ".zip" ||
            agentCollection.contract.mediaType !== "application/zip") failures.push("Agent collection contract does not describe ZIP archives.")
        const github = bundle.manifest.publications[0]
        if (github?._tag === "PreparedGitHubPublication") {
          const published = new Set(github.assets.map((asset) => asset.artifactId.toString()))
          for (const member of agentCollection.members) if (!published.has(member.artifactId.toString())) {
            failures.push(`GitHub publication omitted agent collection member ${member.key}.`)
          }
        }
      }
    } else {
      if (bundle.manifest.collections.length !== 0) failures.push("npm prepared bundle must not contain GitHub artifact collections.")
      const publication = bundle.manifest.publications[0]
      if (publication?._tag === "PreparedNpmPublication" &&
          !bundle.manifest.artifacts.some((artifact) => artifact.id.toString() === publication.artifactId.toString())) {
        failures.push("npm prepared bundle publication references no adopted tarball artifact.")
      }
    }

    const inspection = await api.inspect({ prepared })
    if (!("project" in inspection)) failures.push(`${lane} prepared inspection did not return the durable bundle projection.`)
    lanes.push({
      lane,
      preparedReference: encodeCompletePreparedReleaseRef(prepared),
      manifestDigest,
      artifacts: bundle.manifest.artifacts.length,
      collections: bundle.manifest.collections.length,
      publications: bundle.manifest.publications.length
    })
  }
  report("self-release-prepare-report/v2", failures, {
    lanes,
    actionReference: candidateActionReference(),
    authorityOrder: ["prepare-exact-sha", "certify-npm-oidc", "create-tag", "publish-npm", "publish-github"],
    evidenceState: "contract-tested"
  })
} catch (cause) {
  report("self-release-prepare-report/v2", [
    `Public preparation failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`
  ], { lanes, evidenceState: "contract-tested" })
} finally {
  await api.dispose()
}
