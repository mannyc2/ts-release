import { OutputDeclaration, Write } from "../model/operation.js"
import type { CandidateConfig } from "./config.js"
import { operationId, outputId, path, recordOutput, type CurrentRows } from "./current-shared.js"

export const lowerCurrentChangelog = (config: CandidateConfig, rows: CurrentRows): void => {
  if (config.publish.changelog === undefined) return
  const output = recordOutput(rows, OutputDeclaration.make({
    id: outputId("release-notes"), path: path(".release/notes.md"), kind: "file", provenance: "process"
  }))
  const content = `# ${config.project.name} ${config.project.version}\n\nRelease ${config.project.tag}.\n`
  rows.process.push(Write.make({
    id: operationId("changelog:base"), inputs: [], outputs: [output], path: output.path, content
  }))
}
