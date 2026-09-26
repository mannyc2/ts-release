import { Effect, Schema } from "effect"
import { ReleaseError } from "@mannyc1/ts-release"
import { Bundle, File } from "@mannyc1/ts-release/bundle"
import { publicUrl } from "@mannyc1/ts-release/http"

export const Text = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      value.length > 0 &&
      value.length <= 4096 &&
      value === value.normalize("NFC") &&
      // oxlint-disable-next-line no-control-regex -- release text excludes controls while retaining valid Unicode scalar values.
      !/[\u0000-\u001f\u007f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      ),
  ),
)
export const Url = Text.check(Schema.makeFilter((value) => publicUrl(value)?.href === value))
export const Executable = Text.check(
  Schema.makeFilter(
    (value) =>
      !/[\\:*?"<>|]/u.test(value) &&
      value
        .split("/")
        .every(
          (part) =>
            part !== "" &&
            part !== "." &&
            part !== ".." &&
            !/[. ]$/u.test(part) &&
            !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part),
        ),
  ),
)
export const decode = <A, I>(codec: Schema.Codec<A, I>, input: unknown): A =>
  Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(input)
const equivalent = Schema.toEquivalence(File)
const inputError = () =>
  new ReleaseError({
    code: "catalog-input",
    message: "Catalog metadata or exact owned download could not be admitted",
  })
const isReleaseError = Schema.is(Schema.Struct(ReleaseError.fields))
export const downloads = (
  bundle: Bundle,
  archives: Readonly<Record<string, { readonly url: string; readonly file: File }>>,
) => {
  const owned = decode(Bundle, bundle)
  if (new Set(owned.artifacts.map((file) => file.logicalName)).size !== owned.artifacts.length)
    throw inputError()
  const locations = new Map<string, string>()
  for (const { url, file } of Object.values(archives)) {
    if (!owned.artifacts.some((member) => member._tag === "OwnedFile" && equivalent(member, file)))
      throw inputError()
    const previous = locations.get(url)
    if (previous !== undefined && previous !== file.content.sha256) throw inputError()
    locations.set(url, file.content.sha256)
  }
}
export const renderBytes = (render: () => string) =>
  Effect.suspend(() => {
    try {
      return Effect.succeed(new TextEncoder().encode(render()))
    } catch (error) {
      if (error instanceof ReleaseError) return Effect.fail(error)
      if (isReleaseError(error))
        return Effect.fail(new ReleaseError({ code: error.code, message: error.message }))
      if (Schema.isSchemaError(error)) return Effect.fail(inputError())
      return Effect.die(error)
    }
  })
