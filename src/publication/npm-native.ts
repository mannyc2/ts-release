import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import { gunzipSync } from "node:zlib"
import * as Semver from "semver"
import {
  Sha1Hex,
  digestEquals,
  formatNpmSha1Shasum,
  formatNpmSha512Sri,
  parseNpmSha1Shasum,
  parseNpmSha512Sri,
  sha1Digest,
  sha512Digest
} from "../model/digest.js"
import { parseStrictJson } from "../model/canonical.js"
import { ArtifactRef } from "../release/artifact-bundle.js"

export const npmCliVersion = "12.0.2" as const

const NonNegativeInt = Schema.Int.check(Schema.makeFilter((value: number) =>
  value >= 0 ? undefined : "Value must be a nonnegative integer."))

const canonicalText = (label: string) => Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
  value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value)
    ? undefined
    : `${label} must be nonempty NFC text without control characters.`))

export const NpmPackageName = canonicalText("npm package name").check(Schema.makeFilter((value: string) =>
  value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u.test(value)
    ? undefined
    : "npm package name must be a canonical lowercase scoped or unscoped name."
)).pipe(Schema.brand("NpmPackageName"))
export type NpmPackageName = typeof NpmPackageName.Type

export const NpmVersion = canonicalText("npm version").check(Schema.makeFilter((value: string) =>
  Semver.valid(value) === value ? undefined : "npm version must be canonical SemVer.")).pipe(Schema.brand("NpmVersion"))
export type NpmVersion = typeof NpmVersion.Type

export const NpmRegistryUrl = Schema.Literal("https://registry.npmjs.org/")
  .pipe(Schema.brand("NpmRegistryUrl"))
export type NpmRegistryUrl = typeof NpmRegistryUrl.Type

export const NpmDistTag = canonicalText("npm dist-tag").check(Schema.makeFilter((value: string) =>
  Semver.validRange(value) === null && value.trim() === value && encodeURIComponent(value) === value
    ? undefined
    : "npm dist-tag must be URI-safe and must not be a SemVer range.")).pipe(Schema.brand("NpmDistTag"))
export type NpmDistTag = typeof NpmDistTag.Type

export const NpmAccess = Schema.Literal("public")
export type NpmAccess = typeof NpmAccess.Type

/** Nonsecret identity of the operation-local authorization selected by the plan. */
export const NpmAuthorizationIdentity = canonicalText("npm authorization identity")
  .pipe(Schema.brand("NpmAuthorizationIdentity"))
export type NpmAuthorizationIdentity = typeof NpmAuthorizationIdentity.Type

export class NpmTokenAuthorization
  extends Schema.Class<NpmTokenAuthorization>("NpmTokenAuthorization")({
    mode: Schema.Literal("token"),
    identity: NpmAuthorizationIdentity
  }) {}

export const NpmSha512Integrity = Schema.NonEmptyString.check(
  Schema.makeFilter((value: string) => {
    try {
      parseNpmSha512Sri(value)
      return undefined
    } catch {
      return "Value must be a canonical npm SHA-512 SRI string."
    }
  })
).pipe(Schema.brand("NpmSha512Integrity"))
export type NpmSha512Integrity = typeof NpmSha512Integrity.Type

/** Durable provider intent. authorizationIdentity names authority but contains no credential value. */
export class NpmPublishIntent
  extends Schema.TaggedClass<NpmPublishIntent>()("NpmPublishIntent", {
    schemaVersion: Schema.Literal("npm-publish-intent/v1"),
    artifact: ArtifactRef,
    packageName: NpmPackageName,
    version: NpmVersion,
    registryUrl: NpmRegistryUrl,
    distTag: NpmDistTag,
    access: NpmAccess,
    authorization: NpmTokenAuthorization,
    provenance: Schema.Literal(false)
  }) {}

/** Imported directly by an application; core owns no provider registry. */
export const NpmPublishDefinition = Object.freeze({
  definitionId: "ts-release/npm.publish/1",
  intentSchemaVersion: "npm-publish-intent/v1",
  intentSchema: NpmPublishIntent
})

export class NpmPreparedRequestError
  extends Schema.TaggedErrorClass<NpmPreparedRequestError>()("NpmPreparedRequestError", {
    commitment: Schema.Literal("before-dispatch"),
    reason: Schema.NonEmptyString
  }) {}

