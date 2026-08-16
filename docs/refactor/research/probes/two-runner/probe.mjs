import { rm } from "node:fs/promises"
import { stateRoot, providerDefinitionFields, dispatchStartedFields } from "./helpers.mjs"
import { beforeSend, responseLoss, providerV2 } from "./scenarios-basic.mjs"
import { casRace, mutatedStop } from "./scenarios-race.mjs"

await rm(stateRoot, { recursive: true, force: true })
const scenarios = {
  beforeSend: await beforeSend(),
  responseLoss: await responseLoss(),
  providerV2: await providerV2(),
  unknownScheme: await mutatedStop("unknown-scheme", (event) => { event.replayProtection.schemeId = "replay.idempotency-key/2" }, "unsupported-replay-scheme"),
  opaqueTransport: await mutatedStop("opaque-transport", (event) => { event.transportId = "provider.opaque/1" }, "unsupported-transport"),
  casRace: await casRace()
}
console.log(`TWO_RUNNER_PROBE_RESULT=${JSON.stringify({
  status: "pass",
  providerDefinitionFields,
  dispatchStartedFields,
  replaySchemeIds: ["replay.none/1", "replay.idempotency-key/1", "replay.cas/1", "replay.exact-duplicate/1"],
  scenarios,
  limitations: [
    "local directory locking is a probe-only CAS seam",
    "the fake remote is not live provider evidence",
    "the probe does not select production TypeScript spelling"
  ]
})}`)
