import { describe, expect, it } from "@effect/bun-test"
import { platformTargetVariant } from "../src/pipeline/platform.js"
import { renderArtifactName, UnresolvedTemplateToken } from "../src/pipeline/template.js"
import { makePipelineIdentity } from "./helpers.js"
const identity = makePipelineIdentity()
describe("artifact-name template tokens", () => {
  it("renders present tokens, rejects absent vocabulary tokens, and preserves unknown tokens", () => expect([renderArtifactName("{os}_{arch}", { identity, platform: platformTargetVariant("linux-x64") }), renderArtifactName("{os}", { identity }), renderArtifactName("{libc}", { identity, platform: platformTargetVariant("darwin-x64") }), renderArtifactName("{name}_{version}", { identity }), renderArtifactName("{weird}", { identity })]).toEqual(["linux_amd64", UnresolvedTemplateToken.make({ token: "{os}", value: "{os}" }), UnresolvedTemplateToken.make({ token: "{libc}", value: "{libc}" }), "release_0.1.0", "{weird}"]))
})
