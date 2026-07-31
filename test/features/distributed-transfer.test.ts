import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "@effect/bun-test"
import { attestLedger } from "../../src/apply/trust.js"
import { transition } from "../../src/apply/transition.js"
import { deriveTransfer, verifyTransferredFiles } from "../../src/apply/transfer.js"
import {
  Digest, OperationId, OutputId, SnapshotId
} from "../../src/model/primitives.js"
import type { RunLedger } from "../../src/model/run.js"
import { distributedFixture } from "./distributed-fixture.js"

const passed = async (bytes: Uint8Array) => {
  const fixture = await distributedFixture()
  const move = (ledger: RunLedger, command: Parameters<typeof transition>[2]) => {
    const result = transition(fixture.plan, ledger, command)
    if ("_tag" in result) throw result
    return result
  }
  let ledger = move(fixture.ledger, {
    _tag: "BeginTrustedExec", operationId: OperationId.make("trusted"), at: "now"
  })
  ledger = move(ledger, {
    _tag: "Pass", operationId: OperationId.make("trusted"), detail: "built",
    outputs: [{
      outputId: OutputId.make("processed"), snapshotId: SnapshotId.make("snapshot"),
      digest: Digest.make(createHash("sha256").update(bytes).digest("hex")),
      size: bytes.length, inode: 1
    }]
  })
  return {
    ...fixture,
    ledger: await attestLedger(ledger, "worker", fixture.pair.privateKey)
  }
}

describe("donor-ledger-derived content transfer", () => {
  test("rehashes the exact authenticated transfer set after relocation", async () => {
    const bytes = new TextEncoder().encode("portable bytes")
    const { plan, ledger } = await passed(bytes)
    const root = mkdtempSync(join(tmpdir(), "ts-release-transfer-"))
    try {
      mkdirSync(join(root, "dist"))
      writeFileSync(join(root, "dist/processed"), bytes)
      expect(await deriveTransfer(plan, ledger)).toEqual([{
        outputId: "processed", path: "dist/processed", size: bytes.length,
        digest: createHash("sha256").update(bytes).digest("hex")
      }])
      await expect(verifyTransferredFiles(plan, ledger, root, ["dist/processed"]))
        .resolves.toHaveLength(1)
      await expect(verifyTransferredFiles(plan, ledger, root, ["dist/processed", "extra"]))
        .rejects.toThrow()
      writeFileSync(join(root, "dist/processed"), "drift")
      await expect(verifyTransferredFiles(plan, ledger, root, ["dist/processed"]))
        .rejects.toThrow()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("rejects symlinked receiver content", async () => {
    const bytes = new TextEncoder().encode("portable bytes")
    const { plan, ledger } = await passed(bytes)
    const root = mkdtempSync(join(tmpdir(), "ts-release-transfer-link-"))
    try {
      mkdirSync(join(root, "dist"))
      writeFileSync(join(root, "target"), bytes)
      symlinkSync(join(root, "target"), join(root, "dist/processed"))
      await expect(verifyTransferredFiles(plan, ledger, root, ["dist/processed"]))
        .rejects.toThrow()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
