export type {} from "./internal/EffectTypes.js"
import * as Schema from "effect/Schema"
import { RequestFacts } from "./internal/ReleaseModel.js"

/** Native response envelope binds the observed acknowledgement to exact send facts. */
export class HttpReceipt extends Schema.Class<HttpReceipt>("HttpReceipt")({
  status: Schema.Number,
  body: Schema.String,
  endpoint: Schema.String,
  method: Schema.String,
  bodyDigest: Schema.String,
}) {}
export const corresponds = (request: RequestFacts, receipt: unknown): boolean => {
  const value = Schema.decodeUnknownSync(HttpReceipt)(receipt)
  return (
    value.status >= 200 &&
    value.status < 300 &&
    value.endpoint === request.endpoint &&
    value.method === request.method &&
    value.bodyDigest === request.bodyDigest
  )
}
