// The editor-support artifact, generated from AuthoredConfig — the shape a
// human actually writes. It is committed rather than published from a build so
// that `$schema` in a template resolves for anyone reading the repository, and
// check:config-schema regenerates and byte-compares it (the action-bundle
// freshness pattern), so it cannot drift from the schema it describes.
import * as Schema from "effect/Schema"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { cwd } from "node:process"
import { AuthoredConfig } from "../src/resolve/authored.js"

export const configSchemaPath = join(cwd(), "schema", "release-config.schema.json")

export const renderConfigSchema = (): string => {
  const document = Schema.toJsonSchemaDocument(AuthoredConfig)
  return `${
    JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://raw.githubusercontent.com/mannyc2/ts-release/main/schema/release-config.schema.json",
      title: "ts-release configuration",
      description:
        "The authored configuration: the canonical shape with the facts a repository can observe made optional. ts-release resolves it against the repository during inspect, prepare, publish, or release.",
      ...document.schema,
      $defs: document.definitions
    }, null, 2)
  }\n`
}

if (import.meta.main) {
  mkdirSync(dirname(configSchemaPath), { recursive: true })
  writeFileSync(configSchemaPath, renderConfigSchema())
  console.log(`Generated ${configSchemaPath.slice(cwd().length + 1)} from AuthoredConfig.`)
}
