/** Derived GNU SHA256SUMS view. No checksum identity or store is introduced. */
import { Effect, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import { OwnedBundle, OwnedFile, type ContentOwner } from "../apple/adoption.js"
import { LabError } from "../machine/src/index.js"

export interface ChecksumInput {
  readonly publicName: string
  readonly file: OwnedFile
}
const invalid = (message: string): never => { throw new Error(message) }
const safeName = (name: string) => {
  Schema.decodeUnknownSync(Artifact.PortableRelativePath)(name)
  if (name !== name.normalize("NFC") || [...name].length > 1024 || /[\u0000-\u001f\u007f]/u.test(name)) invalid("Checksum name must be bounded NFC text without control characters")
  if (name.split("/").at(-1)!.toLowerCase() === "sha256sums") invalid("A checksum cannot include itself")
  return name
}
const codePointOrder = (left: string, right: string) => {
  const a = [...left], b = [...right]
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!
    if (difference) return difference
  }
  return a.length - b.length
}
const admit = (bundle: OwnedBundle, inputs: readonly ChecksumInput[]) => {
  const decoded = Schema.decodeUnknownSync(OwnedBundle, { onExcessProperty: "error" })(bundle)
  const members = new Map<string, typeof decoded.artifacts[number]>()
  const bundleNames = new Set<string>()
  for (const artifact of decoded.artifacts) {
    const key = artifact.logicalName.toLowerCase()
    if (bundleNames.has(key)) invalid("Bundle logical names collide")
    bundleNames.add(key)
    members.set(artifact.logicalName, artifact)
  }
  const names = new Set<string>(), artifacts = new Set<string>()
  const entries = inputs.map(input => {
    const selected = Schema.decodeUnknownSync(Schema.Struct({ publicName: Schema.String, file: OwnedFile }), { onExcessProperty: "error" })(input)
    const publicName = safeName(selected.publicName)
    safeName(selected.file.logicalName)
    const member = members.get(selected.file.logicalName)
    const encode = Schema.encodeSync(OwnedFile)
    if (!member || member._tag !== "OwnedFile") throw new Error("Checksum file is not an admitted Bundle File")
    if (JSON.stringify(encode(member)) !== JSON.stringify(encode(selected.file))) invalid("Checksum file is not the exact admitted Bundle member")
    if (names.has(publicName.toLowerCase())) invalid("Checksum public names collide")
    if (artifacts.has(member.logicalName)) invalid("One artifact cannot have two checksum aliases")
    names.add(publicName.toLowerCase())
    artifacts.add(member.logicalName)
    // A schema JSON roundtrip severs caller aliases before any asynchronous read.
    const file = Schema.decodeUnknownSync(OwnedFile)(JSON.parse(JSON.stringify(encode(member))))
    return { publicName, file }
  }).sort((a, b) => codePointOrder(a.publicName, b.publicName))
  return entries
}
const prepared = (bundle: OwnedBundle, inputs: readonly ChecksumInput[]) => Effect.try({
  try: () => admit(bundle, inputs),
  catch: cause => new LabError({ code: "checksum-input", message: String(cause) })
})
const render = (entries: readonly ChecksumInput[]) => new TextEncoder().encode(entries.map(entry => `${entry.file.content.sha256}  ${entry.publicName}\n`).join(""))
export const renderSha256Sums = Effect.fn(function*(bundle: OwnedBundle, inputs: readonly ChecksumInput[]) {
  return render(yield* prepared(bundle, inputs))
})
export const verifySha256Sums = Effect.fn(function*(bundle: OwnedBundle, inputs: readonly ChecksumInput[], bytes: Uint8Array, verifyContent: ContentOwner["verify"]) {
  const entries = yield* prepared(bundle, inputs)
  const expected = render(entries)
  if (bytes.length !== expected.length || !expected.every((value, index) => bytes[index] === value)) return yield* new LabError({ code: "checksum-bytes", message: "SHA256SUMS differs from the exact Bundle-derived view" })
  for (const entry of entries) yield* verifyContent(entry.file.content)
})
