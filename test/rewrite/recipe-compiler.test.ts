import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decodeConfig } from "../../src/rewrite/config/config.js"
import {
  NonEmptyName,
  WorkspaceRoot
} from "../../src/rewrite/model/primitives.js"
import {
  Invocation,
  compilePlan,
  recipeDefinitions
} from "../../src/rewrite/plan/compiler.js"
import {
  lowerProfile,
  profileRegistry
} from "../../src/rewrite/recipes/definition.js"

const root = process.cwd()
const fixture = JSON.parse(readFileSync(join(
  root,
  "test/fixtures/rewrite/plan-v6/minimal.json"
), "utf8")) as unknown
const invocation = (workspace: string) => Invocation.make({
  workspace: WorkspaceRoot.make(workspace),
  commit: NonEmptyName.make("abc123"),
  snapshot: false
})
const failConfig = (value: unknown) =>
  Effect.runPromise(decodeConfig(value).pipe(Effect.flip))

describe("pure v6 recipe compiler", () => {
  test("direct and JSON-parsed values at different roots have identical bytes and PlanId", async () => {
    const direct = await Effect.runPromise(compilePlan(fixture, invocation("/workspace-a")))
    const parsed = await Effect.runPromise(compilePlan(
      JSON.parse(JSON.stringify(fixture)),
      invocation("/workspace-b")
    ))
    expect(direct.bytes).toEqual(parsed.bytes)
    expect(direct.planId).toBe(parsed.planId)
    expect(String(direct.plan.identity.commit)).toBe("abc123")
    expect(new TextDecoder().decode(direct.bytes)).not.toContain("workspace")
  })

  test("strict value boundary rejects strings, configPath, excess nesting, and runtime values", async () => {
    expect((await failConfig("release.json"))._tag).toBe("ConfigValueError")
    expect((await failConfig({ ...(fixture as object), configPath: "release.json" }))._tag)
      .toBe("ConfigDecodeError")
    for (const key of ["profiles", "adapters", "renderer", "authority", "stage", "risk"]) {
      expect((await failConfig({ ...(fixture as object), [key]: {} }))._tag)
        .toBe("ConfigDecodeError")
    }
    class RuntimeValue {}
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    for (const value of [
      () => undefined,
      Symbol("x"),
      1n,
      new Date(),
      new RuntimeValue(),
      undefined,
      Number.NaN,
      1.5,
      -0,
      Array(2),
      cycle
    ]) {
      expect((await failConfig(value))._tag).toBe("ConfigValueError")
    }
  })

  test("lowers current-shaped artifacts and checksum in deterministic order", async () => {
    const config = await Effect.runPromise(decodeConfig(fixture))
    const definitions = recipeDefinitions(config)
    expect(definitions.map((definition) => definition._tag)).toEqual([
      "StaticOutputRecipe",
      "DigestRecipe"
    ])
    const accepted = await Effect.runPromise(compilePlan(fixture, invocation("/workspace")))
    expect(accepted.plan.stages.build.map((operation) => operation._tag)).toEqual(["Check"])
    expect(accepted.plan.stages.process.map((operation) => operation._tag)).toEqual(["Digest"])
    expect(accepted.plan.stages.publish).toEqual([])
    expect(accepted.plan.annotations).toEqual([])
  })

  test("absent recipes contribute nothing", async () => {
    const empty = {
      project: { name: "empty", version: "1.0.0", tag: "v1.0.0" },
      publish: {}
    }
    const accepted = await Effect.runPromise(compilePlan(empty, invocation("/workspace")))
    expect(accepted.operationHashes).toEqual([])
    expect(accepted.outputs).toEqual([])
  })

  test("profile registry is closed Product data and lowering copies the complete value", () => {
    expect(Object.isFrozen(profileRegistry)).toBe(true)
    expect(Object.keys(profileRegistry)).toEqual(["http.generic-upload/v1"])
    const first = lowerProfile("http.generic-upload/v1")
    const second = lowerProfile("http.generic-upload/v1")
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first).toMatchObject({
      profileId: "http.generic-upload/v1",
      contractFixtureId: "contract.http.generic-upload/v1",
      responseShapeId: "empty-v1",
      commitment: "status-2xx",
      reconciliation: "get-same-resource"
    })
    expect(profileRegistry).not.toHaveProperty("register")
  })
})
