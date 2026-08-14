import type { ArtifactClient } from "@actions/artifact"
import { expect, test } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import {
  decodeArtifactBridgeRequest,
  executeArtifactBridgeRequest,
  makeNodeArtifactBridgeTransport,
  type ArtifactBridgeRequest,
  type ArtifactBridgeSpawnInput
} from "../apps/ts-release-action/src/artifact-bridge.js"
import { makeActionsArtifactTransport } from "../apps/ts-release-action/src/artifact-client.js"
import type { ActionArtifactFindBy, ActionArtifactTransport } from "../apps/ts-release-action/src/prepared-store.js"

test("native artifact client normalizes official upload metadata before the bridge", async () => {
  const artifacts = makeActionsArtifactTransport({
    uploadArtifact: async () => ({ id: 17, digest: "a".repeat(64), size: 776_269_773 })
  } as unknown as ArtifactClient)

  expect(await artifacts.upload({
    name: "prepared", files: ["/fixture/source"], rootDirectory: "/fixture"
  })).toEqual({ id: 17, digest: "a".repeat(64) })
})

test("native artifact bridge protocol never serializes the GitHub token", async () => {
  const calls: Array<{ readonly spawn: ArtifactBridgeSpawnInput, readonly request: ArtifactBridgeRequest }> = []
  const token = "github-token-sentinel"
  const transport = makeNodeArtifactBridgeTransport({
    nodeExecutable: "/fixture/node",
    bridgePath: "/fixture/artifact-bridge.cjs",
    environment: { GITHUB_TOKEN: token, ACTIONS_RUNTIME_TOKEN: "runtime-token-sentinel" },
    spawn: (input) => {
      const request = decodeArtifactBridgeRequest(JSON.parse(readFileSync(input.argv[1]!, "utf8")))
      calls.push({ spawn: input, request })
      const output = request.operation === "upload"
        ? { id: 17, digest: "a".repeat(64) }
        : { path: request.destination, digestMismatch: false }
      writeFileSync(input.argv[2]!, `${JSON.stringify({ ok: true, output })}\n`)
      return 0
    }
  })

  expect(await transport.upload({
    name: "prepared", files: ["/fixture/source"], rootDirectory: "/fixture"
  })).toEqual({ id: 17, digest: "a".repeat(64) })
  const findBy: ActionArtifactFindBy = {
    token,
    workflowRunId: "1234",
    repositoryOwner: "owner",
    repositoryName: "repository"
  }
  expect(await transport.download({
    name: "prepared", destination: "/fixture/destination", findBy
  })).toEqual({ path: "/fixture/destination", digestMismatch: false })

  expect(calls).toHaveLength(2)
  expect(calls.every(({ spawn }) => spawn.executable === "/fixture/node" &&
    spawn.argv[0] === "/fixture/artifact-bridge.cjs")).toBe(true)
  expect(JSON.stringify(calls.map(({ request }) => request))).not.toContain(token)
  expect(calls[1]?.request).toEqual({
    operation: "download",
    name: "prepared",
    destination: "/fixture/destination",
    findBy: {
      workflowRunId: "1234",
      repositoryOwner: "owner",
      repositoryName: "repository"
    }
  })
})

test("native artifact bridge reconstructs cross-run authority only at the Node sink", async () => {
  const calls: ActionArtifactFindBy[] = []
  const artifacts: ActionArtifactTransport = {
    upload: async () => ({ id: 1, digest: "a".repeat(64) }),
    download: async ({ destination, findBy }) => {
      if (findBy !== undefined) calls.push(findBy)
      return { path: destination, digestMismatch: false }
    }
  }
  const request = decodeArtifactBridgeRequest({
    operation: "download",
    name: "prepared",
    destination: "/fixture/destination",
    findBy: {
      workflowRunId: "1234",
      repositoryOwner: "owner",
      repositoryName: "repository"
    }
  })
  await executeArtifactBridgeRequest(request, artifacts, { GITHUB_TOKEN: "token-at-node-sink" })
  expect(calls).toEqual([{
    token: "token-at-node-sink",
    workflowRunId: "1234",
    repositoryOwner: "owner",
    repositoryName: "repository"
  }])
  expect(() => decodeArtifactBridgeRequest({ ...request, token: "forbidden" })).toThrow("unexpected shape")
  await expect(executeArtifactBridgeRequest(request, artifacts, {})).rejects.toThrow("requires GITHUB_TOKEN")
})

test("native artifact bridge propagates only canonical response data", async () => {
  const transport = makeNodeArtifactBridgeTransport({
    nodeExecutable: "/fixture/node",
    bridgePath: "/fixture/artifact-bridge.cjs",
    environment: {},
    spawn: ({ argv }) => {
      writeFileSync(argv[2]!, `${JSON.stringify({ ok: false, error: "bridge refused" })}\n`)
      return 1
    }
  })
  await expect(transport.upload({ name: "prepared", files: ["/fixture/file"], rootDirectory: "/fixture" }))
    .rejects.toThrow("bridge refused")
})
