import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { operationEntries } from "../../src/model/validate.js"

const accepted = async (rowId: string) => {
  const fixture = await Bun.file("test/fixtures/parity/configs/supply-chain/configs.json").json()
  const config = fixture.fixtures.find((item: any) => item.rowId === rowId).config
  return Effect.runPromise(compilePlan(config, Invocation.make({
    workspace: WorkspaceRoot.make("/supply-chain-fixture"),
    commit: NonEmptyName.make("0123456789abcdef"), snapshot: false
  })))
}

describe("supply-chain report lowering", () => {
  test("lowers SBOM generation only through the frozen local profile", async () => {
    const operations = operationEntries((await accepted("C052")).plan).map(({ operation }) => operation)
    const operation = operations.find((item) => item.id === "supply:local:c052")
    expect(operation?._tag).toBe("Exec")
    if (operation?._tag !== "Exec") throw new Error("SBOM profile was not local execution.")
    expect(operation.contractFixtureId).toBe("contract.supply.local-sbom.v1")
    expect(operation.inputs.map(String)).toEqual(["input"])
    expect(operation.outputs.map(({ kind }) => kind)).toEqual(["sbom"])
  })

  test("observes size from the imported materialized path without a tool profile", async () => {
    const operations = operationEntries((await accepted("C053")).plan).map(({ operation }) => operation)
    const operation = operations.find((item) => item.id === "supply:size:c053")
    expect(operation?._tag).toBe("Check")
    expect(operation?.inputs.map(String)).toEqual(["input"])
    expect(operation?.outputs).toEqual([])
    expect(operations.some((item) => item._tag === "Exec")).toBeFalse()
  })
})
