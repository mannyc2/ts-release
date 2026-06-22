import type * as Path from "effect/Path"

export type WorkspacePathBoundaryReason = "empty-or-parent-traversal" | "outside-root"

export type WorkspacePathResult =
  | {
    readonly _tag: "Ok"
    readonly path: string
  }
  | {
    readonly _tag: "Invalid"
    readonly reason: WorkspacePathBoundaryReason
  }

export const hasParentTraversal = (pathName: string): boolean =>
  pathName.split(/[\\/]+/).includes("..")

export const resolveWorkspacePath = (path: Path.Path, root: string, pathName: string): string => {
  const rootPath = path.resolve(root)
  if (path.isAbsolute(pathName)) {
    return path.resolve(pathName)
  }
  return path.resolve(rootPath, pathName)
}

export const isInsidePathBoundary = (path: Path.Path, root: string, targetPath: string): boolean => {
  const rootPath = path.resolve(root)
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
  const targetPath = resolveWorkspacePath(path, root, pathName)
  if (isInsidePathBoundary(path, root, targetPath)) {
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

export const workspacePathBoundaryReasonMessage = (reason: WorkspacePathBoundaryReason): string =>
  reason === "empty-or-parent-traversal"
    ? "Path must be non-empty and must not contain parent traversal."
    : "Path must resolve inside the workspace root."
