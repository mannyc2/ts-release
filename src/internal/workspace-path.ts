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

export const resolveWorkspacePath = (path: Path.Path, root: string, pathName: string): string => {
  const rootPath = path.resolve(root)
  return path.isAbsolute(pathName)
    ? path.resolve(pathName)
    : path.resolve(rootPath, pathName)
}

export const isInsidePathBoundary = (path: Path.Path, root: string, targetPath: string): boolean => {
  const relative = path.relative(path.resolve(root), targetPath)
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
  const rootPath = path.resolve(root)
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
