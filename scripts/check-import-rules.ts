import { cwd, exit } from "node:process"
import { checkImportRules } from "./lib/import-rules.js"

const report = checkImportRules(cwd())

if (report.failures.length > 0) {
  console.error("Import rule checks failed:")
  for (const item of report.failures) {
    console.error(`- ${item}`)
  }
  exit(1)
}

console.log(`import rules: ${report.filesExamined} files examined`)
