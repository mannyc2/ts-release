import { cwd, exit } from "node:process"
import { certifyAdvertisedBunTargets } from "./lib/bun-targets.js"
import { checkCapabilityOutput } from "./lib/capabilities.js"

const report = checkCapabilityOutput(cwd())
const targetReport = report.failures.length === 0
  ? certifyAdvertisedBunTargets(cwd())
  : { failures: [] as ReadonlyArray<string>, results: [] }
const failures = [...report.failures, ...targetReport.failures]
if (failures.length > 0) {
  console.error(`Capability checks failed:\n${failures.map((line) => `- ${line}`).join("\n")}`)
  exit(1)
}
console.log(
  `capabilities: ${report.capabilities} executable entries and ` +
  `${targetReport.results.length} Bun artifact targets checked`
)
