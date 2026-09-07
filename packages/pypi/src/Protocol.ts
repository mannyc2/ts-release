import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  createOperation,
  makeRequest,
  NoReplay,
  RequestFacts,
  PROVIDER_CONTRACT,
  type Operation,
} from "@mannyc1/ts-release"
import { verifiedArtifacts, File, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import type { HttpProviderDefinition, HttpRead } from "@mannyc1/ts-release/http"
import { UploadIntent } from "./Model.js"
import { attempt, own, invalid, scopeFor, MAX_BYTES } from "./Native.js"
import { multipart, ownsRequest } from "./Wire.js"
import { inspect } from "./Metadata.js"
import {
  UploadReceipt,
  SimpleObservation,
  NativeFailure,
  receiptCorresponds,
  failureCorresponds,
  classifyObservation,
  observeResponse,
} from "./Evidence.js"

const descriptor = { definitionId: "pypi.upload", intentVersion: "1", intentCodec: UploadIntent }
export const upload = (input: UploadIntent, dependsOn: readonly string[] = []) =>
  createOperation(descriptor, input, dependsOn)
/** Validate the complete selected per-file set before creating its independent operations. */
export const author = Effect.fn("pypi.author")(function* (input: readonly UploadIntent[]) {
  const intents = yield* attempt(() => own(Schema.Array(UploadIntent), input))
  if (!intents.length) return yield* attempt(() => invalid("empty-file-set"))
  const names = new Set<string>(),
    artifacts = new Set<string>(),
    operations: Operation[] = []
  for (const intent of intents) {
    const group = JSON.stringify([intent.endpoint, intent.project, intent.version])
    const coordinate = `${group}:${intent.filename}`,
      artifact = `${group}:${intent.distribution.logicalName}`
    if (names.has(coordinate) || artifacts.has(artifact))
      return yield* attempt(() => invalid("duplicate-distribution"))
    names.add(coordinate)
    artifacts.add(artifact)
    operations.push(yield* upload(intent))
  }
  return operations
})
export const inspectDistribution = Effect.fn("pypi.inspectDistribution")(function* (
  file: File,
  filename: string,
  dependencies: ArtifactAccess,
) {
  const selected = yield* attempt(() => ({
    file: own(File, file),
    filename,
    read: verifiedArtifacts(dependencies, MAX_BYTES).read,
  }))
  const bytes = yield* selected.read(selected.file)
  return yield* attempt(() => inspect(selected.filename, bytes).metadata)
})
export const definitions = (
  dependencies: ArtifactAccess & { readonly read: HttpRead },
): readonly HttpProviderDefinition[] => {
  const artifacts = verifiedArtifacts(dependencies, MAX_BYTES),
    read = dependencies.read.bind(dependencies)
  const intentCodec = UploadIntent.check(
    Schema.makeFilter((intent) => artifacts.has(intent.distribution)),
  )
  const prepare = Effect.fn("pypi.prepare")(function* (operation: Operation) {
    const intent = yield* attempt(() => {
      if (
        operation.definitionId !== descriptor.definitionId ||
        operation.intentVersion !== descriptor.intentVersion
      )
        invalid("definition")
      return own(intentCodec, operation.intent)
    })
    const bytes = yield* artifacts.read(intent.distribution),
      native = yield* attempt(() => multipart(intent, bytes))
    return yield* makeRequest({
      transport: "core.http/1",
      method: "POST",
      endpoint: intent.endpoint.uploadUrl,
      principal: intent.authorization.principal,
      scope: scopeFor(intent),
      replay: new NoReplay({}),
      ...native,
    })
  })
  return [
    {
      ...descriptor,
      contract: PROVIDER_CONTRACT,
      intentCodec,
      prepare,
      ownsRequest,
      receiptVersion: "pypi-upload-receipt/1",
      receiptCodec: UploadReceipt,
      receiptCorresponds,
      classifyReceipt: () => "Satisfied",
      observationVersion: "pypi-simple-observation/1",
      observationCodec: SimpleObservation,
      classifyObservation,
      dispatchError: {
        version: "pypi-native-failure/1",
        codec: NativeFailure,
        corresponds: failureCorresponds,
      },
      decodeResponse: Effect.fn("pypi.decodeResponse")(function* (input, response) {
        const selected = yield* attempt(() => ({
          facts: own(RequestFacts, input.facts),
          body: new Uint8Array(input.body),
          status: response.status,
        }))
        if (!ownsRequest(selected)) return yield* attempt(() => invalid("response-request"))
        if (selected.status === 200)
          return {
            _tag: "Accepted",
            receipt: new UploadReceipt({ request: selected.facts, status: 200 }),
          }
        return {
          _tag: "Unknown",
          reason: "Python index did not acknowledge the exact upload",
          nativeError: new NativeFailure({
            request: selected.facts,
            status: selected.status,
            kind: "unclassified-response",
          }),
        }
      }),
      observe: Effect.fn("pypi.observe")(function* (operation, context) {
        const request = yield* prepare(operation),
          intent = own(UploadIntent, operation.intent)
        const response = yield* read({
          method: "GET",
          url: `${intent.endpoint.simpleUrl}${intent.project}/`,
          headers: [
            [
              "accept",
              "application/vnd.pypi.simple.v1+json, application/vnd.pypi.simple.v1+html;q=0.2, text/html;q=0.1",
            ],
          ],
          principal: intent.authorization.principal,
          scope: request.facts.scope,
        })
        const evidence = yield* attempt(() => observeResponse(request.facts, response))
        return { evidence, status: classifyObservation(operation, evidence, context.own.receipts) }
      }),
    },
  ]
}
