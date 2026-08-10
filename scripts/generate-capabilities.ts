import { cwd } from "node:process"
import { generateCapabilityOutput } from "./lib/capabilities.js"

generateCapabilityOutput(cwd())
console.log("Generated docs/capabilities.md from the executable registry and evidence.")
