import { describe, expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { Operation, ProviderPublish, PublishCredential } from "../../src/model/operation.js"
import {
  CheckpointId, CredentialName, OperationId, OutputId, ProfileId
} from "../../src/model/primitives.js"
import { objectStoreProfiles } from "../../src/recipes/providers/object-store-profiles.js"

describe("closed object-store publication", () => {
  test("matches frozen profiles and rejects transport injection", async () => {
    const fixture = await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/providers/profiles.json"
    ).json()
    for (const profile of objectStoreProfiles) {
      const frozen = fixture.profiles.find((item: any) => item.profileId === profile.profileId)
      expect(canonicalJsonHash(profile.contract)).toBe(canonicalJsonHash(frozen.contract))
    }
    const profile = objectStoreProfiles[0]!
    const operation = ProviderPublish.make({
      id: OperationId.make("object"), inputs: [OutputId.make("binary")], outputs: [],
      profileId: ProfileId.make(profile.profileId), target: { bucket: "release", key: "fixture" },
      options: {}, dnsScope: "PublicOnly", checkpoints: [CheckpointId.make("put")],
      variant: profile.contract.variant,
      credential: PublishCredential.make({ name: CredentialName.make("OBJECT_STORE") }),
      contractFixtureId: profile.contractFixtureId
    })
    expect(Schema.decodeUnknownSync(Operation)(operation)._tag).toBe("ProviderPublish")
    expect(() => Schema.decodeUnknownSync(Operation, { onExcessProperty: "error" })({
      ...operation, endpoint: "https://injected.invalid"
    })).toThrow()
  })
})
