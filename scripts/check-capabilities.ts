import { cwd, exit } from "node:process"
import { checkCapabilityOutput } from "./lib/capabilities.js"

const report = checkCapabilityOutput(cwd())
if (report.failures.length > 0) {
  console.error(`Capability checks failed:\n${report.failures.map((line) => `- ${line}`).join("\n")}`)
  exit(1)
}
console.log(`capabilities: ${report.capabilities} executable entries checked`)
