import * as Effect from "effect/Effect"
import { realpathSync, statSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import type { ReleaseApiServices } from "./types.js"
import type { ReleaseApiPhase } from "./errors.js"
import { ReleaseApiError } from "./errors.js"
import {
  ExecutionTopologyHash,
  OperationId,
  WorkspaceRoot
} from "../model/primitives.js"
import { ExecutionScope } from "../model/run.js"
import type { ExecutionScopeInput, ExecutionTopology } from "./types.js"

export type ApiRun = <A, E>(
  phase: ReleaseApiPhase,
  effect: Effect.Effect<A, E, ReleaseApiServices>
) => Promise<A>

export const exact = (
  phase: ReleaseApiPhase,
  value: unknown,
  keys: ReadonlyArray<string>,
  label: string
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReleaseApiError(phase, `${label} must be an object.`)
  }
  const record = value as Record<string, unknown>
  const excess = Object.keys(record).filter((key) => !keys.includes(key))
  if (excess.length > 0) {
    throw new ReleaseApiError(phase, `${label} has excess field ${excess[0]}.`)
  }
  return record
}

export const workspace = (phase: ReleaseApiPhase, value: string): WorkspaceRoot => {
  if (!isAbsolute(value) || value.length === 0) {
    throw new ReleaseApiError(phase, "Workspace must be a nonempty absolute path.")
  }
  const canonical = realpathSync(value)
  if (!statSync(canonical).isDirectory()) {
    throw new ReleaseApiError(phase, "Workspace must be a directory.")
  }
  return WorkspaceRoot.make(canonical)
}

export const within = (root: string, value: string): string => {
  const path = isAbsolute(value) ? resolve(value) : resolve(root, value)
  const child = relative(root, path)
  if (child === ".." || child.startsWith(`..${sep}`)) {
    throw new ReleaseApiError("apply", "Run path must remain inside the workspace.")
  }
  return path
}

export const topology = (value?: ExecutionTopology): ExecutionTopologyHash => {
  if (value !== undefined) {
    exact("review", value, ["id"], "topology")
    if (value.id.length === 0) {
      throw new ReleaseApiError("review", "Topology id must be nonempty.")
    }
  }
  return ExecutionTopologyHash.make(value?.id ?? "single-machine/v1")
}

export const selectScope = (
  accepted: {
    readonly operationHashes: ReadonlyArray<{ readonly operationId: string }>
    readonly dependencies: ReadonlyArray<{
      readonly operationId: string
      readonly producerId: string
    }>
  },
  input: ExecutionScopeInput
): ExecutionScope => {
  const available = accepted.operationHashes.map(({ operationId }) => operationId)
  const requested = input === "all"
    ? available
    : exact("review", input, ["operationIds"], "scope").operationIds
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new ReleaseApiError("review", "Execution scope must be nonempty.")
  }
  const ids = [...new Set(requested.map(String))]
  if (ids.some((id) => !available.includes(id))) {
    throw new ReleaseApiError("review", "Execution scope names an unknown operation.")
  }
  const selected = new Set(ids)
  if (accepted.dependencies.some((edge) =>
    selected.has(edge.operationId) && !selected.has(edge.producerId))) {
    throw new ReleaseApiError("review", "Execution scope is not dependency-closed.")
  }
  return ExecutionScope.make({
    operationIds: available.filter((id) => selected.has(id)).map((id) => OperationId.make(id))
  })
}
