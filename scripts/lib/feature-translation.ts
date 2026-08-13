import { readFileSync } from "node:fs"
import { join } from "node:path"

export interface FeatureTranslationReport {
  readonly families: number
  readonly paths: number
  readonly failures: ReadonlyArray<string>
}

const rows = (source: string, expression: RegExp): ReadonlyArray<readonly [string, string]> =>
  [...source.matchAll(expression)].map((match) => [match[1]!, match[2]!] as const)

/**
 * Validate the historical Plan-207 ledger by semantic family, not merely by
 * globally seeing every K id. This specifically prevents npm paths from being
 * assigned to the adjacent nightly section.
 */
export const validateFeatureTranslation = (root: string): FeatureTranslationReport => {
  const directory = join(root, "docs", "release-program", "decisions")
  const familyRows = rows(
    readFileSync(join(directory, "207-current-config-families.txt"), "utf8"),
    /^(S\d{3})\s+(\S+)$/gmu
  )
  const pathRows = rows(
    readFileSync(join(directory, "207-current-config-paths.txt"), "utf8"),
    /^(K\d{3})\s+(\S+)$/gmu
  )
  const ledger = readFileSync(join(directory, "207-feature-translation-ledger.md"), "utf8")
  const assignments = new Map<string, ReadonlyArray<string>>()
  for (const match of ledger.matchAll(
    /^## (S\d{3}):[^\n]*\n[\s\S]*?^- \*\*Current paths\*\*:([^\n]*)$/gmu
  )) {
    assignments.set(match[1]!, match[2]!.trim().length === 0
      ? []
      : match[2]!.trim().split(/\s+/u))
  }

  const failures: Array<string> = []
  const paths = new Map(pathRows)
  const seen = new Map<string, string>()
  for (const [section, family] of familyRows) {
    const actual = assignments.get(section)
    if (actual === undefined) {
      failures.push(`${section}/${family} has no ledger Current paths row`)
      continue
    }
    const expected = pathRows
      .filter(([, path]) => path.startsWith(`/$defs/${family}/`))
      .map(([id]) => id)
    if (actual.join(" ") !== expected.join(" ")) {
      failures.push(`${section}/${family} must own exactly ${expected.join(" ")}; got ${actual.join(" ")}`)
    }
    for (const id of actual) {
      const path = paths.get(id)
      if (path === undefined) failures.push(`${section}/${family} names unknown path ${id}`)
      else if (!path.startsWith(`/$defs/${family}/`)) {
        failures.push(`${section}/${family} owns foreign path ${id}: ${path}`)
      }
      const previous = seen.get(id)
      if (previous !== undefined) failures.push(`${id} is assigned to both ${previous} and ${section}`)
      seen.set(id, section)
    }
  }
  for (const [id] of pathRows) if (!seen.has(id)) failures.push(`${id} has no family ledger owner`)
  for (const section of assignments.keys()) {
    if (!familyRows.some(([id]) => id === section)) failures.push(`${section} has no declared config family`)
  }
  return { families: familyRows.length, paths: pathRows.length, failures }
}
