import { describe, expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import { VerifiedContentHandle } from "../../src/drivers/services.js"
import { Digest, OutputId, SnapshotId } from "../../src/model/primitives.js"
import { MaterializedOutput, ObservedSubject, observedSubject } from "../../src/model/run.js"

describe("observed supply-chain digest subjects", () => {
  test("bind nonempty materialized snapshot facts and exact verified bytes", () => {
    const bytes = new TextEncoder().encode("reviewed")
    const facts = MaterializedOutput.make({
      outputId: OutputId.make("artifact"), snapshotId: SnapshotId.make("snapshot"),
      digest: Digest.make("e4f934f321eb76c9bf8b5103e0a0d9afe72d6e62ace3d3ea849790619bf7487a"),
      size: bytes.length, inode: 1
    })
    expect(observedSubject(facts)).toEqual(ObservedSubject.make({
      outputId: facts.outputId, snapshotId: facts.snapshotId, digest: facts.digest, size: facts.size
    }))
    expect(VerifiedContentHandle.from(facts, bytes).bytes).toEqual(bytes)
    expect(() => VerifiedContentHandle.from(facts, new TextEncoder().encode("drift"))).toThrow()
    expect(() => Schema.decodeUnknownSync(ObservedSubject)({
      ...observedSubject(facts), digest: ""
    })).toThrow()
  })
})
