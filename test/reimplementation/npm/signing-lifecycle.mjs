import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import { createRequire, syncBuiltinESMExports } from "node:module"
import { Cause, Effect, Exit, Fiber, Redacted, Result } from "effect"

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/sigstore-5.0.0-attestations.json", import.meta.url), "utf8"),
)
const bundle = fixture.attestations.find(
  (entry) => entry.predicateType === "https://slsa.dev/provenance/v1",
).bundle
const payload = Buffer.from(bundle.dsseEnvelope.payload, "base64")
// Harmless synthetic text passes bearer admission but cannot supply a JWT subject.
// SDK5 rejects it before requesting a Fulcio certificate or signing any payload.
const syntheticToken = "fixture-not-a-jwt"
let networkAttempts = 0
const noNetwork = () => {
  networkAttempts++
  throw new Error("Signing lifecycle fixture must not issue a network request")
}
const httpRequest = http.request
const httpsRequest = https.request
const nativeFetch = globalThis.fetch
// oxlint-disable-next-line typescript/unbound-method -- Save only to restore the exact method; never call it without its socket receiver.
const socketConnect = net.Socket.prototype.connect
http.request = noNetwork
https.request = noNetwork
globalThis.fetch = noNetwork
net.Socket.prototype.connect = noNetwork
syncBuiltinESMExports()

const entered = Promise.withResolvers()
const release = Promise.withResolvers()
const require = createRequire(import.meta.url)
let sdk
let nativeAttest
/** @type {Promise<unknown> | undefined} */
let issuedAttestation
let nativeFailure
let attestCalls = 0
let nativeRejections = 0
let holdRejection = false
let fiber
let cancellation
let completed
let privacyPassed = false
let pendingBeforeRelease = false
let nativeJoined = false
let rejectionPreserved = false
let settledHasInterrupts
try {
  // Instrument the pinned implementation before the public package captures it.
  // Always invoke the original SDK; hold only delivery of its real rejection.
  sdk = require("sigstore/dist/sigstore.js")
  nativeAttest = sdk.attest
  sdk.attest = (...args) => {
    attestCalls++
    issuedAttestation = nativeAttest(...args).catch(async (error) => {
      nativeFailure = error
      nativeRejections++
      if (holdRejection) {
        entered.resolve()
        await release.promise
      }
      throw error
    })
    return issuedAttestation
  }
  const { ProvenanceSource, makeSigstoreAttester } = await import("@mannyc1/ts-release-npm")
  // The authentic fixture's source matches the existing native verification witness.
  const source = new ProvenanceSource({
    format: "npm-github-actions-provenance-source/v1",
    serverUrl: "https://github.com",
    repository: "sigstore/sigstore-js",
    workflow: ".github/workflows/release.yml",
    workflowRef: "refs/heads/main",
    sourceRef: "refs/heads/main",
    sourceCommit: "7d2900eca1c22b3f87c13987c8d4b7c9a29b733a",
    eventName: "push",
    repositoryId: "495574555",
    repositoryOwnerId: "71096353",
    runnerEnvironment: "github-hosted",
    runId: "26781866618",
    runAttempt: "1",
    repositoryVisibility: "public",
  })
  const attest = makeSigstoreAttester({
    source,
    oidc: () => Effect.succeed(Redacted.make(syntheticToken)),
    fulcioUrl: "https://fulcio.sigstore.dev",
    rekorUrl: "https://rekor.sigstore.dev",
    tufRootPath: "/fixture/not-read-root.json",
    tufCachePath: "/fixture/not-written-cache",
    timeoutMilliseconds: 1000,
  })
  const request = { payloadType: "application/vnd.in-toto+json", payload }
  const control = await Effect.runPromiseExit(attest(request))
  assert(Exit.isFailure(control), "The native malformed identity must fail")
  const failure = Cause.findError(control.cause)
  assert(Result.isSuccess(failure), "Expected a typed signing failure")
  assert.equal(Cause.hasDies(control.cause), false)
  assert.equal(Cause.hasInterrupts(control.cause), false)
  assert.equal(failure.success.code, "npm-sigstore-sign")
  assert.equal(failure.success.message, "Sigstore attestation outcome is unknown")
  assert.equal(Cause.pretty(control.cause).includes(syntheticToken), false)
  assert.equal(JSON.stringify(control).includes(syntheticToken), false)
  assert.equal(nativeFailure.code, "IDENTITY_TOKEN_PARSE_ERROR")
  assert(nativeFailure.message.includes(syntheticToken))
  assert.equal(attestCalls, 1)
  assert.equal(networkAttempts, 0)
  privacyPassed = true

  holdRejection = true
  fiber = Effect.runFork(attest(request))
  const finished = Promise.withResolvers()
  fiber.addObserver((exit) => {
    completed = exit
    finished.resolve()
  })
  await Promise.race([
    entered.promise,
    finished.promise.then(() => {
      throw new Error("Attestation ended before its actual SDK rejection barrier")
    }),
  ])
  assert.equal(nativeFailure.code, "IDENTITY_TOKEN_PARSE_ERROR")
  assert.equal(attestCalls, 2)
  assert.equal(nativeRejections, 2)
  assert.equal(networkAttempts, 0)
  cancellation = Effect.runFork(Fiber.interrupt(fiber))
  // Drain causal rc.115 work without a stabilization sleep.
  fiber.currentDispatcher.flush()
  cancellation.currentDispatcher.flush()
  pendingBeforeRelease = completed === undefined
  assert(pendingBeforeRelease, "Interruption completed before native attestation settlement")
  release.resolve()
  const exit = await Effect.runPromise(Fiber.await(fiber))
  // Joining must retain the issued SDK failure. rc.115 preserves this failure
  // when it settles with pending interruption; it does not return interruption only.
  assert(Exit.isFailure(exit), "Expected the issued native rejection")
  const settledFailure = Cause.findError(exit.cause)
  assert(Result.isSuccess(settledFailure), "Expected the typed native rejection to survive")
  assert.equal(settledFailure.success.code, "npm-sigstore-sign")
  assert.equal(settledFailure.success.message, "Sigstore attestation outcome is unknown")
  assert.equal(Cause.hasDies(exit.cause), false)
  assert.equal(JSON.stringify(exit).includes(syntheticToken), false)
  rejectionPreserved = true
  settledHasInterrupts = Cause.hasInterrupts(exit.cause)
  assert.equal(networkAttempts, 0)
} finally {
  release.resolve()
  try {
    if (issuedAttestation) {
      await issuedAttestation.catch(() => undefined)
      nativeJoined = true
    }
  } finally {
    if (cancellation) await Effect.runPromise(Fiber.await(cancellation))
    else if (fiber) await Effect.runPromise(Fiber.interrupt(fiber))
    if (sdk && nativeAttest) sdk.attest = nativeAttest
    http.request = httpRequest
    https.request = httpsRequest
    globalThis.fetch = nativeFetch
    net.Socket.prototype.connect = socketConnect
    syncBuiltinESMExports()
    console.log(
      JSON.stringify({
        runtime: process.version,
        attestCalls,
        nativeRejections,
        networkAttempts,
        privacyPassed,
        pendingBeforeRelease,
        nativeJoined,
        rejectionPreserved,
        settledHasInterrupts,
      }),
    )
  }
}
