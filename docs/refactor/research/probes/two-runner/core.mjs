import { createHash } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export const NOW = "2026-08-16T20:00:00.000Z"
export const EXPIRY = "2026-08-17T20:00:00.000Z"
export const INITIAL_DISPATCH_ID = "dispatch-0001"
export const CORE_HTTP = "core.http/1"
export const IDEMPOTENCY = "replay.idempotency-key/1"
const schemes = new Set([
  "replay.none/1",
  IDEMPOTENCY,
  "replay.cas/1",
  "replay.exact-duplicate/1"
])

export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}
export const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`
const clone = (value) => JSON.parse(JSON.stringify(value))
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(freeze)
  }
  return value
}
export const check = (condition, message) => {
  if (!condition) throw new Error(message)
}

export function makeProvider(version) {
  const v2 = version === "v2"
  const definition = {
    definitionId: "probe.custom-registry",
    intentSchema: {
      encode: clone,
      decode(encoded) {
        check(encoded && typeof encoded === "object", "invalid encoded intent")
        check(typeof encoded.coordinate === "string", "invalid coordinate")
        check(encoded.payload && typeof encoded.payload === "object", "invalid payload")
        return clone(encoded)
      }
    },
    intentSchemaVersion: "1",
    behaviorId: `probe.custom-registry.behavior/${v2 ? 2 : 1}`,
    operationId: (intent) => digest(`ts-release.operation/1\n${canonical(intent)}`)
  }
  return {
    definition,
    lockfileIdentity: `sha256:probe-lockfile-provider-v${v2 ? 2 : 1}`,
    prepare(intent, { originDispatchId }) {
      return prepareHttp({
        operationId: definition.operationId(intent),
        providerDefinitionId: definition.definitionId,
        providerBehaviorId: definition.behaviorId,
        providerLockfileIdentity: this.lockfileIdentity,
        authorizationIdentity: "tenant:probe/account:release-bot",
        endpointIdentity: `https://registry.example.invalid/package/${encodeURIComponent(intent.coordinate)}`,
        method: "PUT",
        url: `https://registry.example.invalid/package/${encodeURIComponent(intent.coordinate)}`,
        headers: [["content-type", "application/json"]],
        bodyBase64: Buffer.from(canonical(intent), "utf8").toString("base64"),
        originDispatchId
      })
    }
  }
}

function prepareHttp(input) {
  const base = {
    transportId: CORE_HTTP,
    method: input.method,
    url: input.url,
    headers: input.headers.map(([key, value]) => [key.toLowerCase(), value]).sort(([a], [b]) => a.localeCompare(b)),
    bodyBase64: input.bodyBase64
  }
  const baseRequestFingerprint = digest(canonical(base))
  const key = `tsr_${digest(canonical({
    schemeId: IDEMPOTENCY,
    originDispatchId: input.originDispatchId,
    baseRequestFingerprint
  })).slice(7)}`
  const request = {
    ...base,
    headers: [...base.headers, ["idempotency-key", key]].sort(([a], [b]) => a.localeCompare(b))
  }
  const requestFingerprint = digest(canonical(request))
  const scopeFingerprint = digest(canonical({
    endpointIdentity: input.endpointIdentity,
    authorizationIdentity: input.authorizationIdentity
  }))
  return freeze({
    operationId: input.operationId,
    providerDefinitionId: input.providerDefinitionId,
    providerBehaviorId: input.providerBehaviorId,
    providerLockfileIdentity: input.providerLockfileIdentity,
    endpointIdentity: input.endpointIdentity,
    authorizationIdentity: input.authorizationIdentity,
    request,
    requestFingerprint,
    replayProtection: {
      schemeId: IDEMPOTENCY,
      originDispatchId: input.originDispatchId,
      baseRequestFingerprint,
      keyFingerprint: digest(key),
      scopeFingerprint,
      requestFingerprint,
      validFrom: NOW,
      expiresAt: EXPIRY
    }
  })
}

