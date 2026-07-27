import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"

describe("deterministic npm platform wrappers", () => {
  test("materialize exact wrapper bytes and reuse the npm publisher", async () => {
    const fixtures = (await Bun.file(
      "test/fixtures/parity/configs/providers/configs.json"
    ).json()).fixtures
    for (const rowId of ["C071", "P005"]) {
      const config = fixtures.find((item: any) => item.rowId === rowId).config
      const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
        workspace: WorkspaceRoot.make("/provider-npm"), commit: NonEmptyName.make("commit"), snapshot: false
      })))
      const write = accepted.plan.stages.process.find((operation) =>
        operation._tag === "Write" && operation.outputs.some((output) => output.id === "npm-package"))
      expect(write?._tag).toBe("Write")
      if (write?._tag === "Write") expect(write.content).toBe(
        `{"name":"@owner/fixture","version":"1.0.0","artifacts":["dist/fixture"]}\n`
      )
      expect(accepted.plan.stages.publish.some((operation) =>
        operation._tag === "PackageRegistryRelease" && operation.registryKind === "npm")).toBeTrue()
    }
  })
})