export interface NpmTarballInput {
  readonly artifact: ArtifactRef
  readonly bytes: Uint8Array
}

export interface PreparedNpmPublishRequest {
  readonly intent: NpmPublishIntent
  readonly tarball: {
    readonly artifact: ArtifactRef
    readonly byteLength: number
    readonly filename: string
    readonly shasum: Sha1Hex
    readonly integrity: NpmSha512Integrity
  }
}

export const npmTarballFilename = (packageName: string, version: string): string =>
  `${packageName.startsWith("@") ? packageName.slice(1).replace("/", "-") : packageName}-${version}.tgz`

export const npmPublishArgv = (
  intent: NpmPublishIntent,
  tarballPath: string,
  userConfigPath: string
): readonly [string, ...Array<string>] => Object.freeze([
  "npm",
  "publish",
  tarballPath,
  "--ignore-scripts",
  "--registry",
  intent.registryUrl.toString(),
  "--tag",
  intent.distTag.toString(),
  "--access",
  intent.access,
  "--fetch-retries=0",
  intent.provenance ? "--provenance" : "--provenance=false",
  "--dry-run=false",
  "--userconfig",
  userConfigPath,
  "--json"
]) as readonly [string, ...Array<string>]

const npmTarArchiveLimit = 128 * 1024 * 1024
const npmPackageManifestLimit = 1024 * 1024

const tarString = (bytes: Uint8Array): string => {
  const nul = bytes.indexOf(0)
  return new TextDecoder("utf-8", { fatal: true }).decode(nul < 0 ? bytes : bytes.subarray(0, nul))
}

const tarOctal = (bytes: Uint8Array): number => {
  const value = tarString(bytes).trim().replace(/^0+/u, "") || "0"
  if (!/^[0-7]+$/u.test(value)) throw new Error("npm tarball contains an invalid octal field.")
  const parsed = Number.parseInt(value, 8)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("npm tarball contains an out-of-range size.")
  }
  return parsed
}

const pax = (bytes: Uint8Array): Readonly<Record<string, string>> => {
  const values: Record<string, string> = {}
  let offset = 0
  while (offset < bytes.length) {
    let space = offset
    while (space < bytes.length && bytes[space] !== 0x20) space += 1
    const lengthText = new TextDecoder("ascii", { fatal: true }).decode(bytes.subarray(offset, space))
    if (!/^[1-9][0-9]*$/u.test(lengthText)) throw new Error("npm tarball PAX record is malformed.")
    const length = Number(lengthText)
    const end = offset + length
    if (!Number.isSafeInteger(length) || end > bytes.length || bytes[end - 1] !== 0x0a) {
      throw new Error("npm tarball PAX record has an invalid length.")
    }
    const record = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(space + 1, end - 1))
    const equals = record.indexOf("=")
    if (equals <= 0) throw new Error("npm tarball PAX record is missing a key.")
    const key = record.slice(0, equals)
    if (key !== "path") throw new Error(`npm tarball PAX key ${key} is unsupported in the first slice.`)
    values[key] = record.slice(equals + 1)
    offset = end
  }
  return values
}

const safeTarPath = (path: string): string => {
  if (path.length === 0 || path.includes("\\") || path.startsWith("/") || path.endsWith("/") ||
      path.split("/").some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new Error("npm tarball contains an unsafe path.")
  }
  return path
}

const assertPublishConfig = (intent: NpmPublishIntent, value: unknown): void => {
  if (value === undefined) return
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("npm package publishConfig must be an object when present.")
  }
  const config = value as Readonly<Record<string, unknown>>
  const allowed = new Set(["registry", "access", "tag", "provenance"])
  const unsupported = Object.keys(config).find((key) => !allowed.has(key))
  if (unsupported !== undefined) {
    throw new Error(`npm package publishConfig.${unsupported} is outside the closed first-slice policy.`)
  }
  if (config.registry !== undefined && config.registry !== intent.registryUrl.toString()) {
    throw new Error("npm package publishConfig.registry disagrees with the npm Intent.")
  }
  if (config.access !== undefined && config.access !== intent.access) {
    throw new Error("npm package publishConfig.access disagrees with the npm Intent.")
  }
  if (config.tag !== undefined && config.tag !== intent.distTag.toString()) {
    throw new Error("npm package publishConfig.tag disagrees with the npm Intent.")
  }
  if (config.provenance !== undefined && config.provenance !== false) {
    throw new Error("npm package publishConfig.provenance disagrees with the token-only first slice.")
  }
}

