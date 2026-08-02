// Thin shell over the predicate: the docs' claims must resolve against the
// code, every time, or the build stops.
import { cwd, exit } from "node:process"
import { checkDocsClaims } from "./lib/docs-claims.js"

const report = checkDocsClaims(cwd())
if (report.failures.length > 0) {
  console.error(`Docs claim checks failed:\n${report.failures.map((line) => `- ${line}`).join("\n")}`)
  exit(1)
}
console.log(`claims: ${report.claims} checked across ${report.files} files`)
