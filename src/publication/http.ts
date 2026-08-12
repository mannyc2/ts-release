import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import type { SubjectId } from "../model/authority.js"
import type { AnonymousAccess, CredentialAuthorityError, ScopedSecret } from "./authority.js"
import { PublicationError } from "./observation.js"

export type HttpRequest = {
  readonly method: "GET" | "POST"
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: Uint8Array | string
}
export type HttpResponse = {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: Uint8Array | string
}
export type PublicationHttp = {
  readonly request: (request: HttpRequest) => Effect.Effect<HttpResponse, PublicationError>
}

/** Read-only HTTP intent; authorization is injected and consumed by the host. */
export interface HttpObservationRequest {
  readonly subject: SubjectId
  readonly method: "GET"
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: Uint8Array | string
}

/** Host failure shared by authorization implementations without exposing secrets. */
export interface HttpAuthorizationError {
  readonly _tag: "CredentialPlatformError"
  readonly phase: "observe" | "mutate" | "resource" | "spawn"
  readonly commitment: "before-dispatch" | "unknown"
  readonly reason: string
}

export interface HttpAuthorizerShape {
  readonly execute: (
    input: HttpObservationRequest,
    grant: AnonymousAccess | ScopedSecret
  ) => Effect.Effect<HttpResponse, CredentialAuthorityError | HttpAuthorizationError>
}

/** Opaque observation sink implemented by a host platform layer. */
export class HttpAuthorizer
  extends Context.Service<HttpAuthorizer, HttpAuthorizerShape>()(
    "ts-release/HttpAuthorizer"
  ) {}

export const bodyText = (response: HttpResponse): string => typeof response.body === "string"
  ? response.body : new TextDecoder("utf-8", { fatal: true }).decode(response.body)

export const bodyJson = (response: HttpResponse): unknown => {
  try {
    return JSON.parse(bodyText(response)) as unknown
  } catch (cause) {
    throw PublicationError.make({ phase: "decode", commitment: "before-dispatch", reason: cause instanceof Error ? cause.message : String(cause) })
  }
}

export const authHeaders = (credential: string): Readonly<Record<string, string>> => ({
  authorization: `Bearer ${credential}`, accept: "application/json"
})
