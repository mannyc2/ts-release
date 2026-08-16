import { createHash } from "node:crypto"

const check = (condition, message) => {
  if (!condition) throw new Error(message)
}

const canonical = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
}

const digest = (domain, value) => createHash("sha256")
  .update(domain)
  .update("\0")
  .update(canonical(value))
  .digest("hex")

export function runIdentityAlternatives() {
  const planId = "plan-1"
  const definitionId = "acme.registry"
  const schemaVersion = "1"
  const intent = {
    coordinate: "package/acme@1.0.0",
    artifact: "artifact-1"
  }

  const coreDerivedV1 = digest("ts-release/operation/1", {
    definitionId,
    schemaVersion,
    intent
  })
  const coreDerivedV2 = digest("ts-release/operation/1", {
    definitionId,
    schemaVersion,
    intent
  })
  const operationKeyV1 = { planId, operationId: coreDerivedV1 }
  const operationKeyV2 = { planId, operationId: coreDerivedV2 }

  const providerProjectionV1 = digest("provider-v1/operation", intent)
  const providerProjectionV2 = digest("provider-v2/operation", intent)

  check(coreDerivedV1 === coreDerivedV2, "core-derived identity changed across implementations")
  check(canonical(operationKeyV1) === canonical(operationKeyV2), "plan-scoped operation key changed across implementations")
  check(providerProjectionV1 !== providerProjectionV2, "provider projection counterexample did not diverge")

  const recorded = {
    requestFingerprint: "request-F",
    endpointIdentity: "endpoint-E",
    authorizationIdentity: "principal-P/scope-S",
    replayProtectionFingerprint: "protection-R",
    behaviorId: "behavior-v1",
    lockfileIdentity: "lock-v1"
  }
  const candidate = {
    ...recorded,
    behaviorId: "behavior-v2",
    lockfileIdentity: "lock-v2"
  }

  const wireFactsMatch = [
    "requestFingerprint",
    "endpointIdentity",
    "authorizationIdentity",
    "replayProtectionFingerprint"
  ].every((field) => recorded[field] === candidate[field])

  const strictDecision = wireFactsMatch &&
    recorded.behaviorId === candidate.behaviorId &&
    recorded.lockfileIdentity === candidate.lockfileIdentity
    ? "allow"
    : "stop"

  const wireCorrespondenceDecision = wireFactsMatch ? "allow" : "stop"

  check(strictDecision === "stop", "strict candidate should stop on implementation drift")
  check(wireCorrespondenceDecision === "allow", "wire candidate should allow equal correspondence facts")

  return {
    status: "pass",
    operationIdentity: {
      coreDerivedStable: true,
      planScopedKeyStable: true,
      providerControlledProjectionCanDiverge: true
    },
    equalWireFactsWithImplementationDrift: {
      strictDecision,
      wireCorrespondenceDecision
    },
    proves: [
      "core can derive a stable operation identifier without provider-executed projection",
      "provider-controlled operation projection can create divergent peer identities",
      "strict implementation identity and bytes-sufficient correspondence are distinct policies"
    ],
    doesNotProve: [
      "that equal request bytes imply remote idempotency",
      "that behavior or lockfile provenance is never useful for diagnostics",
      "which replay policy the production design should select",
      "that this provisional canonical encoder is the production encoder"
    ]
  }
}
