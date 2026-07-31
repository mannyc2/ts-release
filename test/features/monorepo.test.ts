import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { operationEntries } from "../../src/model/validate.js"
import {
  NonEmptyName, WorkspaceRoot
} from "../../src/model/primitives.js"
import {
  compilePlan, decodePlanningConfig, Invocation
} from "../../src/plan/compiler.js"

const project = {
  name: "workspace", version: "1.0.0", tag: "v1.0.0"
}
const scope = (id: string, root: string) => ({
  id, root, tagPrefix: `${id}/`,
  execution: { workers: ["linux"], through: "publish" }
})
const config = {
  project,
  projects: [scope("alpha", "packages/alpha"), scope("beta", "packages/beta")],
  artifacts: [{ id: "binary", path: "dist/binary", format: "file" }],
  checksum: { algorithm: "sha256", nameTemplate: "checksums-{version}.txt" },
  publish: {}
}
const invocation = Invocation.make({
  workspace: WorkspaceRoot.make("/workspace"),
  commit: NonEmptyName.make("commit"), snapshot: false
})

describe("one-plan monorepo lowering", () => {
  test("namespaces project operation, output, path, tag, and evidence identity", async () => {
    const first = await Effect.runPromise(compilePlan(config, invocation))
    const second = await Effect.runPromise(compilePlan(structuredClone(config), invocation))
    expect(first.planId).toBe(second.planId)
    expect(operationEntries(first.plan).map(({ operation }) => String(operation.id))).toEqual([
      "alpha:check:artifact:binary", "beta:check:artifact:binary",
      "alpha:digest:checksum", "beta:digest:checksum"
    ])
    expect(first.outputs.map(({ output }) => String(output.id))).toEqual([
      "alpha:binary", "beta:binary", "alpha:checksum", "beta:checksum"
    ])
    expect(first.outputs.map(({ output }) => String(output.path))).toEqual([
      "packages/alpha/dist/binary", "packages/beta/dist/binary",
      "packages/alpha/checksums-1.0.0.txt", "packages/beta/checksums-1.0.0.txt"
    ])
    expect(first.plan.annotations.map((item) => item.key)).toEqual([
      "project.alpha", "project.beta"
    ])
  })

  test("strictly rejects overlapping roots, duplicate ids, and excess project fields", async () => {
    await expect(Effect.runPromise(compilePlan({
      ...config, projects: [scope("alpha", "packages"), scope("beta", "packages/beta")]
    }, invocation))).rejects.toThrow()
    await expect(Effect.runPromise(compilePlan({
      ...config, projects: [scope("alpha", "packages/alpha"), scope("alpha", "packages/beta")]
    }, invocation))).rejects.toThrow()
    await expect(Effect.runPromise(decodePlanningConfig({
      ...config, projects: [{ ...scope("alpha", "packages/alpha"), extra: true }]
    }))).rejects.toThrow()
  })
})