const assertNpmTarballManifest = (intent: NpmPublishIntent, bytes: Uint8Array): void => {
  let tar: Uint8Array
  try {
    tar = new Uint8Array(gunzipSync(bytes, { maxOutputLength: npmTarArchiveLimit }))
  } catch {
    throw new Error("npm artifact is not a bounded valid gzip tarball.")
  }

  let offset = 0
  let pendingPax: Readonly<Record<string, string>> = {}
  let pendingLongPath: string | undefined
  let manifestBytes: Uint8Array | undefined
  let endMarker = false
  const seenPaths = new Set<string>()
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      if (!tar.subarray(offset).every((byte) => byte === 0)) {
        throw new Error("npm tarball has nonzero data after its end marker.")
      }
      endMarker = true
      break
    }
    let checksum = 0
    for (let index = 0; index < 512; index += 1) {
      checksum += index >= 148 && index < 156 ? 0x20 : header[index]!
    }
    if (checksum !== tarOctal(header.subarray(148, 156))) {
      throw new Error("npm tarball header checksum is invalid.")
    }
    const size = tarOctal(header.subarray(124, 136))
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    if (dataEnd > tar.length) throw new Error("npm tarball entry is truncated.")
    const type = String.fromCharCode(header[156]!)
    const rawName = tarString(header.subarray(0, 100))
    const prefix = tarString(header.subarray(345, 500))
    const rawPath = prefix.length === 0 ? rawName : `${prefix}/${rawName}`

    if (type === "x") {
      pendingPax = pax(tar.subarray(dataStart, dataEnd))
    } else if (type === "L") {
      pendingLongPath = tarString(tar.subarray(dataStart, dataEnd))
    } else {
      const path = safeTarPath(pendingPax.path ?? pendingLongPath ?? rawPath)
      pendingPax = {}
      pendingLongPath = undefined
      if (type === "1" || type === "2") throw new Error("npm tarball contains a link.")
      if (!["\0", "0", "5"].includes(type)) {
        throw new Error("npm tarball contains an unsupported entry type.")
      }
      const folded = path.toLocaleLowerCase("en-US")
      if (seenPaths.has(folded)) throw new Error("npm tarball repeats a case-folded path.")
      seenPaths.add(folded)
      if ((type === "\0" || type === "0") && path === "package/package.json") {
        if (manifestBytes !== undefined) throw new Error("npm tarball repeats package/package.json.")
        if (size > npmPackageManifestLimit) throw new Error("npm package manifest exceeds the supported bound.")
        manifestBytes = Uint8Array.from(tar.subarray(dataStart, dataEnd))
      }
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  if (!endMarker || manifestBytes === undefined || Object.keys(pendingPax).length > 0 || pendingLongPath !== undefined) {
    throw new Error("npm tarball must contain exactly one complete package/package.json entry.")
  }

  let manifest: Readonly<Record<string, unknown>>
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes))
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not an object")
    manifest = value as Readonly<Record<string, unknown>>
  } catch {
    throw new Error("npm tarball package.json is not a valid JSON object.")
  }
  const name = Schema.decodeUnknownSync(NpmPackageName)(manifest.name)
  const version = Schema.decodeUnknownSync(NpmVersion)(manifest.version)
  if (name !== intent.packageName || version !== intent.version) {
    throw new Error("npm tarball package name/version disagrees with the npm Intent.")
  }
  if (manifest.private !== undefined && manifest.private !== false) {
    throw new Error("npm tarball package must not be private in the public first slice.")
  }
  if (manifest.packageExtensions !== undefined) {
    throw new Error("npm 12 refuses to publish a package containing root-only packageExtensions policy.")
  }
  assertPublishConfig(intent, manifest.publishConfig)
}

