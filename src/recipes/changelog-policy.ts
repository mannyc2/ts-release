export type NoteEntry = { readonly path: string, readonly summary: string }
export type NoteGroup = {
  readonly title: string, readonly prefix: string,
  readonly subgroup?: string | undefined, readonly divider?: boolean | undefined
}
export const renderGroupedNotes = (
  entries: ReadonlyArray<NoteEntry>, filters: ReadonlyArray<string>, groups: ReadonlyArray<NoteGroup>
): string => groups.flatMap((group) => {
  const selected = entries.filter((entry) =>
    entry.path.startsWith(group.prefix) && !filters.some((prefix) => entry.path.startsWith(prefix)))
    .sort((left, right) => left.summary.localeCompare(right.summary) || left.path.localeCompare(right.path))
  if (selected.length === 0) return []
  return [`## ${group.title}`, ...(group.subgroup === undefined ? [] : [`### ${group.subgroup}`]),
    ...selected.map((entry) => `- ${entry.summary}`), ...(group.divider === true ? ["---"] : [])]
}).join("\n")
