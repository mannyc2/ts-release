import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import type { SubjectId } from "../model/authority.js"
import type {
  AnonymousAccess,
  CredentialAuthorityError,
  PublisherOperation,
  ScopedSecret
} from "./authority.js"

/** Raw host transport failure. Provider meaning is assigned only by the
 * authority-checking sink/adapter that knows whether dispatch started. */
export class PublicationHttpError
  extends Schema.TaggedErrorClass<PublicationHttpError>()("PublicationHttpError", {
    commitment: Schema.Literals(["before-dispatch", "unknown"]),
    reason: Schema.String
  }) {}

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
  readonly request: (request: HttpRequest) => Effect.Effect<HttpResponse, PublicationHttpError>
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

export interface MutationHttpRequest {
  readonly method: "POST"
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: Uint8Array | string
}

export interface AuthorizedMutationHttpShape {
  readonly execute: (
    operation: PublisherOperation,
    request: MutationHttpRequest,
    grant: ScopedSecret
  ) => Effect.Effect<HttpResponse, CredentialAuthorityError | HttpAuthorizationError>
}

/** Host-owned mutation HTTP sink; callers never receive or inject credentials. */
export class AuthorizedMutationHttp
  extends Context.Service<AuthorizedMutationHttp, AuthorizedMutationHttpShape>()(
    "ts-release/AuthorizedMutationHttp"
  ) {}

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
    throw PublicationHttpError.make({ commitment: "before-dispatch", reason: cause instanceof Error ? cause.message : String(cause) })
  }
}

export const authHeaders = (credential: string): Readonly<Record<string, string>> => ({
  authorization: `Bearer ${credential}`, accept: "application/json"
})
