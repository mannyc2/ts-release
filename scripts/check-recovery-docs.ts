import { cwd, exit } from "node:process"
import { checkProviderRecoveryOutput } from "./lib/recovery-docs.js"

const report = checkProviderRecoveryOutput(cwd())
if (report.failures.length > 0) {
  console.error(`Recovery documentation checks failed:\n${report.failures.map((line) => `- ${line}`).join("\n")}`)
  exit(1)
}
console.log(`recovery docs: ${report.profiles} installed publication profiles checked`)
