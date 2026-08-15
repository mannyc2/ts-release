import {
  chmodSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync,
  mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { contained } from "./contain.js"
import { DriverError } from "./errors.js"

const fail = (reason: string): DriverError => DriverError.make({ reason, commitment: "before-commit" })

/** Create private scratch beneath the host temp root and return its canonical path.
 * macOS commonly exposes that root through /var while realpath resolves /private/var. */
export const makeCanonicalTemporaryDirectory = (prefix: string): string =>
  realpathSync(mkdtempSync(join(realpathSync(tmpdir()), prefix)))

export const secureRead = (
  root: string,
  path: string,
  options: { readonly maxBytes?: number } = {}
): { readonly bytes: Uint8Array, readonly inode: number } => {
  let current = root
  for (const part of path.split(/[\\/]+/u)) {
    current = join(current, part)
    if (lstatSync(current).isSymbolicLink()) throw fail("Structured read encountered a symlink.")
  }
  const descriptor = openSync(current, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const opened = fstatSync(descriptor)
    const resolved = realpathSync(current)
    if (!contained(root, resolved)) throw fail("Opened file escaped the workspace root.")
    const landed = lstatSync(resolved)
    if (landed.ino !== opened.ino || landed.dev !== opened.dev) throw fail("Opened file changed identity.")
    if (options.maxBytes !== undefined && opened.size > options.maxBytes) {
      throw fail(`Structured read size ${opened.size} exceeds the ${options.maxBytes}-byte limit.`)
    }
    return { bytes: new Uint8Array(readFileSync(descriptor)), inode: opened.ino }
  } finally { closeSync(descriptor) }
}

export const secureWrite = (root: string, path: string, bytes: Uint8Array | string): void => {
  const parts = path.split(/[\\/]+/u).filter((part) => part.length > 0)
  let parent = root
  for (const part of parts.slice(0, -1)) {
    parent = join(parent, part)
    mkdirSync(parent, { recursive: true })
    if (lstatSync(parent).isSymbolicLink()) throw fail("Structured write encountered a symlink.")
  }
  const target = join(parent, parts.at(-1)!)
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw fail("Structured write encountered a symlink.")
  const descriptor = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o644)
  try { writeFileSync(descriptor, bytes); fsyncSync(descriptor) } finally { closeSync(descriptor) }
}
