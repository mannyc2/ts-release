import { constants, type Stats } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

const contained = (root: string, target: string): boolean => {
  const pathFromRoot = relative(root, target)
  return pathFromRoot === "" ||
    (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromRoot))
}

const sameFile = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.mode === right.mode &&
  left.nlink === right.nlink &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

/**
 * Reads an exact repository-relative regular file without following any
 * symlink component and rejects replacement or mutation during the read.
 */
export const readStableContainedRegularFile = async (
  repositoryRoot: string,
  repositoryRelativePath: string
): Promise<Uint8Array> => {
  const exactRoot = await realpath(repositoryRoot)
  const lexicalPath = resolve(exactRoot, repositoryRelativePath)
  if (!contained(exactRoot, lexicalPath)) {
    throw new Error("lexical path escapes the repository root")
  }
  const exactPath = await realpath(lexicalPath)
  if (exactPath !== lexicalPath) {
    throw new Error("repository path must not traverse a symbolic-link alias")
  }

  const beforePath = await lstat(lexicalPath)
  if (!beforePath.isFile() || beforePath.isSymbolicLink()) {
    throw new Error("repository path must be a non-symlink regular file")
  }
  const handle = await open(lexicalPath, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const beforeHandle = await handle.stat()
    if (!beforeHandle.isFile() || !sameFile(beforePath, beforeHandle)) {
      throw new Error("repository file changed before its stable read began")
    }
    const bytes = await handle.readFile()
    const afterHandle = await handle.stat()
    const afterPath = await lstat(lexicalPath)
    const afterRealPath = await realpath(lexicalPath)
    if (!afterHandle.isFile() || !afterPath.isFile() || afterPath.isSymbolicLink() ||
      afterRealPath !== lexicalPath || !sameFile(beforeHandle, afterHandle) ||
      !sameFile(beforeHandle, afterPath) || afterHandle.size !== bytes.byteLength) {
      throw new Error("repository file changed while its bytes were read")
    }
    return new Uint8Array(bytes)
  } finally {
    await handle.close()
  }
}
