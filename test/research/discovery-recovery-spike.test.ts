import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"

type Observation =
  | { readonly kind: "Equivalent" }
  | { readonly kind: "NeedsMutation" }
  | { readonly kind: "Conflict"; readonly differences: ReadonlyArray<string> }
  | { readonly kind: "Inconclusive"; readonly reason: string }

type MutationResult =
  | { readonly kind: "Applied" }
  | { readonly kind: "Rejected"; readonly reason: string }
  | { readonly kind: "OutcomeUnknown" }

type Failure =
  | "missing"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "server-error"
  | "malformed"
  | "transport-lost"

type ProcessFailure = "spawn-failed" | "child-exits-nonzero" | "commit-response-loss"

interface PreparedSubject {
  readonly provider: "github" | "npm" | "pypi"
  readonly subject: "release" | "asset" | "package-version" | "file"
  readonly coordinate: string
  readonly facts: Readonly<Record<string, string | number | boolean>>
  readonly bytes: Uint8Array
}

interface PreparedRelease {
  readonly subjects: ReadonlyArray<PreparedSubject>
  readonly blobs: ReadonlyMap<string, Uint8Array>
}

const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const bytes = (value: string): Uint8Array => new TextEncoder().encode(value)
const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const differences = (
  expected: PreparedSubject,
  actual: PreparedSubject
): ReadonlyArray<string> => [
  ...new Set([
    ...Object.keys(expected.facts),
    ...Object.keys(actual.facts)
  ])
].filter((key) => expected.facts[key] !== actual.facts[key])
  .concat(sameBytes(expected.bytes, actual.bytes) ? [] : ["bytes"])

class Destination {
  readonly subjects = new Map<string, PreparedSubject>()
  readonly committed = new Set<string>()
  visibilityLag = new Set<string>()

  get mutationCount(): number {
    return this.committed.size
  }
}

const observe = (
  destination: Destination,
  intended: PreparedSubject,
  failure?: Failure
): Observation => {
  if (failure === "missing") {
    return { kind: "NeedsMutation" }
  }
  if (failure !== undefined) {
    return { kind: "Inconclusive", reason: failure }
  }
  if (destination.visibilityLag.has(intended.coordinate)) {
    return { kind: "Inconclusive", reason: "eventual-visibility-lag" }
  }
  const present = destination.subjects.get(intended.coordinate)
  if (present === undefined) return { kind: "NeedsMutation" }
  const mismatch = differences(intended, present)
  return mismatch.length === 0 ? { kind: "Equivalent" } : { kind: "Conflict", differences: mismatch }
}

const mutate = (
  destination: Destination,
  intended: PreparedSubject,
  failure?: ProcessFailure
): MutationResult => {
  if (failure === "spawn-failed") return { kind: "Rejected", reason: "process-never-started" }
  if (failure === "child-exits-nonzero") return { kind: "Rejected", reason: "child-exited-nonzero" }
  const present = destination.subjects.get(intended.coordinate)
  if (present !== undefined && differences(intended, present).length > 0) {
    return { kind: "Rejected", reason: "coordinate-occupied-by-different-subject" }
  }
  if (present === undefined) {
    destination.subjects.set(intended.coordinate, intended)
    destination.committed.add(intended.coordinate)
  }
  return failure === "commit-response-loss"
    ? { kind: "OutcomeUnknown" }
    : { kind: "Applied" }
}

const publishOne = (
  destination: Destination,
  intended: PreparedSubject,
  observationFailure?: Failure,
  processFailure?: ProcessFailure
): { readonly observation: Observation; readonly mutation?: MutationResult } => {
  const observation = observe(destination, intended, observationFailure)
  if (observation.kind !== "NeedsMutation") return { observation }
  const mutation = mutate(destination, intended, processFailure)
  return { observation, mutation }
}

const subject = (
  provider: PreparedSubject["provider"],
  subjectKind: PreparedSubject["subject"],
  coordinate: string,
  facts: PreparedSubject["facts"],
  contents: string
): PreparedSubject => {
  const payload = bytes(contents)
  return {
    provider, subject: subjectKind, coordinate,
    facts: { ...facts, digest: digest(payload), size: payload.length }, bytes: payload
  }
}

