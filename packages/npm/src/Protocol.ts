import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  ReleaseError,
  PROVIDER_CONTRACT,
  NoReplay,
  createOperation,
  makeRequest,
  type Operation,
  RequestFacts,
} from "@mannyc1/ts-release"
import { File, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import type { HttpRead, HttpProviderDefinition } from "@mannyc1/ts-release/http"
import {
  PublishIntent,
  DistTagIntent,
  PackageCandidate,
  PrivatePackage,
  publishCodec,
  PackageMetadata,
  ProvenanceSource,
  type VerifyProvenance,
  name,
  version,
} from "./Model.js"

import {
  attempt,
  own,
  captureArtifacts,
  scopeFor,
  readScope,
  endpointFor,
  encode,
  invalid,
  readManifest,
} from "./Native.js"
import { publishBody, tarballDigests } from "./Wire.js"
import { statement, validateProvenance } from "./Auth.js"
import {
  RegistryObservation,
  RegistryReceipt,
  ownsRequest,
  receiptCorresponds,
  classifyObservation,
  observeResponse,
} from "./Evidence.js"

export const publishDescriptor = {
  definitionId: "npm.publish",
  intentVersion: "1",
  intentCodec: publishCodec,
}
export const tagDescriptor = {
  definitionId: "npm.dist-tag",
  intentVersion: "1",
  intentCodec: DistTagIntent,
}
export const publish = (input: PublishIntent, dependsOn: readonly string[] = []) =>
  createOperation(publishDescriptor, input, dependsOn)
export const distTag = (input: DistTagIntent, dependsOn: readonly string[] = []) =>
  createOperation(tagDescriptor, input, dependsOn)
export const author = Effect.fn("npm.author")(function* (input: {
  readonly packages: readonly PackageCandidate[]
  readonly tagMoves: readonly DistTagIntent[]
}) {
  const candidates = yield* attempt(() => own(Schema.Array(PackageCandidate), input.packages))
  const moves = yield* attempt(() => own(Schema.Array(DistTagIntent), input.tagMoves))
  const operations: Operation[] = [],
    omittedPrivate: PrivatePackage[] = [],
    names = new Set<string>()
  for (const candidate of candidates) {
    const name = candidate._tag === "PrivatePackage" ? candidate.name : candidate.publication.name
    if (names.has(name))
      return yield* new ReleaseError({
        code: "npm-duplicate-package",
        message: "Workspace package names must be unique",
      })
    names.add(name)
    if (candidate._tag === "PrivatePackage") omittedPrivate.push(candidate)
    else operations.push(yield* publish(candidate.publication))
  }
  for (const move of moves) {
    const related = operations.filter(
      (operation) =>
        operation.definitionId === publishDescriptor.definitionId &&
        (operation.intent as PublishIntent).name === move.name &&
        (operation.intent as PublishIntent).version === move.version,
    )
    operations.push(
      yield* distTag(
        move,
        related.map((operation) => operation.operationId),
      ),
    )
  }
  return { operations, omittedPrivate }
})

/** Explicit provider composition. Artifact membership is admitted with every
 * Plan before reads; exact bytes and native metadata are checked before sends. */
export const definitions = (
  dependencies: ArtifactAccess & {
    readonly read: HttpRead
    readonly verifyProvenance?: VerifyProvenance
  },
): readonly HttpProviderDefinition[] => {
  const artifacts = captureArtifacts(dependencies),
    read = dependencies.read.bind(dependencies),
    verifyProvenance = dependencies.verifyProvenance?.bind(dependencies)
  const descriptors = [
    {
      ...publishDescriptor,
      intentCodec: publishCodec.check(
        Schema.makeFilter(
          (intent) =>
            artifacts.has(intent.tarball) &&
            (intent.provenance._tag === "NoProvenance" ||
              (verifyProvenance !== undefined && artifacts.has(intent.provenance.bundle))),
        ),
      ),
    },
    tagDescriptor,
  ] as const
  return descriptors.map((descriptor): HttpProviderDefinition => {
    const prepare = Effect.fn("npm.prepare")(function* (operation: Operation) {
      const intent = yield* attempt(() => {
        if (
          operation.definitionId !== descriptor.definitionId ||
          operation.intentVersion !== descriptor.intentVersion
        )
          invalid("operation-definition")
        return descriptor.definitionId === "npm.publish"
          ? own(descriptors[0].intentCodec, operation.intent)
          : own(DistTagIntent, operation.intent)
      })
      const scope = scopeFor(intent)
      let tarball: Uint8Array | undefined, body: Uint8Array
      if ("tarball" in intent) {
        tarball = yield* artifacts.read(intent.tarball)
        let provenance: Uint8Array | undefined
        if (intent.provenance._tag === "GitHubActionsProvenance") {
          const provenanceSource = intent.provenance.source
          provenance = yield* artifacts.read(intent.provenance.bundle)
          yield* attempt(() =>
            validateProvenance(
              provenance!,
              statement(
                {
                  ...intent,
                  source: provenanceSource,
                },
                tarball!,
              ),
            ),
          )
          body = yield* attempt(() => publishBody(intent, tarball!, provenance))
          const publicBytes = new Uint8Array(provenance)
          yield* verifyProvenance!({
            source: own(ProvenanceSource, intent.provenance.source),
            bundleBytes: publicBytes,
          })
        } else body = yield* attempt(() => publishBody(intent, tarball!))
      } else body = encode(intent.version)
      const request = yield* makeRequest({
        transport: "core.http/1",
        endpoint: endpointFor(readScope(scope)),
        method: "PUT",
        headers: [["content-type", "application/json"]],
        body,
        principal: intent.authorization.principal,
        scope,
        replay: new NoReplay({}),
      })
      return request
    })
    return {
      ...descriptor,
      contract: PROVIDER_CONTRACT,
      receiptVersion: "npm-registry-receipt/1",
      receiptCodec: RegistryReceipt,
      receiptCorresponds,
      classifyReceipt: () => "Satisfied",
      observationVersion: "npm-registry-observation/1",
      observationCodec: RegistryObservation,
      classifyObservation,
      prepare: Effect.fn("npm.prepareRequest")(function* (operation) {
        return yield* prepare(operation)
      }),
      ownsRequest: (request) => ownsRequest(descriptor.definitionId, request),
      decodeResponse: Effect.fn("npm.decodeResponse")(function* (request, response) {
        const selected = yield* attempt(() => ({
          facts: own(RequestFacts, request.facts),
          body: new Uint8Array(request.body),
          status: response.status,
        }))
        if (!ownsRequest(descriptor.definitionId, { facts: selected.facts, body: selected.body }))
          return yield* new ReleaseError({
            code: "npm-response-binding",
            message: "npm response request could not be admitted",
          })
        const accepted =
          descriptor.definitionId === "npm.publish"
            ? selected.status === 201
            : Number.isInteger(selected.status) && selected.status >= 200 && selected.status < 300
        if (!accepted)
          return { _tag: "Unknown", reason: "npm did not acknowledge the exact native write" }
        return {
          _tag: "Accepted",
          receipt: new RegistryReceipt({
            request: selected.facts,
            status: selected.status,
            responseBody: "not-used-as-publication-facts",
          }),
        }
      }),
      observe: Effect.fn("npm.observe")(function* (operation, context) {
        const request = yield* prepare(operation)
        const response = yield* read({
          method: "GET",
          url: endpointFor(readScope(request.facts.scope), true),
          headers: [["accept", "application/json"]],
          principal: request.facts.principal,
          scope: request.facts.scope,
        })
        const evidence = yield* attempt(() => observeResponse(request.facts, response))
        return { status: classifyObservation(operation, evidence, context.own.receipts), evidence }
      }),
    }
  })
}

/** Read exact owned bytes once to author immutable native package coordinates. */
export const inspectTarball = Effect.fn("npm.inspectTarball")(function* (
  file: File,
  dependencies: ArtifactAccess,
) {
  const selected = yield* attempt(() => ({
    file: own(File, file),
    read: captureArtifacts(dependencies).read,
  }))
  const bytes = yield* selected.read(selected.file)
  return yield* attempt(() => {
    const manifest = readManifest(bytes)
    if (manifest.private !== undefined && typeof manifest.private !== "boolean")
      invalid("manifest-private")
    const { integrity, shasum } = tarballDigests(bytes)
    return new PackageMetadata({
      name: own(name, manifest.name),
      version: own(version, manifest.version),
      private: manifest.private === true,
      integrity,
      shasum,
    })
  })
})
