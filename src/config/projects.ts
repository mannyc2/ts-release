import * as Schema from "effect/Schema"
import { ProjectId, SafeRelativePath } from "../model/primitives.js"
import { Stage } from "../model/run.js"

export class ProjectExecution extends Schema.Class<ProjectExecution>("ProjectExecution")({
  workers: Schema.NonEmptyArray(Schema.NonEmptyString), through: Stage
}) {}
export class ProjectScope extends Schema.Class<ProjectScope>("ProjectScope")({
  id: ProjectId, root: SafeRelativePath, tagPrefix: Schema.NonEmptyString,
  changelogScope: Schema.optionalKey(SafeRelativePath), execution: ProjectExecution
}) {}
