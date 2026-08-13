import { cwd } from "node:process"
import { generateProviderRecoveryOutput } from "./lib/recovery-docs.js"

generateProviderRecoveryOutput(cwd())
console.log("Generated Plan 229 provider recovery documentation from installed publication profiles.")
