// Invariant: only plan-derived basenames become download URLs; a remote checksum manifest is data, never routing input.
import { createHash } from "node:crypto"
import * as Effect from "effect/Effect"
import type { ChecksumAlgorithm } from "../grammar/artifact.js"
import type { PublishedAssetsVerifyAction } from "../grammar/operation.js"
import { ReleaseHttp } from "../host/http.js"
import { VerifyCheckEvidence } from "./evidence.js"

const textDecoder = new TextDecoder()

export const publishedAssetUrl = (repository: string, tag: string, name: string): string =>
  `https://github.com/${repository}/releases/download/${tag}/${name}`

const checksumLength = (algorithm: ChecksumAlgorithm): number => algorithm === "sha256" ? 64 : 128

const expectedChecksums = (
  bytes: Uint8Array,
  algorithm: ChecksumAlgorithm,
  assetNames: ReadonlyArray<string>
): { readonly valid: boolean; readonly values: ReadonlyMap<string, string> } => {
  const expected = new Set(assetNames)
  const values = new Map<string, string>()
  const lines = textDecoder.decode(bytes).split(/\r?\n/)
  if (lines.at(-1) === "") lines.pop()
  let valid = true
  for (const line of lines) {
    const match = /^([0-9a-fA-F]+)  ([^/\\\r\n]+)$/.exec(line)
    if (match === null) {
      if ([...expected].some((name) => line.endsWith(`  ${name}`) || line.includes(name))) valid = false
      continue
    }
    const [, digest, name] = match
    if (name === undefined || digest === undefined || !expected.has(name)) continue
    if (digest.length !== checksumLength(algorithm) || values.has(name)) {
      valid = false
      continue
    }
    values.set(name, digest.toLowerCase())
  }
  return { valid, values }
}

const getBytes = Effect.fn("run.published.getBytes")(function*(url: string) {
  const http = yield* ReleaseHttp
  return yield* http.runBytes({ method: "GET", url, headers: [], envHeaders: [] }).pipe(
    Effect.map((result) => result.status >= 200 && result.status < 300 ? result.bytes : undefined),
    Effect.catch(() => Effect.succeed(undefined))
  )
})

export const verifyPublishedAssets = Effect.fn("run.verifyPublishedAssets")(function*(
  action: PublishedAssetsVerifyAction
) {
  const checksumBytes = yield* getBytes(
    publishedAssetUrl(action.repository, action.tag, action.checksumAssetName)
  )
  const parsed = checksumBytes === undefined
    ? { valid: false, values: new Map<string, string>() }
    : expectedChecksums(checksumBytes, action.algorithm, action.assetNames)
  const checks: Array<VerifyCheckEvidence> = [VerifyCheckEvidence.make({
    description: `checksum asset ${action.checksumAssetName} is reachable and valid`,
    passed: checksumBytes !== undefined && parsed.valid
  })]
  for (const name of action.assetNames) {
    const expected = parsed.values.get(name)
    const bytes = expected === undefined
      ? undefined
      : yield* getBytes(publishedAssetUrl(action.repository, action.tag, name))
    checks.push(VerifyCheckEvidence.make({
      description: `${name} matches ${action.algorithm} checksum`,
      passed: bytes !== undefined && expected !== undefined &&
        createHash(action.algorithm).update(bytes).digest("hex") === expected
    }))
  }
  return checks
})
