import { Effect, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import { Content } from "../../../packages/ts-release/src/Bundle.js"
import { fileContentOwner } from "../../../packages/ts-release/src/Node.js"

const [directory, sha256] = process.argv.slice(2) as [string, string]
const owner = fileContentOwner(directory)
const content = new Content({ bytes: "1", sha256 })
const source: Artifact.HashedFile = {
  _tag: "HashedFile",
  path: Schema.decodeUnknownSync(Artifact.AbsolutePath)(`${directory}/${sha256}`),
  bytes: Artifact.decimalBytes("1"),
  digest: Artifact.sha256Digest(sha256),
  provenance: Artifact.intrinsicProvenance("fifo-negative-fixture"),
  publication: { scope: "file", commit: "same-parent-no-replace-link", committed: true },
}
let rejected = 0
for (const effect of [owner.read(content), owner.verify(content), owner.putFileOwned(source)]) {
  if (await Effect.runPromise(Effect.isFailure(effect))) rejected++
}
if (rejected !== 3) process.exit(1)
console.log(JSON.stringify({ rejected }))