export function dispatchStarted(prepared, dispatchId, attempt, replayBasis) {
  return {
    type: "DispatchStarted",
    dispatchId,
    attempt,
    operationId: prepared.operationId,
    providerDefinitionId: prepared.providerDefinitionId,
    providerBehaviorId: prepared.providerBehaviorId,
    providerLockfileIdentity: prepared.providerLockfileIdentity,
    transportId: prepared.request.transportId,
    endpointIdentity: prepared.endpointIdentity,
    requestFingerprint: prepared.requestFingerprint,
    authorizationIdentity: prepared.authorizationIdentity,
    replayProtection: clone(prepared.replayProtection),
    replayBasis,
    startedAt: NOW
  }
}

const fact = (name, recorded, candidate, ok, bad = "mismatch") => ({
  fact: name,
  recorded: recorded ?? null,
  candidate: candidate ?? null,
  result: ok ? "match" : bad,
  consequence: ok ? "allow" : "block"
})
const risk = (prior, candidate, code) => ({
  assertion: `I authorize one additional dispatch of operation ${prior.operationId} after stop ${code}, using request ${candidate.requestFingerprint}, despite prior dispatch ${prior.dispatchId}`,
  priorDispatchId: prior.dispatchId,
  operationId: prior.operationId,
  candidateRequestFingerprint: candidate.requestFingerprint,
  acceptedRisks: ["duplicate external effect", "conflicting mutation", "provider behavior drift", "request-equivalence uncertainty"]
})

export function replayDecision(prior, candidate, now) {
  const pairs = [
    ["providerDefinitionId", prior.providerDefinitionId, candidate.providerDefinitionId],
    ["providerBehaviorId", prior.providerBehaviorId, candidate.providerBehaviorId],
    ["providerLockfileIdentity", prior.providerLockfileIdentity, candidate.providerLockfileIdentity],
    ["transportId", prior.transportId, candidate.request.transportId],
    ["endpointIdentity", prior.endpointIdentity, candidate.endpointIdentity],
    ["authorizationIdentity", prior.authorizationIdentity, candidate.authorizationIdentity],
    ["requestFingerprint", prior.requestFingerprint, candidate.requestFingerprint],
    ["replayProtection.scopeFingerprint", prior.replayProtection.scopeFingerprint, candidate.replayProtection.scopeFingerprint]
  ]
  const comparisons = pairs.map(([name, recorded, current]) => fact(name, recorded, current, recorded === current))
  const scheme = prior.replayProtection.schemeId
  const schemeOk = schemes.has(scheme) && scheme === candidate.replayProtection.schemeId
  comparisons.push(fact("replayProtection.schemeId", scheme, candidate.replayProtection.schemeId, schemeOk, "unsupported"))
  const notExpired = !prior.replayProtection.expiresAt || Date.parse(now) < Date.parse(prior.replayProtection.expiresAt)
  comparisons.push(fact("replayProtection.expiresAt", prior.replayProtection.expiresAt, now, notExpired, "expired"))
  const byName = Object.fromEntries(comparisons.map((item) => [item.fact, item.result === "match"]))
  let code
  if (!(byName.providerDefinitionId && byName.providerBehaviorId && byName.providerLockfileIdentity)) code = "provider-identity-drift"
  else if (prior.transportId !== CORE_HTTP || !byName.transportId) code = "unsupported-transport"
  else if (!schemeOk) code = "unsupported-replay-scheme"
  else if (!notExpired) code = "expired-replay-protection"
  else if (!(byName.endpointIdentity && byName.authorizationIdentity && byName.requestFingerprint && byName["replayProtection.scopeFingerprint"])) code = "request-mismatch"
  if (code) return { decision: "stop", code, comparisons, riskAcceptance: risk(prior, candidate, code) }
  return {
    decision: "automatic-replay",
    basis: { kind: "recorded-protection", priorDispatchId: prior.dispatchId, schemeId: scheme },
    comparisons
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temp, path)
}
export const readJson = async (path) => JSON.parse(await readFile(path, "utf8"))
export const initJournal = (root) => writeJson(join(root, "journal.json"), { revision: 0, events: [] })

