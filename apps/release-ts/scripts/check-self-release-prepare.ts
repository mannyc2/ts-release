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
  "cli-tar-gz", "cli-zip", "checksum-digests", "agents-codex-archive", "agents-claude-archive"
]

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
  for (const artifact of bundle.manifest.artifacts) {
    const bytes = bundle.blobs.get(artifact.id.toString())
    if (bytes === undefined) failures.push(`Prepared bundle is missing blob ${artifact.id}.`)
    else if (bytes.length !== artifact.size || sha256(bytes) !== artifact.digest.toString() || artifact.blob !== artifact.digest) failures.push(`Prepared artifact ${artifact.id} failed size/digest verification.`)
  }
  if (!bundle.manifest.publications.some((publication) => publication._tag === "PreparedNpmPublication")) failures.push("Prepared bundle has no npm publication intent.")
  if (!bundle.manifest.publications.some((publication) => publication._tag === "PreparedGitHubPublication")) failures.push("Prepared bundle has no GitHub publication intent.")
  const inspection = await api.inspect({ prepared })
  if (!("project" in inspection)) failures.push("Prepared inspection did not return the durable bundle projection.")
  report("self-release-prepare-report/v1", failures, {
    preparedReference: encodeCompletePreparedReleaseRef(prepared), manifestDigest, schemaVersion: bundle.manifest.schemaVersion,
    artifacts: bundle.manifest.artifacts.length, publications: bundle.manifest.publications.length,
    actionReference: candidateActionReference(), evidenceState: "contract-tested"
  })
} catch (cause) {
  report("self-release-prepare-report/v1", [`Public prepare failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`], { evidenceState: "contract-tested" })
} finally {
  await api.dispose()
}