const snapshotIntent = (intent: NpmPublishIntent): NpmPublishIntent => {
  const decoded = Schema.decodeUnknownSync(NpmPublishIntent, { onExcessProperty: "error" })(
    Schema.encodeSync(NpmPublishIntent)(intent)
  )
  const artifact = Object.freeze(ArtifactRef.make({ artifactId: decoded.artifact.artifactId }))
  const authorization = Object.freeze(NpmTokenAuthorization.make({
    mode: "token",
    identity: decoded.authorization.identity
  }))
  return Object.freeze(NpmPublishIntent.make({
    schemaVersion: "npm-publish-intent/v1",
    artifact,
    packageName: decoded.packageName,
    version: decoded.version,
    registryUrl: decoded.registryUrl,
    distTag: decoded.distTag,
    access: decoded.access,
    authorization,
    provenance: false
  }))
}

/** Derives all expected receipt facts from immutable bundle bytes. */
export const prepareNpmPublishRequest = Effect.fn("NpmNative.prepareRequest")(function*(
  intent: NpmPublishIntent,
  input: NpmTarballInput
) {
  const ownedIntent = yield* Effect.try({
    try: () => snapshotIntent(intent),
    catch: (cause) => new NpmPreparedRequestError({
      commitment: "before-dispatch",
      reason: cause instanceof Error ? cause.message : String(cause)
    })
  })
  if (input.artifact.artifactId.toString() !== ownedIntent.artifact.artifactId.toString()) {
    return yield* new NpmPreparedRequestError({
      commitment: "before-dispatch",
      reason: "The npm Intent and tarball refer to different artifact references."
    })
  }
  if (input.bytes.byteLength === 0) {
    return yield* new NpmPreparedRequestError({
      commitment: "before-dispatch",
      reason: "The immutable npm tarball is empty."
    })
  }
  yield* Effect.try({
    try: () => assertNpmTarballManifest(ownedIntent, input.bytes),
    catch: (cause) => new NpmPreparedRequestError({
      commitment: "before-dispatch",
      reason: cause instanceof Error ? cause.message : String(cause)
    })
  })
  const request: PreparedNpmPublishRequest = {
    intent: ownedIntent,
    tarball: Object.freeze({
      artifact: ownedIntent.artifact,
      byteLength: input.bytes.byteLength,
      filename: npmTarballFilename(ownedIntent.packageName.toString(), ownedIntent.version.toString()),
      shasum: Sha1Hex.make(formatNpmSha1Shasum(sha1Digest(input.bytes))),
      integrity: NpmSha512Integrity.make(formatNpmSha512Sri(sha512Digest(input.bytes)))
    })
  }
  return Object.freeze(request)
})

export class NpmPublishedFile extends Schema.Class<NpmPublishedFile>("NpmPublishedFile")({
  path: Schema.NonEmptyString,
  size: NonNegativeInt,
  mode: NonNegativeInt
}) {}

const npmCliReceiptFields = {
  id: Schema.NonEmptyString,
  name: NpmPackageName,
  version: NpmVersion,
  size: NonNegativeInt,
  unpackedSize: NonNegativeInt,
  shasum: Sha1Hex,
  integrity: NpmSha512Integrity,
  filename: Schema.NonEmptyString,
  files: Schema.Array(NpmPublishedFile),
  entryCount: NonNegativeInt,
  bundled: Schema.Array(Schema.NonEmptyString)
} as const

export class NpmCliReportedPackage
  extends Schema.Class<NpmCliReportedPackage>("NpmCliReportedPackage")(npmCliReceiptFields) {}

export class NpmCliReportUnavailable
  extends Schema.TaggedClass<NpmCliReportUnavailable>()("NpmCliReportUnavailable", {
    kind: Schema.Literals(["malformed-json", "shape-mismatch", "content-mismatch"]),
    reason: Schema.NonEmptyString
  }) {}

export const NpmCliPublishReport = Schema.Union([
  NpmCliReportedPackage,
  NpmCliReportUnavailable
])
export type NpmCliPublishReport = typeof NpmCliPublishReport.Type

export class NpmPublishAcceptedIntentFacts
  extends Schema.Class<NpmPublishAcceptedIntentFacts>("NpmPublishAcceptedIntentFacts")({
    origin: NpmRegistryUrl,
    packageName: NpmPackageName,
    version: NpmVersion,
    initialTag: NpmDistTag,
    access: NpmAccess,
    versionFacet: Schema.Literal("accepted"),
    initialTagFacet: Schema.Literal("accepted")
  }) {}