const githubRelease = subject("github", "release", "github:owner/repo:v1.0.0", {
  repository: "owner/repo", tag: "v1.0.0", title: "v1.0.0", body: "release notes",
  draft: false, prerelease: false
}, "release notes")
const githubAsset = subject("github", "asset", "github:owner/repo:v1.0.0:payload.zip", {
  repository: "owner/repo", tag: "v1.0.0", name: "payload.zip", mediaType: "application/zip"
}, "prepared asset bytes")
const npmTarball = subject("npm", "package-version", "npm:https://registry.npmjs.org:pkg:1.0.0", {
  registry: "https://registry.npmjs.org", name: "pkg", version: "1.0.0",
  integrity: "sha512-prepared"
}, "prepared npm tarball")
const pypiSdist = subject("pypi", "file", "pypi:https://upload.pypi.org/legacy/:pkg-1.0.0.tar.gz", {
  index: "https://upload.pypi.org/legacy/", project: "pkg", version: "1.0.0",
  filename: "pkg-1.0.0.tar.gz", publishedDigest: "sha256-prepared"
}, "prepared sdist")
const pypiWheel = subject("pypi", "file", "pypi:https://upload.pypi.org/legacy/:pkg-1.0.0-py3-none-any.whl", {
  index: "https://upload.pypi.org/legacy/", project: "pkg", version: "1.0.0",
  filename: "pkg-1.0.0-py3-none-any.whl", publishedDigest: "sha256-prepared"
}, "prepared wheel")

const subjects = [githubRelease, githubAsset, npmTarball, pypiSdist, pypiWheel] as const
const cutPoints = [
  "credential", "observe-before-response", "needs-before-dispatch", "accept-before-response",
  "conflict-response", "after-mutation-before-observe", "post-observe", "partial-batch"
] as const

const prepared = (selected: ReadonlyArray<PreparedSubject>): PreparedRelease => ({
  subjects: selected,
  blobs: new Map(selected.map((item) => [item.coordinate, item.bytes]))
})

