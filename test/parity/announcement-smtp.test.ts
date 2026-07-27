import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { checkpointIds } from "../../src/apply/ledger.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { smtpAnnouncementProfile } from "../../src/recipes/announcement-profiles.js"

describe("closed SMTP announcement", () => {
  test("matches its distinct contract and lowers reviewed note bytes once", async () => {
    const frozen = await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/announce/profiles.json"
    ).json()
    const contract = frozen.profiles.find((item: any) => item.profileId === "announce.smtp/v1")
    expect(canonicalJsonHash(smtpAnnouncementProfile.contract)).toBe(canonicalJsonHash(contract.contract))
    const fixtures = await Bun.file(
      "test/fixtures/parity/configs/changelog-announce/configs.json"
    ).json()
    const config = fixtures.fixtures.find((item: any) => item.rowId === "C097").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/announcement-smtp"),
      commit: NonEmptyName.make("commit"), snapshot: false
    })))
    const operation = accepted.plan.stages.announce[0]!
    expect(operation._tag).toBe("SmtpPublish")
    if (operation._tag !== "SmtpPublish") return
    expect(operation.inputs.map(String)).toEqual(["release-notes"])
    expect(operation.target).toEqual({ destination: "fixture-channel" })
    expect(checkpointIds(operation).map(String)).toEqual(["message"])
    expect(smtpAnnouncementProfile.contract.reconciliation.supported).toBeFalse()
  })
})