export class NpmCliAcceptance
  extends Schema.Class<NpmCliAcceptance>("NpmCliAcceptance")({
    transport: Schema.Literal("npm-cli"),
    npmCliVersion: Schema.Literal(npmCliVersion),
    exitCode: Schema.Literal(0),
    basis: Schema.Literal("npm-cli-exit-zero"),
    providerResponse: Schema.Literal("not-exposed-by-npm-cli")
  }) {}

/** Durable composite receipt: CLI acceptance, Intent facts, and local CLI report stay distinct. */
export class NpmPublishReceipt
  extends Schema.TaggedClass<NpmPublishReceipt>()("NpmPublishReceipt", {
    schemaVersion: Schema.Literal("npm-cli-publish-receipt/v1"),
    acceptance: NpmCliAcceptance,
    acceptedIntentFacts: NpmPublishAcceptedIntentFacts,
    cliReportedFacts: NpmCliPublishReport
  }) {}

export class NpmPublishReceiptInvalid
  extends Schema.TaggedErrorClass<NpmPublishReceiptInvalid>()("NpmPublishReceiptInvalid", {
    commitment: Schema.Literal("accepted"),
    kind: Schema.Literals(["malformed-json", "shape-mismatch", "content-mismatch"]),
    reason: Schema.NonEmptyString
  }) {}

const invalidReceipt = (
  kind: NpmPublishReceiptInvalid["kind"],
  reason: string
): NpmPublishReceiptInvalid => new NpmPublishReceiptInvalid({
  commitment: "accepted",
  kind,
  reason
})

const makeAcceptedReceipt = (
  request: PreparedNpmPublishRequest,
  cliReportedFacts: NpmCliPublishReport
): NpmPublishReceipt => NpmPublishReceipt.make({
  schemaVersion: "npm-cli-publish-receipt/v1",
  acceptance: NpmCliAcceptance.make({
    transport: "npm-cli",
    npmCliVersion,
    exitCode: 0,
    basis: "npm-cli-exit-zero",
    providerResponse: "not-exposed-by-npm-cli"
  }),
  acceptedIntentFacts: NpmPublishAcceptedIntentFacts.make({
    origin: request.intent.registryUrl,
    packageName: request.intent.packageName,
    version: request.intent.version,
    initialTag: request.intent.distTag,
    access: request.intent.access,
    versionFacet: "accepted",
    initialTagFacet: "accepted"
  }),
  cliReportedFacts
})

/** Strictly decodes npm CLI 12.0.2 JSON and proves it describes the admitted bytes. */
export const decodeNpmPublishReceipt = Effect.fn("NpmNative.decodeReceipt")(function*(
  request: PreparedNpmPublishRequest,
  stdout: string
) {
  const parsed = yield* Effect.try({
    try: () => parseStrictJson(stdout),
    catch: () => invalidReceipt("malformed-json", "npm publish --json did not return strict JSON.")
  })
  const root = asObject(parsed)
  if (root === undefined) {
    return yield* invalidReceipt("shape-mismatch", "npm publish --json must return one keyed package object.")
  }
  const keys = Object.keys(root)
  const packageName = request.intent.packageName.toString()
  if (keys.length !== 1 || keys[0] !== packageName) {
    return yield* invalidReceipt("shape-mismatch", "npm publish --json did not return exactly the intended package key.")
  }
  const body = yield* Schema.decodeUnknownEffect(NpmCliReportedPackage, {
    onExcessProperty: "error"
  })(root[packageName]).pipe(Effect.mapError(() =>
    invalidReceipt("shape-mismatch", "npm publish --json did not match the documented npm 12 package shape.")))

  const version = request.intent.version.toString()
  if (body.id !== `${packageName}@${version}` || body.name.toString() !== packageName ||
      body.version.toString() !== version) {
    return yield* invalidReceipt("content-mismatch", "The npm success receipt reported a different package coordinate.")
  }
  if (body.size !== request.tarball.byteLength || body.filename !== request.tarball.filename ||
      body.shasum !== request.tarball.shasum || body.integrity !== request.tarball.integrity) {
    return yield* invalidReceipt("content-mismatch", "The npm success receipt reported different immutable tarball metadata.")
  }
  if (body.entryCount !== body.files.length) {
    return yield* invalidReceipt("shape-mismatch", "The npm success receipt entry count disagrees with its file list.")
  }
  return makeAcceptedReceipt(request, body)
})