async function lock(path) {
  try { await mkdir(path); return true } catch (error) {
    if (error?.code === "EEXIST") return false
    throw error
  }
}

export async function appendCas(root, expectedRevision, event) {
  const lockPath = join(root, ".probe-journal-cas")
  if (!(await lock(lockPath))) return { appended: false, reason: "contended" }
  try {
    const path = join(root, "journal.json")
    const current = await readJson(path)
    if (current.revision !== expectedRevision) return { appended: false, reason: "revision-mismatch", actualRevision: current.revision }
    const next = { revision: current.revision + 1, events: [...current.events, event] }
    await writeJson(path, next)
    return { appended: true, revision: next.revision }
  } finally {
    await rm(lockPath, { recursive: true, force: true })
  }
}

async function remoteLock(root, body) {
  const path = join(root, ".probe-remote-lock")
  for (let i = 0; i < 500; i += 1) {
    if (await lock(path)) {
      try { return await body() } finally { await rm(path, { recursive: true, force: true }) }
    }
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
  throw new Error("remote lock timeout")
}

export async function sendPrepared(root, prepared, dispatchId, loseResponse = false) {
  check(Object.isFrozen(prepared) && Object.isFrozen(prepared.request), "transport requires immutable PreparedDispatch")
  const journal = await readJson(join(root, "journal.json"))
  check(journal.events.some((event) => event.dispatchId === dispatchId), "send crossed transport before DispatchStarted CAS")
  const key = prepared.request.headers.find(([name]) => name === "idempotency-key")?.[1]
  check(key && digest(key) === prepared.replayProtection.keyFingerprint, "derived key mismatch")
  const result = await remoteLock(root, async () => {
    const path = join(root, "remote.json")
    let remote
    try { remote = await readJson(path) } catch (error) {
      if (error?.code !== "ENOENT") throw error
      remote = { requests: 0, effects: 0, byKey: {} }
    }
    remote.requests += 1
    if (remote.byKey[key]) check(remote.byKey[key].requestFingerprint === prepared.requestFingerprint, "key reused for different request")
    else {
      remote.effects += 1
      remote.byKey[key] = { requestFingerprint: prepared.requestFingerprint, result: { mutationId: `mutation-${remote.effects}` } }
    }
    await writeJson(path, remote)
    return remote.byKey[key].result
  })
  await writeFile(join(root, "send-log.ndjson"), `${JSON.stringify({ dispatchId })}\n`, { encoding: "utf8", flag: "a" })
  if (loseResponse) throw Object.assign(new Error("simulated response loss"), { code: "RESPONSE_LOST" })
  return result
}

export async function writePlan(root, provider, intent) {
  await writeJson(join(root, "plan.json"), {
    providerDefinitionId: provider.definition.definitionId,
    intentSchemaVersion: provider.definition.intentSchemaVersion,
    encodedIntent: provider.definition.intentSchema.encode(intent),
    operationId: provider.definition.operationId(intent),
    probeNow: NOW
  })
}

export async function loadPrepared(root, provider) {
  const plan = await readJson(join(root, "plan.json"))
  check(plan.providerDefinitionId === provider.definition.definitionId, "definition mismatch")
  check(plan.intentSchemaVersion === provider.definition.intentSchemaVersion, "schema mismatch")
  const intent = provider.definition.intentSchema.decode(plan.encodedIntent)
  check(provider.definition.operationId(intent) === plan.operationId, "operation projection changed")
  return { plan, prepared: provider.prepare(intent, { originDispatchId: INITIAL_DISPATCH_ID }) }
}
