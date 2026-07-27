import { hashFramed } from "../model/canonical.js"
import { OutputDeclaration, ReadCredential, ReviewedNoteTransform, Write } from "../model/operation.js"
import { CredentialName } from "../model/primitives.js"
import type { CandidateConfig } from "./config.js"
import { renderGroupedNotes } from "./changelog-policy.js"
import { operationId, outputId, path, recordOutput, type CurrentRows } from "./current-shared.js"

export const lowerCurrentChangelog = (config: CandidateConfig, rows: CurrentRows): void => {
  const section = config.publish.changelog
  if (section === undefined && (config.publish.announce?.length ?? 0) === 0) return
  const output = recordOutput(rows, OutputDeclaration.make({
    id: outputId("release-notes"), path: path(".release/notes.md"), kind: "file", provenance: "process"
  }))
  const grouped = renderGroupedNotes(
    [{ path: ".", summary: `Release ${config.project.tag}.` }],
    section?.pathFilters ?? [], section?.groups ?? [])
  const content = `# ${config.project.name} ${config.project.version}\n\n${
    grouped === "" ? `Release ${config.project.tag}.` : grouped}\n`
  rows.process.push(Write.make({
    id: operationId("changelog:base"), inputs: [], outputs: [output], path: output.path, content
  }))
  if (section?.mode !== "reviewed-transform") return
  if (section.profileId !== "changelog.reviewed-transform/v1")
    throw new Error("Reviewed transform mode requires its immutable profile.")
  const final = recordOutput(rows, OutputDeclaration.make({
    id: outputId("final-notes"), path: path(".release/final-notes.md"), kind: "file", provenance: "process"
  }))
  rows.validate.push(ReviewedNoteTransform.make({
    id: operationId("changelog:reviewed-transform"), inputs: [output.id], outputs: [final],
    profileId: section.profileId, maximumOutputBytes: 65_536,
    policyDigest: hashFramed("ts-release/reviewed-note-policy/v1", [new TextEncoder().encode("normalize-markdown")]),
    credential: ReadCredential.make({ name: CredentialName.make("NOTE_TRANSFORM_READ") }),
    contractFixtureId: "contract.changelog.reviewed-transform/v1"
  }))
}
