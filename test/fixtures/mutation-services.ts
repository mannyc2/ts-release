import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  AuthorizedMutationHttp,
  CertifiedPublisherSpawn,
  CredentialPlatformError,
  NpmUserConfigResource
} from "../../src/platform/credentials.js"

const unavailable = () => Effect.fail(new CredentialPlatformError({
  phase: "mutate",
  commitment: "before-dispatch",
  reason: "fixture mutation sink was not expected to be called"
}))

export const unavailableAuthorizedMutationHttp: AuthorizedMutationHttp["Service"] = {
  execute: unavailable
}

export const unavailableNpmUserConfigResource: NpmUserConfigResource["Service"] = {
  acquire: unavailable
}

export const unavailableCertifiedPublisherSpawn: CertifiedPublisherSpawn["Service"] = {
  preflightTrustedNpm: unavailable,
  spawn: unavailable
}

export const unavailableMutationServicesLayer = Layer.mergeAll(
  Layer.succeed(AuthorizedMutationHttp, unavailableAuthorizedMutationHttp),
  Layer.succeed(NpmUserConfigResource, unavailableNpmUserConfigResource),
  Layer.succeed(CertifiedPublisherSpawn, unavailableCertifiedPublisherSpawn)
)
