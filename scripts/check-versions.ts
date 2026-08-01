import { cwd, exit } from "node:process"
import { checkVersions } from "./lib/versions.js"

const report = checkVersions(cwd())

if (report.failures.length > 0) {
  console.error("Version pin checks failed:")
  for (const item of report.failures) {
    console.error(`- ${item}`)
  }
  exit(1)
}

console.log(`versions: ${report.sitesChecked} sites checked`)
