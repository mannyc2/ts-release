import { Effect, Schema } from "effect"
import { LogicalName, OwnedBundle, OwnedFile } from "./ArtifactModel.js"
import type { ContentOwner } from "./Content.js"
import { attempt, fail, reject } from "./Error.js"
import { canonical, compareText, decodeOwned } from "./Identity.js"

export type ChecksumInput = Readonly<{ publicName: string; file: OwnedFile }>
const Input = Schema.Struct({ publicName: Schema.String, file: OwnedFile })
const safeName = (name: string) => {
  if (!Schema.is(LogicalName)(name))
    fail("checksum-name", "Checksum names must be portable relative paths without controls")
  if (name.split("/").at(-1)!.toLowerCase() === "sha256sums")
    fail("checksum-self", "A checksum cannot include itself")
  return name
}
const prepare = (inputBundle: OwnedBundle, inputs: readonly ChecksumInput[]) =>
  attempt(() => {
    const bundle = decodeOwned(OwnedBundle, inputBundle)
    const members = new Map(bundle.artifacts.map((file) => [file.logicalName, file]))
    if (
      new Set(bundle.artifacts.map((file) => file.logicalName.toLowerCase())).size !==
        members.size ||
      members.size !== bundle.artifacts.length
    )
      fail("checksum-bundle", "Bundle logical names collide")
    const names = new Set<string>(),
      files = new Set<string>()
    return decodeOwned(Schema.Array(Input), inputs)
      .map(({ publicName, file }) => {
        if (publicName === "-") fail("checksum-stdin", "GNU checksum entries cannot select stdin")
        safeName(publicName)
        safeName(file.logicalName)
        const member = members.get(file.logicalName)
        if (!member || member._tag !== "OwnedFile" || canonical(member) !== canonical(file))
          fail("checksum-member", "Checksum file is not the exact owned Bundle member")
        if (names.has(publicName.toLowerCase()) || files.has(file.logicalName))
          fail("checksum-alias", "Checksum public names and selected artifacts must be unique")
        names.add(publicName.toLowerCase())
        files.add(file.logicalName)
        return { publicName, file }
      })
      .sort((a, b) => compareText(a.publicName, b.publicName))
  })
const render = (entries: readonly ChecksumInput[]) =>
  new TextEncoder().encode(
    entries.map(({ publicName, file }) => `${file.content.sha256}  ${publicName}\n`).join(""),
  )
/** A derived GNU SHA256SUMS view, without another durable identity or store. */
export const renderSha256Sums = Effect.fn("ts-release.renderSha256Sums")(function* (
  bundle: OwnedBundle,
  inputs: readonly ChecksumInput[],
) {
  return render(yield* prepare(bundle, inputs))
})
export const verifySha256Sums = Effect.fn("ts-release.verifySha256Sums")(function* (
  bundle: OwnedBundle,
  inputs: readonly ChecksumInput[],
  bytes: Uint8Array,
  verifyContent: ContentOwner["verify"],
) {
  const entries = yield* prepare(bundle, inputs)
  const expected = render(entries)
  if (bytes.length !== expected.length || !expected.every((value, index) => bytes[index] === value))
    return yield* reject("checksum-bytes", "SHA256SUMS differs from the exact Bundle view")
  for (const entry of entries) yield* verifyContent(entry.file.content)
})
