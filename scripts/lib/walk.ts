import { existsSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

export const collectTypeScriptFiles = (
  directory: string,
  options?: {
    readonly skipDirectory?: (name: string) => boolean
  }
): Array<string> => {
  if (!existsSync(directory)) {
    return []
  }
  const files: Array<string> = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (options?.skipDirectory?.(entry.name) !== true) {
        files.push(...collectTypeScriptFiles(path, options))
      }
      continue
    }
    if (entry.isFile() && path.endsWith(".ts")) {
      files.push(path)
    }
  }
  return files
}

export const requireDirectory = (directory: string, gate: string): string => {
  if (!existsSync(directory)) {
    throw new Error(
      `${gate}: declared scan root ${directory} does not exist; ` +
      `a rename or deletion must update the gate's root list in the same change.`
    )
  }
  return directory
}

export const makeDisplayPath = (root: string) => (path: string): string =>
  relative(root, path).replaceAll("\\", "/")