export class NpmObservedValue
  extends Schema.TaggedClass<NpmObservedValue>()("NpmObservedValue", {
    value: Schema.String
  }) {}

export class NpmObservedAbsent
  extends Schema.TaggedClass<NpmObservedAbsent>()("NpmObservedAbsent", {}) {}

export const NpmObserved = Schema.Union([NpmObservedValue, NpmObservedAbsent])
export type NpmObserved = typeof NpmObserved.Type

export class NpmPublicationDifference
  extends Schema.Class<NpmPublicationDifference>("NpmPublicationDifference")({
    field: Schema.Literals(["name", "version", "integrity", "shasum", "dist-tag"]),
    expected: Schema.String,
    observed: NpmObserved
  }) {}

const NpmPublicationDifferences = Schema.NonEmptyArray(NpmPublicationDifference).pipe(
  Schema.check(Schema.makeFilter((differences) => {
    const fields = new Set<string>()
    for (const difference of differences) {
      if (fields.has(difference.field)) return `npm observation repeats ${difference.field}.`
      fields.add(difference.field)
      if (difference.observed instanceof NpmObservedValue &&
          difference.observed.value === difference.expected) {
        return `npm observation ${difference.field} is not different from its expected value.`
      }
    }
    return undefined
  }))
)

const observationVersion = { schemaVersion: Schema.Literal("npm-publication-observation/v1") } as const

export class NpmPublishedExact
  extends Schema.TaggedClass<NpmPublishedExact>()("NpmPublishedExact", {
    ...observationVersion,
    integrity: NpmSha512Integrity,
    shasum: Sha1Hex,
    distTagVersion: NpmVersion
  }) {}

export class NpmPublishedDifferent
  extends Schema.TaggedClass<NpmPublishedDifferent>()("NpmPublishedDifferent", {
    ...observationVersion,
    differences: NpmPublicationDifferences
  }) {}

export class NpmNotObserved
  extends Schema.TaggedClass<NpmNotObserved>()("NpmNotObserved", {
    ...observationVersion,
    scope: Schema.Literals(["package", "version"])
  }) {}

export class NpmObservationInconclusive
  extends Schema.TaggedClass<NpmObservationInconclusive>()("NpmObservationInconclusive", {
    ...observationVersion,
    status: Schema.Int,
    reason: Schema.NonEmptyString
  }) {}

export const NpmPublicationObservation = Schema.Union([
  NpmPublishedExact,
  NpmPublishedDifferent,
  NpmNotObserved,
  NpmObservationInconclusive
])
export type NpmPublicationObservation = typeof NpmPublicationObservation.Type

export interface NpmObservationRequest {
  readonly method: "GET"
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
}

export interface NpmRegistryResponse {
  readonly status: number
  readonly body: string | Uint8Array
}

