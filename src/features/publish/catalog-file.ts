// Invariant: generic catalog publication derives its git operations solely from the resolved catalog policy.
import * as Effect from "effect/Effect"
import { PlanError } from "../../grammar/errors.js"
import { CommandAction, CommandSpec, Operation } from "../../grammar/operation.js"
import { catalogGitPublishOperations, noAuthCommand, readOnlyCommandValidationOperation } from "./operations.js"
import { featureOperation, featurePlanner } from "../../grammar/planner.js"
import { renderCommandTemplateEffect, renderTemplate } from "../../grammar/template.js"
import { catalogWritePath, type CatalogEntry } from "../catalog/file.js"
const argv = (value: string | ReadonlyArray<string>): ReadonlyArray<string> =>
  typeof value === "string" ? value.trim().split(/\s+/).filter(Boolean) : value
const validation = Effect.fn("catalog.publish.validation")(function*(
  entry: CatalogEntry, identity: Parameters<typeof renderTemplate>[1]["identity"]
) {
  if (entry.validate === undefined) return []
  const rendered = yield* Effect.forEach(argv(entry.validate), (part) => renderCommandTemplateEffect(
    part,
    { identity },
    { pipeId: "publish:catalog", field: `catalogs.${entry.id}.validate` }
  ))
  const executable = rendered[0]
  if (executable === undefined || executable.length === 0) {
    return yield* Effect.fail(PlanError.make({ pipeId: "publish:catalog", field: `catalogs.${entry.id}.validate`,
      reason: "Catalog validate must render to at least one argv entry."
    }))
  }
  return [readOnlyCommandValidationOperation({
    id: `catalog:${entry.id}:validate`,
    description: `Validate ${entry.id} catalog update.`,
    command: noAuthCommand(executable, rendered.slice(1))
  })]
})
const command = (
  id: string, risk: "writes-local" | "externally-visible", description: string,
  executable: string, args: ReadonlyArray<string>, cwd?: string
): Operation => featureOperation({
  id, phase: "publish", risk, description,
  action: CommandAction.make({ command: cwd === undefined ? noAuthCommand(executable, args) :
    CommandSpec.make({ ...noAuthCommand(executable, args), cwd }) })
})
const publishOperations = (
  entry: CatalogEntry, identity: Parameters<typeof renderTemplate>[1]["identity"]
): ReadonlyArray<Operation> => {
  const id = `catalog:${entry.id}:push`
  const directory = entry.directory
  const commitMessage = renderTemplate(entry.commitMessage, { identity })
  const description = `Push ${entry.id} catalog update for ${identity.name}@${identity.version}.`
  const common = { id, pipeId: "publish:catalog", description, directory,
    filePath: catalogWritePath(entry), commitMessage }
  if (entry.submit === "push") return catalogGitPublishOperations(common)
  const branch = `ts-release/${identity.normalizedName}-${identity.version}`
  const git = catalogGitPublishOperations(common)
  return [
    command(`catalog:${entry.id}:checkout`, "writes-local", `Create ${branch}.`, "git",
      ["-C", directory ?? ".", "checkout", "-B", branch]),
    ...git.slice(0, 2),
    command(id, "externally-visible", description, "git", ["-C", directory ?? ".", "push", "-u", "origin", branch]),
    command(`catalog:${entry.id}:pull-request`, "externally-visible", `Open ${entry.id} catalog pull request.`, "gh",
      ["pr", "create", "--repo", entry.repository, "--title", commitMessage, "--body", description, "--head", branch],
      directory ?? ".")
  ]
}
export const publishCatalogGenericPlanner = featurePlanner<ReadonlyArray<CatalogEntry>>(
  "publish:catalog", (entries, state) => Effect.gen(function*() {
    const operations = yield* Effect.forEach(entries, (entry) => validation(entry, state.identity).pipe(
      Effect.map((checks) => [...checks, ...publishOperations(entry, state.identity)])))
    return { operations: operations.flat() }
  }))
