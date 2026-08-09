import * as Effect from "effect/Effect"
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
