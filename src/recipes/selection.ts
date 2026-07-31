import * as Schema from "effect/Schema"
import { OutputId, SafeRelativePath } from "../model/primitives.js"

const formats = Schema.Literals(["archive", "file", "directory", "oci-image", "executable", "binary"])
export class CandidateSelection extends Schema.Class<CandidateSelection>("CandidateSelection")({
  ids: Schema.optionalKey(Schema.NonEmptyArray(OutputId)),
  formats: Schema.optionalKey(Schema.NonEmptyArray(formats)),
  pathPrefixes: Schema.optionalKey(Schema.NonEmptyArray(SafeRelativePath))
}) {}
export interface SelectableOutput {
  readonly id: string
  readonly format: string
  readonly path: string
}
export const selectOutputs = (
  selector: CandidateSelection | undefined,
  outputs: ReadonlyArray<SelectableOutput>
): ReadonlyArray<SelectableOutput> => outputs.filter((output) =>
  (selector?.ids === undefined || selector.ids.includes(OutputId.make(output.id))) &&
  (selector?.formats === undefined || selector.formats.some((format) => format === output.format)) &&
  (selector?.pathPrefixes === undefined ||
    selector.pathPrefixes.some((prefix) =>
      output.path === prefix || output.path.startsWith(`${prefix}/`)))
)
