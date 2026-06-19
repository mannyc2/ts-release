import type * as Path from "effect/Path"

export type WorkspacePathBoundaryReason = "empty-or-parent-traversal" | "outside-root"

export interface WorkspacePathOk {
  readonly _tag: "Ok"
  readonly path: string
}

export interface WorkspacePathInvalid {
  readonly _tag: "Invalid"
  readonly reason: WorkspacePathBoundaryReason
}

export type WorkspacePathResult = WorkspacePathOk | WorkspacePathInvalid

export const hasParentTraversal = (pathName: string): boolean =>
  pathName.split(/[\\/]+/).includes("..")

const isWindowsAbsolutePath = (pathName: string): boolean =>
  /^[A-Za-z]:[\\/]/.test(pathName) || /^[/\\]{2}[^/\\]+[/\\][^/\\]+/.test(pathName)

const trimTrailingSeparators = (pathName: string): string => {
  if (/^[A-Za-z]:[\\/]?$/.test(pathName)) {
    return pathName
  }
  const trimmed = pathName.replace(/[\\/]+$/, "")
  return trimmed.length === 0 ? pathName : trimmed
}

const stripLeadingCurrentDirectory = (pathName: string): string =>
  pathName.replace(/^\.[\\/]+/, "")

const joinWindowsAbsolutePath = (root: string, pathName: string): string => {
  const relative = stripLeadingCurrentDirectory(pathName)
  if (relative.length === 0 || relative === ".") {
    return root
  }
  return `${trimTrailingSeparators(root)}/${relative.replace(/^[\\/]+/, "")}`
}

const resolvedRootPath = (path: Path.Path, root: string): string => {
  if (isWindowsAbsolutePath(root)) {
    return root
  }
  return path.resolve(root)
}

const normalizedWindowsBoundary = (pathName: string): string =>
  trimTrailingSeparators(pathName).replaceAll("\\", "/").toLowerCase()

export const resolveWorkspacePath = (path: Path.Path, root: string, pathName: string): string => {
  const rootPath = resolvedRootPath(path, root)
  if (path.isAbsolute(pathName)) {
    return path.resolve(pathName)
  }
  if (isWindowsAbsolutePath(pathName)) {
    return pathName
  }
  if (isWindowsAbsolutePath(rootPath)) {
    return joinWindowsAbsolutePath(rootPath, pathName)
  }
  return path.resolve(rootPath, pathName)
}

export const isInsidePathBoundary = (path: Path.Path, root: string, targetPath: string): boolean => {
  const rootPath = resolvedRootPath(path, root)
  if (isWindowsAbsolutePath(rootPath) || isWindowsAbsolutePath(targetPath)) {
    const normalizedRoot = normalizedWindowsBoundary(rootPath)
    const normalizedTarget = normalizedWindowsBoundary(targetPath)
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`)
  }
  const relative = path.relative(rootPath, targetPath)
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

export const validateWorkspaceWritePath = (
  path: Path.Path,
  root: string,
  pathName: string
): WorkspacePathResult => {
  if (pathName.trim().length === 0 || hasParentTraversal(pathName)) {
    return {
      _tag: "Invalid",
      reason: "empty-or-parent-traversal"
    }
  }
  const rootPath = resolvedRootPath(path, root)
  const targetPath = resolveWorkspacePath(path, rootPath, pathName)
  if (isInsidePathBoundary(path, rootPath, targetPath)) {
    return {
      _tag: "Ok",
      path: targetPath
    }
  }
  return {
    _tag: "Invalid",
    reason: "outside-root"
  }
}
