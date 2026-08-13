import * as Schema from "effect/Schema"

export const PyPiRepository = Schema.Literals(["pypi", "testpypi"])
export type PyPiRepository = typeof PyPiRepository.Type

export const normalizePyPiProjectName = (value: string): string => {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u.test(value)) {
    throw new Error("PyPI project names may contain only ASCII letters, digits, period, underscore, and hyphen.")
  }
  return value.toLowerCase().replace(/[-_.]+/gu, "-")
}

export const PyPiProjectName = Schema.NonEmptyString.check(Schema.makeFilter((value: string) => {
  try {
    return normalizePyPiProjectName(value) === value ? undefined : "PyPI project name must be normalized."
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }
})).pipe(Schema.brand("PyPiProjectName"))
export type PyPiProjectName = typeof PyPiProjectName.Type

export interface PyPiRepositoryEndpoints {
  readonly simpleBaseUrl: string
  readonly uploadUrl: string
}

export const pypiRepositoryEndpoints = (repository: PyPiRepository): PyPiRepositoryEndpoints =>
  repository === "pypi"
    ? { simpleBaseUrl: "https://pypi.org/simple/", uploadUrl: "https://upload.pypi.org/legacy/" }
    : { simpleBaseUrl: "https://test.pypi.org/simple/", uploadUrl: "https://test.pypi.org/legacy/" }
