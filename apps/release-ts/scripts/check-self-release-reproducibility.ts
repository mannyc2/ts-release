import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import { makeReleaseApi } from "../../../src/api/api.js"
import { makeNodeReleaseLayer } from "../../../src/platform/node.js"
import { makeLocalPreparedReleaseStore, type PreparedBundle } from "../../../src/release/prepared-store.js"
import { encodeCompletePreparedReleaseRef } from "../../../src/release/prepared-ref.js"
import { report, root, selfReleaseConfigs } from "./self-release-facts.js"

interface PreparationRun {
  readonly reference: string
  readonly manifestSha256: string
  readonly manifestBytes: Uint8Array
  readonly bundle: PreparedBundle
  readonly elapsedMs: number
}

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const equal = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])
const json = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes))

const prepareOnce = async (config: unknown, storeRoot: string): Promise<PreparationRun> => {
  const store = makeLocalPreparedReleaseStore(storeRoot)
  const api = makeReleaseApi(makeNodeReleaseLayer(store))
  const startedAt = performance.now()
  try {
    const prepared = await api.prepare({ config, workspace: root })
    const bundle = await Effect.runPromise(store.load(prepared))
    const manifestBytes = new Uint8Array(readFileSync(join(bundle.directory, "prepared-release.json")))
    return {
      reference: encodeCompletePreparedReleaseRef(prepared),
      manifestSha256: sha256(manifestBytes),
      manifestBytes,
      bundle,
      elapsedMs: Math.round(performance.now() - startedAt)
    }
  } finally {
    await api.dispose()
  }
}

const structuredFailure = (failure: unknown): string => {
  if (Cause.isCause(failure)) return Cause.pretty(failure)
  if (typeof failure === "object" && failure !== null && "cause" in failure && Cause.isCause(failure.cause)) {
    return Cause.pretty(failure.cause)
  }
  if (typeof failure === "object" && failure !== null) {
    const encoded = JSON.stringify(failure)
    if (encoded !== undefined && encoded !== "{}") return encoded
  }
  if (failure instanceof Error && failure.message.length > 0) return failure.message
  return String(failure)
}

const sourcePreconditionFailure = (rendered: string): boolean =>
  /(?:dirty|not clean|requires a clean|source\.clean|source tree|working (?:tree|copy)|uncommitted)/iu.test(rendered)

const differencePaths = (left: unknown, right: unknown, path = "$", output: Array<string> = []): ReadonlyArray<string> => {
  if (Object.is(left, right)) return output
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) output.push(`${path}.length`)
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      differencePaths(left[index], right[index], `${path}[${index}]`, output)
    }
    return output
  }
  if (typeof left === "object" && left !== null && !Array.isArray(left) &&
      typeof right === "object" && right !== null && !Array.isArray(right)) {
    const leftObject = left as Readonly<Record<string, unknown>>
    const rightObject = right as Readonly<Record<string, unknown>>
    for (const key of [...new Set([...Object.keys(leftObject), ...Object.keys(rightObject)])].sort()) {
      differencePaths(leftObject[key], rightObject[key], `${path}.${key}`, output)
    }
    return output
  }
  output.push(path)
  return output
}

const artifactRows = (bundle: PreparedBundle) => bundle.manifest.artifacts.map((artifact) => ({
  id: artifact.id.toString(),
  digest: artifact.digest.toString(),
  size: artifact.size,
  bytesSha256: sha256(bundle.blobs.get(artifact.id.toString()) ?? new Uint8Array())
}))

const failures: Array<string> = []
const scratch = mkdtempSync(join(tmpdir(), "ts-release-reproducibility-"))
const results: Array<Record<string, unknown>> = []
try {
  for (const { lane, config } of selfReleaseConfigs()) {
    const first = await prepareOnce(config, join(scratch, lane, "first"))
    const second = await prepareOnce(config, join(scratch, lane, "second"))
    const manifestsEqual = equal(first.manifestBytes, second.manifestBytes)
    const firstArtifacts = artifactRows(first.bundle)
    const secondArtifacts = artifactRows(second.bundle)
    const artifactBytesEqual = JSON.stringify(firstArtifacts) === JSON.stringify(secondArtifacts)
    const differences = manifestsEqual ? [] : differencePaths(json(first.manifestBytes), json(second.manifestBytes))

    if (first.bundle.manifest.source.commit !== second.bundle.manifest.source.commit) failures.push(`${lane} preparations observed different exact source commits.`)
    if (first.bundle.manifest.source.tree !== second.bundle.manifest.source.tree) failures.push(`${lane} preparations observed different exact source trees.`)
    if (firstArtifacts.map((artifact) => artifact.id).join(",") !== secondArtifacts.map((artifact) => artifact.id).join(",")) {
      failures.push(`${lane} preparations produced different artifact identities.`)
    }
    if (!manifestsEqual) failures.push(`${lane} prepared manifests differ at ${differences.length === 0 ? "an unclassified path" : differences.join(", ")}.`)
    if (!artifactBytesEqual) failures.push(`${lane} prepared artifact bytes differ${differences.length === 0 ? " without a corresponding manifest difference" : ""}.`)

    results.push({
      lane,
      sourceCommit: first.bundle.manifest.source.commit.toString(),
      sourceTree: first.bundle.manifest.source.tree.toString(),
      first: { preparedReference: first.reference, manifestSha256: first.manifestSha256, elapsedMs: first.elapsedMs },
      second: { preparedReference: second.reference, manifestSha256: second.manifestSha256, elapsedMs: second.elapsedMs },
      manifestsEqual,
      artifactBytesEqual,
      differingManifestPaths: differences,
      artifactCount: firstArtifacts.length
    })
  }

  report("self-release-reproducibility-report/v2", failures, {
    lanes: results,
    peakRssKiB: process.resourceUsage().maxRSS,
    cacheState: "host cache not controlled; every lane/run used a distinct prepared store and private staging root",
    reproducibility: failures.length === 0 ? "complete-bytes-equal" : "not-reproduced",
    evidenceState: "contract-tested"
  })
} catch (cause) {
  const rendered = structuredFailure(cause)
  const failureKind = sourcePreconditionFailure(rendered) ? "source-precondition-failed" : "independent-preparation-failed"
  report("self-release-reproducibility-report/v2", [
    failureKind === "source-precondition-failed"
      ? `Candidate source precondition failed before reproducibility comparison: ${rendered}`
      : `Independent preparation failed before reproducibility comparison: ${rendered}`
  ], { failureKind, completedLanes: results, comparisonCompleted: false, evidenceState: "contract-tested" })
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
