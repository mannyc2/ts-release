import { createHash } from "node:crypto"
import { decodeJson, makeDataBoundary } from "@mannyc1/ts-release/http"
import { UploadIntent } from "./Model.js"

export const { invalid, attempt, matches, object, own, ownOperation, ownRequest } =
  makeDataBoundary("pypi", "Python index")
export const encode = (input: unknown) => new TextEncoder().encode(JSON.stringify(input))
export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
export const scopeFor = (intent: UploadIntent) => JSON.stringify(own(UploadIntent, intent))
export const readScope = (scope: string) => {
  const intent = own(UploadIntent, decodeJson(scope))
  if (scope !== scopeFor(intent)) invalid("scope")
  return intent
}
export const MAX_BYTES = 128 * 1024 * 1024
