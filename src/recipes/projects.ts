import * as Schema from "effect/Schema"
import { ReleaseStages } from "../model/plan.js"
import { ProjectId, SafeRelativePath } from "../model/primitives.js"
import { Stage } from "../model/run.js"
import { ConfigValueError } from "../model/errors.js"

export class ProjectExecution extends Schema.Class<ProjectExecution>("ProjectExecution")({
  workers: Schema.NonEmptyArray(Schema.NonEmptyString), through: Stage
}) {}
export class ProjectScope extends Schema.Class<ProjectScope>("ProjectScope")({
  id: ProjectId, root: SafeRelativePath, tagPrefix: Schema.NonEmptyString,
  changelogScope: Schema.optionalKey(SafeRelativePath), execution: ProjectExecution
}) {}

const qualify = (value: unknown, key: string, project: ProjectScope): unknown => {
  if (typeof value === "string") {
    if (key === "id" || key === "outputId" || key === "inputs")
      return `${project.id}:${value}`
    if (key === "tag") return `${project.tagPrefix}${value}`
    if (["path", "cwd", "packagePath", "artifactPaths"].includes(key) && project.root !== ".")
      return value === "." ? project.root : `${project.root}/${value}`
    return value
  }
  if (Array.isArray(value)) return value.map((item) => qualify(item, key, project))
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(Object.entries(value).map(([childKey, item]) =>
    [childKey, qualify(item, childKey, project)]))
}
export const lowerProjects = (
  stages: ReleaseStages, projects: ReadonlyArray<ProjectScope>
): ReleaseStages => {
  const roots = projects.map((project) => String(project.root))
  if (new Set(projects.map((project) => String(project.id))).size !== projects.length ||
    roots.some((root, index) => roots.some((other, otherIndex) =>
      index !== otherIndex && (root === other || root.startsWith(`${other}/`) || other.startsWith(`${root}/`)))))
    throw ConfigValueError.make({ reason: "Project ids and roots must be unique and nonoverlapping." })
  const encoded = Schema.encodeSync(ReleaseStages)(stages)
  return Schema.decodeUnknownSync(ReleaseStages)(Object.fromEntries(
    Object.entries(encoded).map(([stage, operations]) => [
      stage, projects.flatMap((project) => operations.map((operation) =>
        qualify(operation, "", project)))
    ])
  ))
}
