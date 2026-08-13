import * as Schema from "effect/Schema"
import { AuthoredConfig } from "../../src/resolve/authored.js"

type JsonSchema = Readonly<Record<string, unknown>>

const record = (value: unknown): JsonSchema | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonSchema
    : undefined

const schemas = (value: unknown): ReadonlyArray<JsonSchema> =>
  Array.isArray(value)
    ? value.map(record).filter((item): item is JsonSchema => item !== undefined)
    : []

/**
 * Enumerate every authored JSON property path from the schema that actually
 * powers public decoding. Array items use `[]`; union alternatives are joined
 * and de-duplicated. The traversal follows only local Effect-generated refs,
 * so a field cannot disappear behind a named class definition.
 */
export const authoredConfigPropertyPaths = (): ReadonlyArray<string> => {
  const document = Schema.toJsonSchemaDocument(AuthoredConfig)
  const definitions = document.definitions as Readonly<Record<string, unknown>>
  const paths = new Set<string>()

  const visit = (value: unknown, path: string, references: ReadonlySet<string>): void => {
    const node = record(value)
    if (node === undefined) return

    if (typeof node.$ref === "string" && node.$ref.startsWith("#/$defs/")) {
      const name = node.$ref.slice("#/$defs/".length)
      if (references.has(name)) return
      const target = definitions[name]
      visit(target, path, new Set([...references, name]))
    }

    const properties = record(node.properties)
    if (properties !== undefined) {
      for (const name of Object.keys(properties).sort()) {
        const child = path.length === 0 ? name : `${path}.${name}`
        paths.add(child)
        visit(properties[name], child, references)
      }
    }

    if (node.items !== undefined) visit(node.items, `${path}[]`, references)
    for (const key of ["anyOf", "oneOf", "allOf"] as const) {
      for (const alternative of schemas(node[key])) visit(alternative, path, references)
    }
  }

  visit(document.schema, "", new Set())
  return [...paths].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}
