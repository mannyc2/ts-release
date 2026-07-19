// Invariant: every workspace-relative read or write is validated before joining and can never escape its root.
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"

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
  pathName: string,
  options: { readonly allowAbsolute?: boolean } = {}
) => {
  if (
    pathName.trim().length === 0 ||
    hasParentTraversal(pathName) ||
    (options.allowAbsolute === false && path.isAbsolute(pathName))
  ) {
    return {
      _tag: "Invalid" as const,
      reason: "empty-or-parent-traversal" as const
    }
  }
  const targetPath = resolveWorkspacePath(path, root, pathName)
  if (isInsidePathBoundary(path, root, targetPath)) {
    return {
      _tag: "Ok" as const,
      path: targetPath
    }
  }
  return {
    _tag: "Invalid" as const,
    reason: "outside-root" as const
  }
}

export const resolveWorkspaceWritePathEffect = <E>(
  path: Path.Path,
  root: string,
  pathName: string,
  makeError: (pathName: string, reason: string) => E,
  options?: { readonly allowAbsolute?: boolean }
): Effect.Effect<string, E> => {
  const result = validateWorkspaceWritePath(path, root, pathName, options)
  return result._tag === "Ok"
    ? Effect.succeed(result.path)
    : Effect.fail(makeError(pathName, result.reason === "empty-or-parent-traversal"
      ? "Path must be non-empty and must not contain parent traversal."
      : "Path must resolve inside the workspace root."))
}

export const writeWorkspaceFile = <E>(
  root: string,
  pathName: string,
  contents: string,
  makeError: (pathName: string, reason: string, cause?: unknown) => E
): Effect.Effect<void, E, FileSystem.FileSystem | Path.Path> => Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const target = yield* resolveWorkspaceWritePathEffect(path, root, pathName, makeError)
  yield* fs.makeDirectory(path.dirname(target), { recursive: true }).pipe(
    Effect.andThen(fs.writeFileString(target, contents)),
    Effect.mapError((cause) => makeError(pathName, cause.message, cause))
  )
})
