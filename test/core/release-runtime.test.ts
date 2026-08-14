import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { makePublicationHttp } from "../../src/platform/release-runtime.js"

describe("publication HTTP transport", () => {
  test("preserves explicit body media type and length at the Effect client boundary", async () => {
    const requests: Array<HttpClientRequest.HttpClientRequest> = []
    const client = HttpClient.make((request) => {
      requests.push(request)
      return Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: 201 })))
    })
    const body = new Uint8Array([1, 2, 3, 4])

    const response = await Effect.runPromise(makePublicationHttp(client).request({
      method: "POST",
      url: "https://uploads.example.test/archive",
      headers: {
        "content-type": "application/zip",
        "content-length": body.length.toString(),
        "x-release-test": "preserved"
      },
      body
    }))

    expect(response.status).toBe(201)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.headers).toMatchObject({
      "content-type": "application/zip",
      "content-length": "4",
      "x-release-test": "preserved"
    })
  })
})
