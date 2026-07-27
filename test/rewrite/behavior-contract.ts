import * as Schema from "effect/Schema"

export class BehaviorIdentity extends Schema.Class<BehaviorIdentity>("BehaviorIdentity")({
  name: Schema.String, version: Schema.String, tag: Schema.String,
  commit: Schema.String, snapshot: Schema.Boolean, versionSource: Schema.String
}) {}
export class BehaviorOutput extends Schema.Class<BehaviorOutput>("BehaviorOutput")({
  id: Schema.String, path: Schema.String, kind: Schema.String, provenance: Schema.String,
  platform: Schema.optionalKey(Schema.Json), size: Schema.optionalKey(Schema.Number),
  digest: Schema.optionalKey(Schema.String)
}) {}
export class BehaviorEffect extends Schema.Class<BehaviorEffect>("BehaviorEffect")({
  sequence: Schema.Number, stage: Schema.String, authority: Schema.String,
  kind: Schema.String, description: Schema.String, details: Schema.Json
}) {}
export class BehaviorApproval extends Schema.Class<BehaviorApproval>("BehaviorApproval")({
  sequence: Schema.Number, execute: Schema.Boolean, irreversible: Schema.Boolean
}) {}
export class BehaviorRetry extends Schema.Class<BehaviorRetry>("BehaviorRetry")({
  sequence: Schema.Number, attempts: Schema.Number, delayMillis: Schema.Number
}) {}
export class BehaviorContract extends Schema.Class<BehaviorContract>("BehaviorContract")({
  identity: BehaviorIdentity,
  outputs: Schema.Array(BehaviorOutput),
  effects: Schema.Array(BehaviorEffect),
  renderedFiles: Schema.Array(Schema.Struct({ path: Schema.String, bytes: Schema.String })),
  approvals: Schema.Array(BehaviorApproval),
  retries: Schema.Array(BehaviorRetry),
  execution: Schema.Struct({ scope: Schema.Array(Schema.String), frontier: Schema.String }),
  traces: Schema.Struct({
    commands: Schema.Array(Schema.Json), http: Schema.Array(Schema.Json),
    fileWrites: Schema.Array(Schema.Json), durableStates: Schema.Array(Schema.Json)
  }),
  outcome: Schema.String
}) {}

export const encodeBehaviorContract = Schema.encodeSync(BehaviorContract)
export const decodeBehaviorContract = Schema.decodeUnknownSync(BehaviorContract, {
  onExcessProperty: "error"
})
