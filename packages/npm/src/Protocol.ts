import { Effect, Schema } from "effect"
import * as Core from "@mannyc1/ts-release"
import * as Bundle from "@mannyc1/ts-release/bundle"
import type { HttpRead, HttpProviderDefinition } from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"
import * as Native from "./Native.js"
import { publishBody, tarballDigests } from "./Wire.js"
import { statement, validateProvenance } from "./Auth.js"
import * as Evidence from "./Evidence.js"

export const publishDescriptor = Core.defineProvider("npm.publish", Model.publishCodec)
export const tagDescriptor = Core.defineProvider("npm.dist-tag", Model.DistTagIntent)
export const publish = (input: Model.PublishIntent, dependsOn: readonly string[] = []) =>
  Core.createOperation(publishDescriptor, input, dependsOn)
export const distTag = (input: Model.DistTagIntent, dependsOn: readonly string[] = []) =>
  Core.createOperation(tagDescriptor, input, dependsOn)
export const author = Effect.fn("npm.author")(function* (input: {
  readonly packages: readonly Model.PackageCandidate[]
  readonly tagMoves: readonly Model.DistTagIntent[]
}) {
  const candidates = yield* Native.attempt(() =>
    Native.own(Schema.Array(Model.PackageCandidate), input.packages),
  )
  const moves = yield* Native.attempt(() =>
    Native.own(Schema.Array(Model.DistTagIntent), input.tagMoves),
  )
  const operations: Core.Operation[] = [],
    omittedPrivate: Model.PrivatePackage[] = [],
    names = new Set<string>()
  for (const candidate of candidates) {
    const name = candidate._tag === "PrivatePackage" ? candidate.name : candidate.publication.name
    if (names.has(name))
      return yield* Native.reject("npm-duplicate-package", "Workspace package names must be unique")
    names.add(name)
    if (candidate._tag === "PrivatePackage") omittedPrivate.push(candidate)
    else operations.push(yield* publish(candidate.publication))
  }
  for (const move of moves) {
    const related = operations.filter(
      (operation) =>
        operation.definitionId === publishDescriptor.definitionId &&
        (operation.intent as Model.PublishIntent).name === move.name &&
        (operation.intent as Model.PublishIntent).version === move.version,
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
  dependencies: Bundle.ArtifactAccess & {
    readonly read: HttpRead
    readonly verifyProvenance?: Model.VerifyProvenance
  },
): readonly HttpProviderDefinition[] => {
  const artifacts = Native.captureArtifacts(dependencies),
    read = dependencies.read.bind(dependencies),
    verifyProvenance = dependencies.verifyProvenance?.bind(dependencies)
  const descriptors = [
    {
      ...publishDescriptor,
      intentCodec: Model.publishCodec.check(
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
    const prepare = Effect.fn("npm.prepare")(function* (operation: Core.Operation) {
      const intent = yield* Native.attempt(() =>
        Native.ownOperation(
          descriptor.intentCodec as Schema.Codec<
            Model.PublishIntent | Model.DistTagIntent,
            unknown
          >,
          descriptor,
          operation,
        ),
      )
      const scope = Native.scopeFor(intent)
      let body: Uint8Array
      if ("tarball" in intent) {
        const tarball = yield* artifacts.read(intent.tarball)
        if (intent.provenance._tag === "GitHubActionsProvenance") {
          const provenanceSource = intent.provenance.source,
            provenance = yield* artifacts.read(intent.provenance.bundle)
          body = yield* Native.attempt(() => {
            validateProvenance(
              provenance,
              statement({ ...intent, source: provenanceSource }, tarball),
            )
            return publishBody(intent, tarball, provenance)
          })
          yield* verifyProvenance!({
            source: Native.own(Model.ProvenanceSource, provenanceSource),
            bundleBytes: new Uint8Array(provenance),
          })
        } else body = yield* Native.attempt(() => publishBody(intent, tarball))
      } else body = Native.encode(intent.version)
      return yield* Core.makeRequest({
        transport: "core.http/1",
        endpoint: Native.endpointFor(Native.readScope(scope)),
        method: "PUT",
        headers: [["content-type", "application/json"]],
        body,
        principal: intent.authorization.principal,
        scope,
        replay: new Core.NoReplay({}),
      })
    })
    return {
      ...descriptor,
      contract: Core.PROVIDER_CONTRACT,
      receiptVersion: "npm-registry-receipt/1",
      receiptCodec: Evidence.RegistryReceipt,
      receiptCorresponds: Evidence.receiptCorresponds,
      classifyReceipt: () => "Satisfied",
      observationVersion: "npm-registry-observation/1",
      observationCodec: Evidence.RegistryObservation,
      classifyObservation: Evidence.classifyObservation,
      prepare,
      ownsRequest: (request) => Evidence.ownsRequest(descriptor.definitionId, request),
      decodeResponse: Effect.fn("npm.decodeResponse")(function* (request, response) {
        const selected = yield* Native.attempt(() => ({
          ...Native.ownRequest(request),
          status: response.status,
        }))
        if (!Evidence.ownsRequest(descriptor.definitionId, selected))
          return yield* Native.reject(
            "npm-response-binding",
            "npm response request could not be admitted",
          )
        const accepted =
          descriptor.definitionId === "npm.publish"
            ? selected.status === 201
            : Number.isInteger(selected.status) && selected.status >= 200 && selected.status < 300
        if (!accepted)
          return { _tag: "Unknown", reason: "npm did not acknowledge the exact native write" }
        return {
          _tag: "Accepted",
          receipt: new Evidence.RegistryReceipt({
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
          url: Native.endpointFor(Native.readScope(request.facts.scope), true),
          headers: [["accept", "application/json"]],
          principal: request.facts.principal,
          scope: request.facts.scope,
        })
        const evidence = yield* Native.attempt(() =>
          Evidence.observeResponse(request.facts, response),
        )
        return {
          status: Evidence.classifyObservation(operation, evidence, context.own.receipts),
          evidence,
        }
      }),
    }
  })
}

/** Read exact owned bytes once to author immutable native package coordinates. */
export const inspectTarball = Effect.fn("npm.inspectTarball")(function* (
  file: Bundle.File,
  dependencies: Bundle.ArtifactAccess,
) {
  const selected = yield* Native.attempt(() => ({
    file: Native.own(Bundle.File, file),
    read: Native.captureArtifacts(dependencies).read,
  }))
  const bytes = yield* selected.read(selected.file)
  return yield* Native.attempt(() => {
    const manifest = Native.readManifest(bytes)
    if (manifest.private !== undefined && typeof manifest.private !== "boolean")
      Native.invalid("manifest-private")
    const { integrity, shasum } = tarballDigests(bytes)
    return new Model.PackageMetadata({
      name: Native.own(Model.name, manifest.name),
      version: Native.own(Model.version, manifest.version),
      private: manifest.private === true,
      integrity,
      shasum,
    })
  })
})