describe("discovery-first recovery spike", () => {
  test("the registered matrix has five exact subjects and eight kill points each", () => {
    expect(subjects).toHaveLength(5)
    expect(cutPoints).toHaveLength(8)
    expect(subjects.length * cutPoints.length).toBe(40)
    expect(new Set(subjects.map((item) => item.coordinate)).size).toBe(subjects.length)
  })

  test("equality is exact for release metadata, bytes, npm integrity, and PyPI files", () => {
    for (const intended of subjects) {
      const destination = new Destination()
      destination.subjects.set(intended.coordinate, intended)
      const result = observe(destination, intended)
      expect(result).toEqual({ kind: "Equivalent" })
    }
    const changedRelease = { ...githubRelease, facts: { ...githubRelease.facts, body: "changed" } }
    const changedDestination = new Destination()
    changedDestination.subjects.set(changedRelease.coordinate, changedRelease)
    const conflict = observe(changedDestination, githubRelease)
    expect(conflict.kind).toBe("Conflict")
    expect(conflict.kind === "Conflict" ? conflict.differences : []).toContain("body")
    const changedAsset = { ...githubAsset, bytes: bytes("different asset") }
    const assetDestination = new Destination()
    assetDestination.subjects.set(changedAsset.coordinate, changedAsset)
    const assetConflict = observe(assetDestination, githubAsset)
    expect(assetConflict.kind).toBe("Conflict")
    expect(assetConflict.kind === "Conflict" ? assetConflict.differences : []).toContain("bytes")
  })

  test("conflict and inconclusive outcomes never authorize a write", () => {
    for (const failure of ["unauthorized", "forbidden", "rate-limited", "server-error", "malformed", "transport-lost"] as const) {
      const destination = new Destination()
      const result = publishOne(destination, npmTarball, failure)
      expect(result.observation.kind).toBe("Inconclusive")
      expect(result.mutation).toBeUndefined()
      expect(destination.mutationCount).toBe(0)
    }
    const destination = new Destination()
    destination.subjects.set(npmTarball.coordinate, { ...npmTarball, facts: { ...npmTarball.facts, integrity: "sha512-other" } })
    const result = publishOne(destination, npmTarball)
    expect(result.observation.kind).toBe("Conflict")
    expect(result.mutation).toBeUndefined()
    expect(destination.mutationCount).toBe(0)
  })

  test("kill point reruns restore only prepared bytes and never duplicate a subject", () => {
    for (const intended of subjects) {
      for (const cutPoint of cutPoints) {
        const destination = new Destination()
        const release = prepared([intended])
        expect(release.blobs.get(intended.coordinate)).toEqual(intended.bytes)
        const first = publishOne(destination, intended,
          cutPoint === "credential" || cutPoint === "observe-before-response" ? "transport-lost" : undefined,
          cutPoint === "accept-before-response" ? "commit-response-loss" : undefined)
        if (cutPoint === "credential" || cutPoint === "observe-before-response") {
          expect(first.observation.kind).toBe("Inconclusive")
          expect(destination.mutationCount).toBe(0)
          continue
        }
        if (cutPoint === "accept-before-response") expect(first.mutation?.kind).toBe("OutcomeUnknown")
        const rerun = publishOne(destination, intended)
        expect(rerun.observation).toEqual({ kind: "Equivalent" })
        expect(destination.mutationCount).toBe(1)
      }
    }
  })

  test("missing exact subjects are created once and identical actors converge", () => {
    const destination = new Destination()
    const first = publishOne(destination, githubRelease, "missing")
    expect(first.observation).toEqual({ kind: "NeedsMutation" })
    expect(first.mutation).toEqual({ kind: "Applied" })
    const second = publishOne(destination, githubRelease)
    expect(second.observation).toEqual({ kind: "Equivalent" })
    expect(second.mutation).toBeUndefined()
    expect(destination.mutationCount).toBe(1)
  })

  test("eventual visibility stays inconclusive until exact observation is available", () => {
    const destination = new Destination()
    destination.subjects.set(githubAsset.coordinate, githubAsset)
    destination.visibilityLag.add(githubAsset.coordinate)
    const duringLag = publishOne(destination, githubAsset)
    expect(duringLag.observation).toEqual({ kind: "Inconclusive", reason: "eventual-visibility-lag" })
    expect(duringLag.mutation).toBeUndefined()
    destination.visibilityLag.clear()
    expect(publishOne(destination, githubAsset).observation).toEqual({ kind: "Equivalent" })
    expect(destination.mutationCount).toBe(0)
  })

  test("a partial multi-subject release uses prepared blobs and publishes only missing subjects", () => {
    const release = prepared([githubRelease, githubAsset, npmTarball])
    const destination = new Destination()
    destination.subjects.set(githubRelease.coordinate, githubRelease)
    for (const intended of release.subjects) publishOne(destination, intended)
    expect(destination.mutationCount).toBe(2)
    expect([...destination.subjects.keys()]).toEqual(release.subjects.map((item) => item.coordinate))
  })

  test("command process boundaries distinguish no child, child failure, and commit response loss", () => {
    const spawnDestination = new Destination()
    const spawn = publishOne(spawnDestination, pypiWheel, "missing", "spawn-failed")
    expect(spawn.mutation).toEqual({ kind: "Rejected", reason: "process-never-started" })
    expect(spawnDestination.mutationCount).toBe(0)

    const childDestination = new Destination()
    const child = publishOne(childDestination, pypiSdist, "missing", "child-exits-nonzero")
    expect(child.mutation).toEqual({ kind: "Rejected", reason: "child-exited-nonzero" })
    expect(childDestination.mutationCount).toBe(0)

    const committedDestination = new Destination()
    const committed = publishOne(committedDestination, pypiWheel, "missing", "commit-response-loss")
    expect(committed.mutation).toEqual({ kind: "OutcomeUnknown" })
    expect(publishOne(committedDestination, pypiWheel).observation).toEqual({ kind: "Equivalent" })
    expect(committedDestination.mutationCount).toBe(1)
  })

  test("negative controls never enter discovery-first mutation", () => {
    const destination = new Destination()
    const opaquePost: Observation = { kind: "Inconclusive", reason: "no-product-owned-observer" }
    const announcement: Observation = { kind: "Inconclusive", reason: "no-provider-uniqueness-contract" }
    expect(opaquePost).toEqual({ kind: "Inconclusive", reason: "no-product-owned-observer" })
    expect(announcement).toEqual({ kind: "Inconclusive", reason: "no-provider-uniqueness-contract" })
    expect(destination.mutationCount).toBe(0)
  })
})
