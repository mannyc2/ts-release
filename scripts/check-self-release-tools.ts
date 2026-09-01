import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildSelfReleaseTool,
  selfReleaseToolEntries,
  selfReleaseToolOutputs,
  type SelfReleaseTool
} from "./build-self-release-tools.js"

const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const expectedDigestPattern = /^[a-f0-9]{64}$/u
const bootstrap = readFileSync("apps/release-ts/scripts/bootstrap-self-release-tools.sh", "utf8")
const scratch = mkdtempSync(join(tmpdir(), "ts-release-release-tools-"))

try {
  for (const tool of Object.keys(selfReleaseToolEntries) as ReadonlyArray<SelfReleaseTool>) {
    const checked = readFileSync(selfReleaseToolOutputs[tool])
    const generatedPath = join(scratch, `${tool}.js`)
    await buildSelfReleaseTool(tool, generatedPath)
    const generated = readFileSync(generatedPath)
    if (checked.length !== generated.length || checked.some((byte, index) => byte !== generated[index])) {
      throw new Error(`Checked-in ${tool} self-release tool differs from a canonical rebuild.`)
    }
    const matched = new RegExp(`^${tool.replace("-", "_").toUpperCase()}_SHA256=([a-f0-9]{64})$`, "mu").exec(bootstrap)
    if (matched?.[1] === undefined || !expectedDigestPattern.test(matched[1]) || matched[1] !== digest(checked)) {
      throw new Error(`Bootstrap digest for ${tool} does not bind the checked-in tool.`)
    }
  }
  console.log(`Self-release bootstrap binds ${Object.keys(selfReleaseToolEntries).length} canonical repository-owned tool bundles.`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
