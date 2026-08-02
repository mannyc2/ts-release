import { cwd, exit } from "node:process"
import { checkTreeShaking } from "./lib/tree-shaking.js"

const report = checkTreeShaking(cwd())

if (report.failures.length > 0) {
  console.error("Tree-shaking boundary checks failed:")
  for (const failure of report.failures) {
    console.error(`- ${failure}`)
  }
  exit(1)
}

console.log(`tree shaking: ${report.filesExamined} files examined`)
