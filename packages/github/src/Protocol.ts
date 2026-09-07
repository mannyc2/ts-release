import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  makeRequest,
  PROVIDER_CONTRACT,
  type Operation,
  type ProviderContext,
} from "@mannyc1/ts-release"
import { verifiedArtifacts, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import type { HttpProviderDefinition, HttpRead } from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"
import { descriptors, intentOf, kindOf, validatePlan, type Intent } from "./Graph.js"
import { bindScope, readScope } from "./Binding.js"
import { attempt, invalid, responseObject } from "./Native.js"
import { nativeRequest, ownsRequest, requestCorresponds } from "./Wire.js"
import {
  Receipt,
  NativeFailure,
  Observation,
  decodeFacts,
  receiptCorresponds,
  failureCorresponds,
  classifyObservation,
} from "./Evidence.js"
import { observations } from "./Observe.js"

export const definitions = (
  dependencies: ArtifactAccess & { readonly read: HttpRead },
): readonly HttpProviderDefinition[] => {
  const artifacts = verifiedArtifacts(dependencies, 2 ** 31 - 1),
    reader = observations(dependencies.read.bind(dependencies))
  return Object.values(descriptors).map((descriptor) => {
    const intentCodec = (descriptor.intentCodec as Schema.Codec<Intent, unknown>).check(
      Schema.makeFilter(
        (intent) => !(intent instanceof Model.AssetIntent) || artifacts.has(intent.file),
      ),
    )
    const owns: HttpProviderDefinition["ownsRequest"] = (request) => {
      try {
        return (
          readScope(request.facts.scope).operation.definitionId === descriptor.definitionId &&
          ownsRequest(request)
        )
      } catch {
        return false
      }
    }
    return {
      ...descriptor,
      intentCodec,
      contract: PROVIDER_CONTRACT,
      validatePlan,
      prepare: Effect.fn("github.prepare")(function* (
        operation: Operation,
        context: ProviderContext,
      ) {
        const scope = yield* attempt(() => {
            if (operation.definitionId !== descriptor.definitionId) invalid("definition")
            Schema.decodeUnknownSync(intentCodec, { onExcessProperty: "error" })(operation.intent)
            return bindScope(operation, context)
          }),
          intent = intentOf(operation)
        yield* reader.preflight(operation, context)
        const bytes =
          intent instanceof Model.AssetIntent ? yield* artifacts.read(intent.file) : undefined
        return yield* makeRequest(yield* attempt(() => nativeRequest(scope, bytes)))
      }),
      requestCorresponds,
      ownsRequest: owns,
      receiptVersion: "github-receipt/1",
      receiptCodec: Receipt,
      receiptCorresponds,
      classifyReceipt: () => "Satisfied",
      dispatchError: {
        version: "github-native-failure/1",
        codec: NativeFailure,
        corresponds: failureCorresponds,
      },
      observationVersion: "github-observation/1",
      observationCodec: Observation,
      classifyObservation,
      observe: reader.observe,
      decodeResponse: Effect.fn("github.decodeResponse")(function* (request, response) {
        return yield* attempt(() => {
          if (!owns(request)) invalid("response-request")
          const scope = readScope(request.facts.scope),
            status = kindOf(scope.operation) === "publish" ? 200 : 201
          let kind: NativeFailure["kind"] = "http-status"
          if (response.status === status) {
            try {
              const receipt = new Receipt({
                request: request.facts,
                status,
                facts: decodeFacts(scope, responseObject(response)),
              })
              if (receiptCorresponds(scope.operation, request.facts, receipt))
                return { _tag: "Accepted" as const, receipt }
              kind = "different-native"
            } catch {
              kind = "malformed-native"
            }
          }
          return {
            _tag: "Unknown" as const,
            reason: "GitHub did not acknowledge the exact native operation",
            nativeError: new NativeFailure({
              request: request.facts,
              status: response.status,
              kind,
            }),
          }
        })
      }),
    } satisfies HttpProviderDefinition
  })
}
