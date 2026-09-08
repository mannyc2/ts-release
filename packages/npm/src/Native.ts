import * as Schema from "effect/Schema"
import * as Model from "./Model.js"
import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { readTarBytes, verifiedArtifacts, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import { decodeJson as parseJson, makeDataBoundary } from "@mannyc1/ts-release/http"

export const { failure, invalid, reject, attempt, matches, object, own, ownOperation, ownRequest } =
  makeDataBoundary("npm", "npm")
export const digest = (algorithm: string, bytes: Uint8Array) =>
  createHash(algorithm).update(bytes).digest("hex")
export const encode = (input: unknown) => new TextEncoder().encode(JSON.stringify(input))

export { decodeJson as parseJson } from "@mannyc1/ts-release/http"
/** Native package metadata is extracted from the exact bounded owned tarball. */
export const readManifest = (bytes: Uint8Array): Record<string, unknown> => {
  const entries = readTarBytes(
    gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 }),
    128 * 1024 * 1024,
    new Set(),
    (reason) => invalid(`tar-${reason}`),
  )
  if (entries.some((entry) => entry.path !== "package" && !entry.path.startsWith("package/")))
    invalid("tar-path")
  const manifests = entries.filter(
    (entry) => entry.kind === "file" && entry.path === "package/package.json",
  )
  if (manifests.length !== 1 || manifests[0]!.body.length > 1024 * 1024) invalid("tar-manifest")
  return object(parseJson(manifests[0]!.body))
}

export const captureArtifacts = (access: ArtifactAccess) =>
  verifiedArtifacts(access, 128 * 1024 * 1024)
export const metadataUrl = (packageName: string) =>
  `https://registry.npmjs.org/${encodeURIComponent(packageName).replace(/^%40/u, "@").replace(/%2F/gu, "%2f")}`
export class NativeScope extends Schema.Class<NativeScope>("NpmNativeScope")({
  definitionId: Schema.Literals(["npm.publish", "npm.dist-tag"]),
  intent: Schema.Union([Model.publishCodec, Model.DistTagIntent]),
}) {}
export const scopeFor = (input: Model.PublishIntent | Model.DistTagIntent): string => {
  const intent =
    "initialTag" in input ? own(Model.publishCodec, input) : own(Model.DistTagIntent, input)
  return JSON.stringify(
    new NativeScope({
      definitionId: "initialTag" in intent ? "npm.publish" : "npm.dist-tag",
      intent,
    }),
  )
}
export const readScope = (scope: string): NativeScope => {
  const value = own(NativeScope, parseJson(scope))
  if (
    value.definitionId !== ("initialTag" in value.intent ? "npm.publish" : "npm.dist-tag") ||
    JSON.stringify(value) !== scope
  )
    invalid("scope-encoding")
  return value
}
export const endpointFor = (scope: NativeScope, read = false): string =>
  read || scope.definitionId === "npm.publish"
    ? metadataUrl(scope.intent.name)
    : `https://registry.npmjs.org/-/package/${encodeURIComponent(scope.intent.name).replace(/^%40/u, "@").replace(/%2F/gu, "%2f")}/dist-tags/${encodeURIComponent("initialTag" in scope.intent ? scope.intent.initialTag : scope.intent.tag)}`
