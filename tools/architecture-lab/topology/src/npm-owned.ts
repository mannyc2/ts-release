import { Effect, Schema } from "effect"
import { LabError, sha256, type ProviderDefinition } from "@lab/kernel"
import { npm, NpmIntent } from "./npm.js"

export class ContentRef extends Schema.Class<ContentRef>("ContentRef")({
  bytes: Schema.String.check(Schema.isPattern(/^(0|[1-9][0-9]*)$/)),
  sha256: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))
}) {}
export class OwnedNpmIntent extends Schema.Class<OwnedNpmIntent>("OwnedNpmIntent")({
  registry: Schema.String, packageName: Schema.String, version: Schema.String,
  initialTag: Schema.String, filename: Schema.String, integrity: Schema.String, content: ContentRef
}) {}
const decode = Schema.decodeUnknownSync(OwnedNpmIntent, { onExcessProperty: "error" })
const nativeIntent = (intent: OwnedNpmIntent, tarballBase64: string) => new NpmIntent({
  registry:intent.registry,packageName:intent.packageName,version:intent.version,
  initialTag:intent.initialTag,filename:intent.filename,integrity:intent.integrity,tarballBase64
})

/** Content ownership is supplied by the application; durable intent contains only identity. */
export const ownedNpm = (readContent: (content: ContentRef) => Effect.Effect<Uint8Array, LabError>): ProviderDefinition => ({
  ...npm, definitionId: "npm.publish-content", intentCodec: OwnedNpmIntent,
  prepare: Effect.fn("OwnedNpm.prepare")(function*(operation,context) {
    const intent=decode(operation.intent)
    const bytes=yield* readContent(intent.content)
    if (String(bytes.byteLength)!==intent.content.bytes || (yield* sha256(bytes))!==intent.content.sha256) {
      return yield* Effect.fail(new LabError({code:"npm.owned-content",message:"Owned bytes do not match intent"}))
    }
    const digest=yield* Effect.promise(()=>globalThis.crypto.subtle.digest("SHA-512",new Uint8Array(bytes)))
    const base64=(value:Uint8Array)=>btoa(Array.from(value,byte=>String.fromCharCode(byte)).join(""))
    if (`sha512-${base64(new Uint8Array(digest))}`!==intent.integrity) {
      return yield* Effect.fail(new LabError({code:"npm.owned-integrity",message:"Owned bytes do not match npm integrity"}))
    }
    return yield* npm.prepare({...operation,intent:nativeIntent(intent,base64(bytes))},context)
  }),
  observe: (operation,context) => npm.observe!({...operation,intent:nativeIntent(decode(operation.intent),"")},context),
  classifyObservation: (operation,evidence,receipts) => npm.classifyObservation!({
    ...operation,intent:nativeIntent(decode(operation.intent),"")
  },evidence,receipts)
})
