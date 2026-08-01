import { realpathSync } from "node:fs"
import { isAbsolute, relative, sep } from "node:path"

// Lexical: is `path` at or beneath `root`? Both must already be in the same
// canonical form (use assertContained with realpath when symlinks may be
// present).
export const contained = (root: string, path: string): boolean => {
  const value = relative(root, path)
  return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value))
}
export const assertContained = (
  root: string, path: string,
  options: { readonly realpath: boolean, readonly what: string }
): string => {
  const candidate = options.realpath ? realpathSync(path) : path
  if (!contained(options.realpath ? realpathSync(root) : root, candidate)) {
    throw new Error(`${options.what} escapes the workspace root.`)
  }
  return candidate
}
