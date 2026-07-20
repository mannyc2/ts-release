// Invariant: explicit artifact ids preserve their order; defaults preserve inventory order.
import * as Effect from "effect/Effect"
import type { Artifact } from "../grammar/artifact.js"
import { PlanError } from "../grammar/errors.js"

export const selectByIdsOrDefault = Effect.fn("features.selectByIdsOrDefault")(function*(
  ids: ReadonlyArray<string> | undefined,
  artifacts: ReadonlyArray<Artifact>,
  defaultPredicate: (artifact: Artifact) => boolean,
  options: {
    readonly source?: { readonly pipeId: string; readonly field: string; readonly target: string } | undefined
    readonly limit?: number | undefined
  } = {}
) {
  const source = options.source
  if (ids !== undefined) return source === undefined
    ? artifacts.filter(({ id }) => ids.includes(id))
    : yield* Effect.forEach(ids, (id) => {
        const artifact = artifacts.find((candidate) => candidate.id === id)
        return artifact === undefined
          ? Effect.fail(PlanError.make({
              pipeId: source.pipeId,
              field: source.field,
              reason: `${source.target} target references missing artifact ${id}.`
            }))
          : Effect.succeed(artifact)
      })
  const selected = artifacts.filter(defaultPredicate)
  return options.limit === undefined ? selected : selected.slice(0, options.limit)
})
