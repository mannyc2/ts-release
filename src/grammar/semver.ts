// Invariant: one parser owns release-version validity, normalization, and prerelease detection.
import * as Schema from "effect/Schema"

const numericIdentifier = "(?:0|[1-9]\\d*)"
const prereleaseIdentifier = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)"
const buildIdentifier = "(?:[0-9A-Za-z-]+)"
const semverPattern = new RegExp(
  `^(${numericIdentifier})\\.(${numericIdentifier})\\.(${numericIdentifier})` +
    `(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?` +
    `(?:\\+(${buildIdentifier}(?:\\.${buildIdentifier})*))?$`
)

export const SemverVersion = Schema.String.check(
  Schema.makeFilter((value: string) =>
    semverPattern.test(value) ? undefined : `Version ${value} is not a valid semver version.`
  )
)
export type SemverVersion = typeof SemverVersion.Type

export const parseSemverVersion = (value: string): SemverVersion | undefined =>
  semverPattern.test(value) ? value : undefined

export const hasSemverPrerelease = (value: string): boolean => {
  const match = semverPattern.exec(value)
  return match?.[4] !== undefined
}
