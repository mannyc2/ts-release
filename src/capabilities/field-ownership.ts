import type {
  CapabilityId,
  CapabilityModule,
  FieldEffect
} from "./module.js"

export interface ConfigFieldOwnership {
  readonly path: string
  readonly owner: CapabilityId | "authoring"
  readonly effect: FieldEffect
}

export interface FieldOwnershipReport {
  readonly rows: ReadonlyArray<ConfigFieldOwnership>
  readonly failures: ReadonlyArray<string>
}

/**
 * Exact join between the generated authored schema paths and executable
 * modules. Prefix matches are intentionally forbidden: a broad `publish`
 * entry cannot accidentally claim npm authentication fields.
 */
export const validateFieldOwnership = (
  schemaPaths: ReadonlyArray<string>,
  modules: ReadonlyArray<CapabilityModule>
): FieldOwnershipReport => {
  const failures: Array<string> = []
  const assignments = new Map<string, Array<ConfigFieldOwnership>>()

  for (const module of modules) {
    for (const field of module.fields) {
      const rows = assignments.get(field.path) ?? []
      rows.push({ path: field.path, owner: module.id, effect: field.effect })
      assignments.set(field.path, rows)
    }
  }
  assignments.set("$schema", [{
    path: "$schema",
    owner: "authoring",
    effect: "authoring-only"
  }])

  const schema = new Set(schemaPaths)
  for (const path of schemaPaths) {
    const owners = assignments.get(path) ?? []
    if (owners.length === 0) failures.push(`public config field has no canonical owner: ${path}`)
    if (owners.length > 1) {
      failures.push(`public config field has multiple canonical owners: ${path} (${owners.map((row) => row.owner).join(", ")})`)
    }
  }
  for (const path of assignments.keys()) {
    if (!schema.has(path)) failures.push(`field ownership names no public config field: ${path}`)
  }

  const rows = schemaPaths.flatMap((path) => {
    const assignment = assignments.get(path)
    return assignment?.length === 1 ? assignment : []
  })
  return { rows, failures }
}
