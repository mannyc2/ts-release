import { rm } from "node:fs/promises"
import { runDevelopmentToolingProbe } from "../development-tooling/probe.mjs"
import { stateRoot, providerDefinitionFields, dispatchStartedFields } from "./helpers.mjs"
import { beforeSend, responseLoss, providerV2 } from "./scenarios-basic.mjs"
import { casRace, mutatedStop } from "./scenarios-race.mjs"
import { runIdentityAlternatives } from "./identity-alternatives.mjs"

await rm(stateRoot, { recursive: true, force: true })
const scenarios = {
  beforeSend: await beforeSend(),
  responseLoss: await responseLoss(),
  strictProviderV2: await providerV2(),
  unknownScheme: await mutatedStop("unknown-scheme", (event) => { event.replayProtection.schemeId = "replay.idempotency-key/2" }, "unsupported-replay-scheme"),
  opaqueTransport: await mutatedStop("opaque-transport", (event) => { event.transportId = "provider.opaque/1" }, "unsupported-transport"),
  casRace: await casRace()
}

console.log(`TWO_RUNNER_PROBE_RESULT=${JSON.stringify({
  status: "pass",
  exercisedSelectedShape: {
    providerDefinitionFields,
    dispatchStartedFields
  },
  identityAlternatives: runIdentityAlternatives(),
  replaySchemeIds: ["replay.none/1", "replay.idempotency-key/1", "replay.cas/1", "replay.exact-duplicate/1"],
  scenarios,
  limitations: [
    "the selected field lists are test inputs, not a proof of minimality",
    "local directory locking is a probe-only CAS seam",
    "the fake remote proves request correspondence in the fixture, not a live provider replay law",
    "the identity comparison does not select strict or bytes-sufficient replay policy",
    "the probe does not select production TypeScript spelling"
  ]
})}`)

await runDevelopmentToolingProbe()
