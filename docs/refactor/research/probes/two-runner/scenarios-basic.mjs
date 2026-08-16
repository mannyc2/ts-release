import { check } from "./core.mjs"
import { child, remote, root } from "./helpers.mjs"

export async function beforeSend() {
  const path = await root("before-send")
  const a = await child(["a", path, "before-send"])
  const b = await child(["b", path, "v1", "dispatch-0002"])
  const r = await remote(path)
  check(a.stoppedAfter === "DispatchStarted-before-send", "wrong A stop")
  check(b.sent && b.result.decision === "automatic-replay", "B did not replay")
  check(r.requests === 1 && r.effects === 1, "wrong remote count")
  return { remoteRequests: r.requests, remoteEffects: r.effects }
}

export async function responseLoss() {
  const path = await root("response-loss")
  await child(["a", path, "response-loss"])
  const b = await child(["b", path, "v1", "dispatch-0002"])
  const r = await remote(path)
  check(b.sent && r.requests === 2 && r.effects === 1, "response-loss replay duplicated effect")
  return { remoteRequests: r.requests, remoteEffects: r.effects }
}

export async function providerV2() {
  const path = await root("provider-v2")
  await child(["a", path, "before-send"])
  const b = await child(["b", path, "v2", "dispatch-v2"])
  const facts = Object.fromEntries(b.result.comparisons.map((item) => [item.fact, item.result]))
  check(!b.sent && b.result.code === "provider-identity-drift", "V2 did not stop")
  check(facts.requestFingerprint === "match", "V2 request must stay equal")
  check(facts.providerBehaviorId === "mismatch" && facts.providerLockfileIdentity === "mismatch", "V2 explanation incomplete")
  check(typeof b.result.riskAcceptance.assertion === "string", "missing RiskAccepted assertion")
  return { code: b.result.code, facts, riskAcceptance: b.result.riskAcceptance.assertion }
}
