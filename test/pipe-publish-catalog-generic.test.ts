import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { catalogGenericPlanner, type ResolvedCatalogEntry } from "../src/pipes/catalog-generic.js"
import { publishCatalogGenericPlanner } from "../src/pipes/publish-catalog-generic.js"
import type { Operation } from "../src/pipeline/operation.js"
import { schedule } from "../src/pipeline/pipe.js"
import { emptyPlanAccumulator, runPipeline } from "../src/pipeline/runner.js"
import { makePipelineIdentity } from "./helpers.js"
const identity = makePipelineIdentity()
const context = { identity, artifacts: [] }
const entry: ResolvedCatalogEntry = { id: "index", repository: "owner/catalog", directory: "catalog",
  file: "file.json", content: "{}", commitMessage: "Update {name} to {version}", submit: "push" }
const commands = (operations: ReadonlyArray<Operation>) =>
  operations.map(({ action }) => action._tag === "command" ? action.command : undefined)

describe("generic catalog publishing", () => {
  it.effect("reports both absent-section notices", () => Effect.gen(function*() {
    for (const planner of [catalogGenericPlanner, publishCatalogGenericPlanner]) {
      const result = yield* runPipeline(emptyPlanAccumulator(identity), [schedule(planner, Option.none())])
      expect(result.notices).toEqual([{ pipeId: planner.id, severity: "info", reason: "Config section is absent; pipe skipped." }])
    }
  }))

  it.effect("reuses the exact push helper and rejects empty validation argv", () => Effect.gen(function*() {
    const result = yield* publishCatalogGenericPlanner([entry], context)
    expect(result.operations.map(({ id, risk }) => [id, risk])).toEqual([
      ["catalog:index:push:add", "writes-local"], ["catalog:index:push:commit", "writes-local"],
      ["catalog:index:push", "externally-visible"]])
    expect(commands(result.operations).map((value) => value && [value.executable, value.args])).toEqual([
      ["git", ["-C", "catalog", "add", "file.json"]],
      ["git", ["-C", "catalog", "commit", "-m", "Update release to 0.1.0"]],
      ["git", ["-C", "catalog", "push"]]])
    const error = yield* publishCatalogGenericPlanner([{ ...entry, validate: "  " }], context).pipe(Effect.flip)
    expect(error).toMatchObject({ _tag: "PlanError", pipeId: "publish:catalog", field: "catalogs.index.validate" })
  }))

  it.effect("plans validation and the exact six-operation pull-request flow", () => Effect.gen(function*() {
    const result = yield* publishCatalogGenericPlanner([
      { ...entry, submit: "pull-request", validate: "catalog-lint --release {version}" }
    ], context)
    expect(result.operations.map(({ id, risk }) => [id, risk])).toEqual([
      ["catalog:index:validate", "read-only"], ["catalog:index:checkout", "writes-local"],
      ["catalog:index:push:add", "writes-local"], ["catalog:index:push:commit", "writes-local"],
      ["catalog:index:push", "externally-visible"], ["catalog:index:pull-request", "externally-visible"]])
    expect(commands(result.operations)).toMatchObject([
      { executable: "catalog-lint", args: ["--release", "0.1.0"] },
      { executable: "git", args: ["-C", "catalog", "checkout", "-B", "ts-release/release-0.1.0"] },
      { executable: "git", args: ["-C", "catalog", "add", "file.json"] },
      { executable: "git", args: ["-C", "catalog", "commit", "-m", "Update release to 0.1.0"] },
      { executable: "git", args: ["-C", "catalog", "push", "-u", "origin", "ts-release/release-0.1.0"] },
      { executable: "gh", cwd: "catalog", args: ["pr", "create", "--repo", "owner/catalog", "--title",
        "Update release to 0.1.0", "--body", "Push index catalog update for release@0.1.0.", "--head", "ts-release/release-0.1.0"] }
    ])
  }))
})
