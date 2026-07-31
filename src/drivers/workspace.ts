import * as Effect from "effect/Effect"
import {
  chmodSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync,
  mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync
} from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import { join, relative, sep } from "node:path"
import { Digest, SnapshotId } from "../model/primitives.js"
import { DriverError, MaterializedOutput } from "../model/run.js"
import { SnapshotRequest, VerifiedContentHandle, type WorkspaceStoreShape } from "./services.js"

const fail = (reason: string): DriverError => DriverError.make({ reason, commitment: "before-commit" })
const beneath = (root: string, path: string): boolean => {
  const value = relative(root, path)
  return value === "" || value !== ".." && !value.startsWith(`..${sep}`)
}
const secureBytes = (root: string, path: string): { bytes: Uint8Array; inode: number } => {
  let current = root
  for (const part of path.split(/[\\/]+/u)) {
    current = join(current, part)
    if (lstatSync(current).isSymbolicLink()) throw fail("Structured read encountered a symlink.")
  }
  const descriptor = openSync(current, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const opened = fstatSync(descriptor)
    const resolved = realpathSync(current)
    if (!beneath(root, resolved)) throw fail("Opened file escaped the workspace root.")
    const landed = lstatSync(resolved)
    if (landed.ino !== opened.ino || landed.dev !== opened.dev) throw fail("Opened file changed identity.")
    return { bytes: readFileSync(descriptor), inode: opened.ino }
  } finally {
    closeSync(descriptor)
  }
}
const persist = (directory: string, digest: string, bytes: Uint8Array): void => {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const root = realpathSync(directory)
  if (root !== directory) throw fail("Snapshot directory was not realpath-normalized.")
  const target = join(root, digest)
  if (existsSync(target)) return
  const temporary = join(directory, `.${randomUUID()}.snapshot.tmp`)
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW
  const descriptor = openSync(temporary, flags, 0o600)
  try {
    writeFileSync(descriptor, bytes)
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  try {
    renameSync(temporary, target)
    chmodSync(target, 0o400)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}
export const makeNodeWorkspaceStore = (): WorkspaceStoreShape => ({
  snapshot: Effect.fn("WorkspaceStore.snapshot")((request: SnapshotRequest) => Effect.try({ try: () => {
        const root = realpathSync(request.root)
        if (root !== request.root) throw fail("WorkspaceRoot was not realpath-normalized.")
        const source = secureBytes(root, request.source)
        const digest = createHash("sha256").update(source.bytes).digest("hex")
        persist(request.snapshotDirectory, digest, source.bytes)
        return MaterializedOutput.make({ outputId: request.outputId,
          snapshotId: SnapshotId.make(digest),
          digest: Digest.make(digest), size: source.bytes.length, inode: source.inode
        })
      },
      catch: (cause) => cause instanceof DriverError ? cause : fail(String(cause))
    })),
  verify: Effect.fn("WorkspaceStore.verify")((directory, facts) => Effect.try({ try: () => {
        if (!/^[a-f0-9]{64}$/u.test(facts.snapshotId)) throw fail("Snapshot id is not a digest.")
        const path = join(directory, facts.snapshotId)
        const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
        try {
          return VerifiedContentHandle.from(facts, readFileSync(descriptor))
        } finally {
          closeSync(descriptor)
        }
      },
      catch: (cause) => cause instanceof DriverError ? cause : fail(String(cause))
    }))
})