export const npmObservationRequest = (intent: NpmPublishIntent): NpmObservationRequest => ({
  method: "GET",
  url: `${intent.registryUrl.toString()}${encodeURIComponent(intent.packageName.toString()).replace(/^%40/u, "@")}`,
  headers: { accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8" }
})

const asObject = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined

const responseJson = (body: string | Uint8Array): unknown | undefined => {
  try {
    const text = typeof body === "string" ? body : new TextDecoder("utf-8", { fatal: true }).decode(body)
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

const observedValue = (value: string): NpmObservedValue => NpmObservedValue.make({ value })
const difference = (
  field: NpmPublicationDifference["field"],
  expected: string,
  observed: string | undefined
): NpmPublicationDifference => NpmPublicationDifference.make({
  field,
  expected,
  observed: observed === undefined ? NpmObservedAbsent.make({}) : observedValue(observed)
})

/** Interprets a read without ever turning absence into dispatch authority. */
export const observeNpmPublication = (
  request: PreparedNpmPublishRequest,
  response: NpmRegistryResponse
): NpmPublicationObservation => {
  if (response.status === 404) {
    return NpmNotObserved.make({ schemaVersion: "npm-publication-observation/v1", scope: "package" })
  }
  if (response.status < 200 || response.status >= 300) {
    return NpmObservationInconclusive.make({
      schemaVersion: "npm-publication-observation/v1",
      status: response.status,
      reason: `npm package metadata returned HTTP ${response.status}.`
    })
  }
  const metadata = asObject(responseJson(response.body))
  const versions = metadata === undefined ? undefined : asObject(metadata.versions)
  const distTags = metadata === undefined ? undefined : asObject(metadata["dist-tags"])
  if (metadata === undefined || versions === undefined || distTags === undefined ||
      typeof metadata.name !== "string") {
    return NpmObservationInconclusive.make({
      schemaVersion: "npm-publication-observation/v1",
      status: response.status,
      reason: "npm package metadata was malformed or omitted versions or dist-tags."
    })
  }
  const packageName = request.intent.packageName.toString()
  if (metadata.name !== packageName) {
    return NpmPublishedDifferent.make({
      schemaVersion: "npm-publication-observation/v1",
      differences: [difference("name", packageName, metadata.name)]
    })
  }
  const version = request.intent.version.toString()
  const rawVersion = versions[version]
  if (rawVersion === undefined) {
    return NpmNotObserved.make({ schemaVersion: "npm-publication-observation/v1", scope: "version" })
  }
  const versionMetadata = asObject(rawVersion)
  const dist = versionMetadata === undefined ? undefined : asObject(versionMetadata.dist)
  if (versionMetadata === undefined || dist === undefined || typeof versionMetadata.name !== "string" ||
      typeof versionMetadata.version !== "string") {
    return NpmObservationInconclusive.make({
      schemaVersion: "npm-publication-observation/v1",
      status: response.status,
      reason: "The intended npm version metadata was malformed."
    })
  }
  let integrity
  let shasum
  try {
    integrity = parseNpmSha512Sri(dist.integrity)
    shasum = parseNpmSha1Shasum(dist.shasum)
  } catch {
    return NpmObservationInconclusive.make({
      schemaVersion: "npm-publication-observation/v1",
      status: response.status,
      reason: "The intended npm version omitted canonical integrity or shasum metadata."
    })
  }

  const differences: Array<NpmPublicationDifference> = []
  if (versionMetadata.name !== packageName) {
    differences.push(difference("name", packageName, versionMetadata.name))
  }
  if (versionMetadata.version !== version) {
    differences.push(difference("version", version, versionMetadata.version))
  }
  const expectedIntegrity = parseNpmSha512Sri(request.tarball.integrity)
  if (!digestEquals(integrity, expectedIntegrity)) {
    differences.push(difference("integrity", request.tarball.integrity, formatNpmSha512Sri(integrity)))
  }
  const expectedShasum = parseNpmSha1Shasum(request.tarball.shasum)
  if (!digestEquals(shasum, expectedShasum)) {
    differences.push(difference("shasum", request.tarball.shasum, formatNpmSha1Shasum(shasum)))
  }
  const tag = distTags[request.intent.distTag.toString()]
  if (tag !== version) {
    differences.push(difference("dist-tag", version, typeof tag === "string" ? tag : undefined))
  }
  if (differences.length > 0) {
    return NpmPublishedDifferent.make({
      schemaVersion: "npm-publication-observation/v1",
      differences: differences as [NpmPublicationDifference, ...Array<NpmPublicationDifference>]
    })
  }
  return NpmPublishedExact.make({
    schemaVersion: "npm-publication-observation/v1",
    integrity: request.tarball.integrity,
    shasum: request.tarball.shasum,
    distTagVersion: request.intent.version
  })
}

export class NpmDispatchRejectedBeforeStart
  extends Schema.TaggedErrorClass<NpmDispatchRejectedBeforeStart>()("NpmDispatchRejectedBeforeStart", {
    schemaVersion: Schema.Literal("npm-dispatch-error/v1"),
    commitment: Schema.Literal("before-dispatch"),
    reason: Schema.NonEmptyString
  }) {}

export class NpmDispatchResultUnavailable
  extends Schema.TaggedErrorClass<NpmDispatchResultUnavailable>()("NpmDispatchResultUnavailable", {
    schemaVersion: Schema.Literal("npm-dispatch-error/v1"),
    commitment: Schema.Literal("possible-dispatch"),
    reason: Schema.NonEmptyString
  }) {}

export class NpmCliExitUnsuccessful
  extends Schema.TaggedErrorClass<NpmCliExitUnsuccessful>()("NpmCliExitUnsuccessful", {
    schemaVersion: Schema.Literal("npm-dispatch-error/v1"),
    commitment: Schema.Literal("possible-dispatch"),
    exitCode: Schema.Int,
    reason: Schema.NonEmptyString
  }) {}

export class NpmObservationFailed
  extends Schema.TaggedErrorClass<NpmObservationFailed>()("NpmObservationFailed", {
    schemaVersion: Schema.Literal("npm-observation-error/v1"),
    reason: Schema.NonEmptyString
  }) {}

export interface NpmCliProcessExit {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export type NpmClientDispatchError = NpmDispatchRejectedBeforeStart | NpmDispatchResultUnavailable

export interface PreparedNpmDispatch {
  readonly request: PreparedNpmPublishRequest
  readonly run: Effect.Effect<NpmCliProcessExit, NpmClientDispatchError>
}

export interface NpmClientShape {
  /** Preflights and Scope-materializes exact owned bytes without dispatching. */
  readonly prepareDispatch: (
    request: PreparedNpmPublishRequest,
    tarballBytes: Uint8Array
  ) => Effect.Effect<PreparedNpmDispatch, NpmDispatchRejectedBeforeStart, Scope.Scope>
  readonly observe: (
    request: NpmObservationRequest
  ) => Effect.Effect<NpmRegistryResponse, NpmObservationFailed>
}

/** Supplied by one ordinary operation-local Layer; core has no provider singleton. */
export class NpmClient extends Context.Service<NpmClient, NpmClientShape>()(
  "ts-release/npm-native/NpmClient"
) {}

export const prepareNpmDispatch = Effect.fn("NpmNative.prepareDispatch")(function*(
  request: PreparedNpmPublishRequest,
  tarballBytes: Uint8Array
) {
  const client = yield* NpmClient
  if (tarballBytes.byteLength !== request.tarball.byteLength ||
      formatNpmSha1Shasum(sha1Digest(tarballBytes)) !== request.tarball.shasum ||
      formatNpmSha512Sri(sha512Digest(tarballBytes)) !== request.tarball.integrity) {
    return yield* new NpmDispatchRejectedBeforeStart({
      schemaVersion: "npm-dispatch-error/v1",
      commitment: "before-dispatch",
      reason: "npm dispatch bytes disagree with the immutable prepared request."
    })
  }
  const prepared = yield* client.prepareDispatch(request, Uint8Array.from(tarballBytes))
  // The operation Layer owns transport resources, never the admitted request
  // identity used to decode and journal its result.
  return Object.freeze({ request, run: prepared.run } satisfies PreparedNpmDispatch)
})

export const NpmDispatchError = Schema.Union([
  NpmDispatchRejectedBeforeStart,
  NpmDispatchResultUnavailable,
  NpmCliExitUnsuccessful
])
export type NpmDispatchError = typeof NpmDispatchError.Type

/**
 * Performs exactly one admitted npm invocation and never observes or retries.
 * The journal fold is the sole authority deciding whether this function may be
 * called; after possible-dispatch it must select observeNpm instead.
 */
export const dispatchNpm = Effect.fn("NpmNative.dispatch")(function*(
  prepared: PreparedNpmDispatch
) {
  const result = yield* prepared.run
  if (result.exitCode !== 0) {
    return yield* new NpmCliExitUnsuccessful({
      schemaVersion: "npm-dispatch-error/v1",
      commitment: "possible-dispatch",
      exitCode: result.exitCode,
      reason: `npm publish exited ${result.exitCode} after dispatch could have started.`
    })
  }
  return yield* decodeNpmPublishReceipt(prepared.request, result.stdout).pipe(
    Effect.catch((error) => Effect.succeed(makeAcceptedReceipt(
      prepared.request,
      NpmCliReportUnavailable.make({ kind: error.kind, reason: error.reason })
    )))
  )
})

/** Read-only provider observation. Every result is evidence, never dispatch authority. */
export const observeNpm = Effect.fn("NpmNative.observe")(function*(
  request: PreparedNpmPublishRequest
) {
  const client = yield* NpmClient
  const response = yield* client.observe(npmObservationRequest(request.intent))
  return observeNpmPublication(request, response)
})
