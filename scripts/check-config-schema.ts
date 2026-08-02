// The committed schema must be what AuthoredConfig produces today. A schema
// that describes last month's config is worse than none: an editor would
// green-light a field the decoder refuses.
import { existsSync, readFileSync } from "node:fs"
import { cwd, exit } from "node:process"
import { configSchemaPath, renderConfigSchema } from "./generate-config-schema.js"

const relative = configSchemaPath.slice(cwd().length + 1)
const stale = "Run `bun run generate:config-schema` and commit the result."

if (!existsSync(configSchemaPath)) {
  console.error(`${relative} is missing. ${stale}`)
  exit(1)
}
if (readFileSync(configSchemaPath, "utf8") !== renderConfigSchema()) {
  console.error(`${relative} is stale. ${stale}`)
  exit(1)
}
console.log(`${relative} matches AuthoredConfig.`)
