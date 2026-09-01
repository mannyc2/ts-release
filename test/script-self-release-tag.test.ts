import { describe, expect, test } from "bun:test"
import {
  convergeSelfReleaseTag,
  type GitHubTagBoundary,
  type GitHubTagResponse
} from "../apps/release-ts/scripts/create-self-release-tag.js"

const candidateSha = "c".repeat(40)
const tag = "v0.3.0"
const exact = (sha = candidateSha, type: "commit" | "tag" = "commit"): GitHubTagResponse => ({
  status: 200,
  body: {
    ref: `refs/tags/${tag}`,
    object: { type, sha }
  }
})
const absent = (): GitHubTagResponse => ({ status: 404, body: {} })

const boundary = (input: {
  readonly reads: ReadonlyArray<GitHubTagResponse | Error>
  readonly create?: GitHubTagResponse | Error
}) => {
  const reads = [...input.reads]
  let createCalls = 0
  let readCalls = 0
  const implementation: GitHubTagBoundary = {
    read: async () => {
      readCalls += 1
      const next = reads.shift() ?? absent()
      if (next instanceof Error) throw next
      return next
    },
    create: async (ref, sha) => {
      createCalls += 1
      expect(ref).toBe(`refs/tags/${tag}`)
      expect(sha).toBe(candidateSha)
      if (input.create instanceof Error) throw input.create
      return input.create ?? { status: 201, body: {} }
    },
    wait: async () => undefined
  }
  return {
    implementation,
    calls: () => ({ create: createCalls, read: readCalls })
  }
}

describe("guarded self-release lightweight tag convergence", () => {
  test("accepts an already-equivalent lightweight tag without mutation", async () => {
    const provider = boundary({ reads: [exact()] })
    expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toEqual({
      schemaVersion: "ts-release/tag-convergence/v1",
      status: "complete",
      result: "already-equivalent",
      tag,
      candidateSha,
      mutationAttempts: 0
    })
    expect(provider.calls()).toEqual({ create: 0, read: 1 })
  })

  test("creates at most once and requires an exact post-mutation reread", async () => {
    const provider = boundary({ reads: [absent(), exact()], create: { status: 201, body: {} } })
    expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toMatchObject({
      status: "complete",
      result: "created-and-observed",
      mutationAttempts: 1
    })
    expect(provider.calls()).toEqual({ create: 1, read: 2 })
  })

  test("accepts a 422 race only when reread proves exact equivalence", async () => {
    const provider = boundary({ reads: [absent(), exact()], create: { status: 422, body: {} } })
    expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toMatchObject({
      status: "complete",
      result: "converged-after-conflict",
      mutationAttempts: 1
    })
    expect(provider.calls().create).toBe(1)
  })

  test("classifies a wrong commit or annotated tag as a conflict and never mutates", async () => {
    for (const response of [exact("d".repeat(40)), exact(candidateSha, "tag")]) {
      const provider = boundary({ reads: [response] })
      expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toMatchObject({
        status: "conflict",
        mutationAttempts: 0
      })
      expect(provider.calls().create).toBe(0)
    }
  })

  test("fails closed before mutation when the initial provider read throws", async () => {
    const provider = boundary({ reads: [new Error("read transport unavailable")] })
    expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toMatchObject({
      status: "uncertain",
      result: "observation-inconclusive",
      mutationAttempts: 0
    })
    expect(provider.calls()).toEqual({ create: 0, read: 1 })
  })

  test("recovers from lost mutation response only by rereading, never resubmitting", async () => {
    const provider = boundary({ reads: [absent(), absent(), exact()], create: new Error("response lost") })
    expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toMatchObject({
      status: "complete",
      result: "created-and-observed",
      mutationAttempts: 1
    })
    expect(provider.calls()).toEqual({ create: 1, read: 3 })
  })

  test("keeps rereading after a post-dispatch read exception and never resubmits", async () => {
    const provider = boundary({
      reads: [absent(), new Error("first reread lost"), exact()],
      create: { status: 201, body: {} }
    })
    expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toMatchObject({
      status: "complete",
      result: "created-and-observed",
      mutationAttempts: 1
    })
    expect(provider.calls()).toEqual({ create: 1, read: 3 })
  })

  test("reports an unknown outcome after response loss and bounded absence without blind resubmission", async () => {
    const provider = boundary({ reads: [absent(), ...Array.from({ length: 6 }, absent)], create: new Error("response lost") })
    expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toMatchObject({
      status: "uncertain",
      result: "outcome-unknown",
      mutationAttempts: 1
    })
    expect(provider.calls()).toEqual({ create: 1, read: 7 })
  })

  test("a rejected create that remains absent is retryable only by a fresh authorized dispatch", async () => {
    const provider = boundary({ reads: [absent(), ...Array.from({ length: 6 }, absent)], create: { status: 422, body: {} } })
    expect(await convergeSelfReleaseTag({ tag, candidateSha }, provider.implementation)).toMatchObject({
      status: "conflict",
      result: "provider-rejected",
      mutationAttempts: 1
    })
    expect(provider.calls()).toEqual({ create: 1, read: 7 })
  })
})
