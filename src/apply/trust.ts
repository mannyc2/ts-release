import * as Schema from "effect/Schema"
import { hashCanonical as hash } from "../model/canonical.js"
import { ApprovalNonce, Digest } from "../model/primitives.js"
import {
  LedgerAttestation, RunLedger, SignedAuthorizationReceipt, TransitionError
} from "../model/run.js"

const encoder = new TextEncoder()
const fail = (reason: string): never => { throw TransitionError.make({ reason }) }
const required = <A>(value: A | undefined, reason: string): A =>
  value === undefined ? fail(reason) : value
const bytes = (value: string): Uint8Array<ArrayBuffer> => {
  const source = Buffer.from(value, "base64")
  const result = new Uint8Array(new ArrayBuffer(source.length))
  result.set(source)
  return result
}
const body = (value: SignedAuthorizationReceipt) => {
  const { signature: _signature, ...unsigned } = Schema.encodeSync(SignedAuthorizationReceipt)(value)
  return unsigned
}
const ledgerBody = (ledger: RunLedger) => {
  const { attestation: _attestation, ...unsigned } = Schema.encodeSync(RunLedger)(ledger)
  return unsigned
}
export const generateWorkerKey = (): Promise<CryptoKeyPair> =>
  crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])
export const exportWorkerKey = async (key: CryptoKey): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.exportKey("raw", key))
export const importWorkerKey = (value: string): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", bytes(value), "Ed25519", false, ["verify"])
const signature = async (key: CryptoKey, digest: string): Promise<string> =>
  Buffer.from(await crypto.subtle.sign("Ed25519", key, encoder.encode(digest))).toString("base64")
const verify = (key: CryptoKey, digest: string, value: string): Promise<boolean> =>
  crypto.subtle.verify("Ed25519", key, bytes(value), encoder.encode(digest))
export type AuthorizationInput = Omit<typeof SignedAuthorizationReceipt.Type, "signature">
export const signAuthorization = async (
  input: AuthorizationInput, key: CryptoKey
): Promise<SignedAuthorizationReceipt> => {
  const digest = hash("ts-release/authorization-receipt/v1", input)
  return SignedAuthorizationReceipt.make({ ...input, signature: await signature(key, digest) })
}
export const verifyAuthorization = async (
  receipt: SignedAuthorizationReceipt, key: CryptoKey
): Promise<void> => {
  const digest = hash("ts-release/authorization-receipt/v1", body(receipt))
  if (!await verify(key, digest, receipt.signature)) fail("Authorization receipt signature is invalid.")
}
export const attestLedger = async (
  ledger: RunLedger, workerId: string, key: CryptoKey
): Promise<RunLedger> => {
  const registration = required(
    ledger.topology?.partitions.find((item) => item.workerId === workerId),
    "Ledger signer is not registered for its scope.")
  if (ledger.scope.scopeHash !== registration.scopeHash)
    fail("Ledger signer is not registered for its scope.")
  const digest = Digest.make(hash("ts-release/ledger-attestation/v1", {
    workerId, workerKeyFingerprint: registration.workerKeyFingerprint,
    planId: ledger.planId, logicalRunId: ledger.logicalRunId,
    scopeHash: registration.scopeHash, executionTopologyHash: ledger.executionTopologyHash,
    ledgerWithoutAttestation: ledgerBody(ledger)
  }))
  return RunLedger.make({ ...ledger, attestation: LedgerAttestation.make({
    workerId: registration.workerId, topologyHash: ledger.executionTopologyHash,
    signerFingerprint: registration.workerKeyFingerprint, digest,
    signature: await signature(key, digest)
  }) })
}
export const verifyLedgerAttestation = async (ledger: RunLedger): Promise<void> => {
  const attestation = required(ledger.attestation, "Ledger attestation is unregistered.")
  const registration = required(
    ledger.topology?.partitions.find((item) => item.workerId === attestation.workerId),
    "Ledger attestation is unregistered.")
  if (attestation.signerFingerprint !== registration.workerKeyFingerprint ||
    attestation.topologyHash !== ledger.executionTopologyHash) fail("Ledger attestation is unregistered.")
  const publicKey = await crypto.subtle.importKey(
    "raw", bytes(registration.publicKey), "Ed25519", false, ["verify"])
  const { attestation: _attestation, ...unsignedFields } = ledger
  const unsigned = RunLedger.make(unsignedFields)
  const expected = hash("ts-release/ledger-attestation/v1", {
    workerId: registration.workerId, workerKeyFingerprint: registration.workerKeyFingerprint,
    planId: ledger.planId, logicalRunId: ledger.logicalRunId,
    scopeHash: registration.scopeHash, executionTopologyHash: ledger.executionTopologyHash,
    ledgerWithoutAttestation: ledgerBody(unsigned)
  })
  if (expected !== attestation.digest || !await verify(publicKey, expected, attestation.signature))
    fail("Ledger attestation signature is invalid.")
}
export const authorizationNonce = (value: string) => ApprovalNonce.make(value)
export const materialBindingHash = (
  outputId: string, relativePath: string, size: number, sha256OfBytes: string
): Digest => Digest.make(hash("ts-release/material-binding/v1", {
  outputId, relativePath, size, sha256OfBytes
}))
