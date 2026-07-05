const numericIdentifier = "(?:0|[1-9]\\d*)"
const prereleaseIdentifier = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)"
const buildIdentifier = "(?:[0-9A-Za-z-]+)"
const semverPattern = new RegExp(
  `^(${numericIdentifier})\\.(${numericIdentifier})\\.(${numericIdentifier})` +
    `(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?` +
    `(?:\\+(${buildIdentifier}(?:\\.${buildIdentifier})*))?$`
)

export const parseSemverVersion = (value: string): string | undefined =>
  semverPattern.test(value) ? value : undefined

export const hasSemverPrerelease = (value: string): boolean => {
  const match = semverPattern.exec(value)
  return match?.[4] !== undefined
}
