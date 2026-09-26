import * as Effect from "effect/Effect"
import { createHash, randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { chmod, link, mkdir, open, unlink, type FileHandle } from "node:fs/promises"
import { join } from "node:path"
import { AdoptionError, Content } from "../internal/ArtifactModel.js"
import type { ContentOwner } from "../internal/Content.js"
import { decodeOwned } from "../internal/Identity.js"

const READ_CAPACITY = 512 * 1024 * 1024
const failure = () =>
  new AdoptionError({ reason: "Owned content operation failed; bytes were not admitted" })
const attempt = <A>(body: () => A) => Effect.try({ try: body, catch: failure })
// Native file operations do not all accept AbortSignal. Settle each issued IO
// before releasing its handle; the surrounding workflow remains interruptible.
const io = <A>(body: () => Promise<A>) =>
  Effect.tryPromise({ try: body, catch: failure }).pipe(Effect.uninterruptible)
const close = (file: FileHandle) => io(() => file.close())
const identify = (bytes: Uint8Array): Content =>
  decodeOwned(Content, {
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  })
/** Read an open regular file to its end, refusing any deviation from `expected`. */
const scan = Effect.fn("content.scan")(function* (
  input: FileHandle,
  expected: Content,
  consume?: (bytes: Uint8Array) => Effect.Effect<void, AdoptionError>,
) {
  const stat = yield* io(() => input.stat())
  if (!stat.isFile() || stat.size !== expected.bytes) return yield* Effect.fail(failure())
  const hash = createHash("sha256"),
    buffer = Buffer.allocUnsafe(64 * 1024)
  let bytes = 0
  for (;;) {
    const { bytesRead } = yield* io(() => input.read(buffer, 0, buffer.length, null))
    if (!bytesRead) break
    bytes += bytesRead
    if (bytes > expected.bytes) return yield* Effect.fail(failure())
    const chunk = buffer.subarray(0, bytesRead)
    hash.update(chunk)
    if (consume) yield* consume(chunk)
  }
  if (bytes !== expected.bytes || hash.digest("hex") !== expected.sha256)
    return yield* Effect.fail(failure())
})

/** Immutable content names, exclusive temporary files and exact read-back on EEXIST. */
export const fileContentOwner = (directory: string): ContentOwner => {
  const withOwned = <A>(
    content: Content,
    use: (input: FileHandle) => Effect.Effect<A, AdoptionError>,
  ) =>
    Effect.acquireUseRelease(
      io(() =>
        open(
          join(directory, content.sha256),
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        ),
      ),
      use,
      close,
    )
  const persist = Effect.fn("content.persist")(function* (
    expected: Content,
    write: (output: FileHandle) => Effect.Effect<void, AdoptionError>,
  ) {
    yield* io(() => mkdir(directory, { recursive: true, mode: 0o700 }))
    const temporary = join(directory, `.copy-${randomUUID()}`)
    return yield* Effect.acquireUseRelease(
      io(() => open(temporary, "wx", 0o600)).pipe(
        Effect.map((output) => {
          let released = false
          const release = Effect.suspend(() => {
            if (released) return Effect.void
            released = true
            return close(output)
          }).pipe(Effect.uninterruptible)
          return { output, release }
        }),
      ),
      ({ output, release }) =>
        Effect.gen(function* () {
          yield* write(output)
          yield* io(() => output.sync())
          // Close the writer before immutable installation. The finalizer owns
          // the same one-time release, including cancellation before this point.
          yield* release
          yield* io(() => chmod(temporary, 0o400))
          yield* io(() =>
            link(temporary, join(directory, expected.sha256)).catch((error: unknown) => {
              if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
            }),
          )
          // An existing name is never accepted as proof of its contents.
          yield* withOwned(expected, (input) => scan(input, expected))
          yield* Effect.acquireUseRelease(
            io(() => open(directory, constants.O_RDONLY | constants.O_DIRECTORY)),
            (parent) => io(() => parent.sync()),
            close,
          )
          return expected
        }),
      ({ release }) => release.pipe(Effect.onExit(() => io(() => unlink(temporary)))),
    )
  })
  const putOwned = Effect.fn("content.putOwned")(function* (bytes: Uint8Array) {
    const expected = yield* attempt(() => identify(bytes))
    return yield* persist(expected, (output) => io(() => output.writeFile(bytes)))
  })
  return {
    putOwned: (input) => {
      // Ownership starts when called, before the returned Effect is run.
      return putOwned(new Uint8Array(input))
    },
    putFileOwned: Effect.fn("content.putFileOwned")(function* (source) {
      const { path, expected } = yield* attempt(() => {
        const { path, bytes, sha256 } = source
        const expected = decodeOwned(Content, { bytes, sha256 })
        if (typeof path !== "string" || path.includes("\0")) throw failure()
        return { path, expected }
      })
      return yield* Effect.acquireUseRelease(
        io(() => open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)),
        (input) =>
          persist(expected, (output) =>
            scan(input, expected, (bytes) => io(() => output.writeFile(bytes))),
          ),
        close,
      )
    }),
    verify: Effect.fn("content.verify")(function* (input) {
      const content = yield* attempt(() => decodeOwned(Content, input))
      yield* withOwned(content, (file) => scan(file, content))
    }),
    read: Effect.fn("content.read")(function* (input) {
      const content = yield* attempt(() => decodeOwned(Content, input))
      if (content.bytes > READ_CAPACITY) return yield* Effect.fail(failure())
      const chunks: Buffer[] = []
      yield* withOwned(content, (file) =>
        scan(file, content, (bytes) =>
          Effect.sync(() => {
            chunks.push(Buffer.from(bytes))
          }),
        ),
      )
      return new Uint8Array(Buffer.concat(chunks))
    }),
  }
}
