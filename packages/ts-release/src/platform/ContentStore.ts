import * as Effect from "effect/Effect"
import { createHash, randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { chmod, link, mkdir, open, unlink, type FileHandle } from "node:fs/promises"
import { join } from "node:path"
import { AdoptionError, Content } from "../internal/ArtifactModel.js"
import type { ContentOwner } from "../internal/Content.js"
import { decodeOwned } from "../internal/Identity.js"

const READ_CAPACITY = 512 * 1024 * 1024
const io = <A>(body: () => Promise<A>) =>
  Effect.tryPromise({
    try: body,
    catch: () =>
      new AdoptionError({ reason: "Owned content operation failed; bytes were not admitted" }),
  })
const identify = (bytes: Uint8Array): Content =>
  decodeOwned(Content, {
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  })
/** Read an open regular file to its end, refusing any deviation from `expected`. */
const scan = async (
  input: FileHandle,
  expected: Content,
  consume?: (bytes: Uint8Array) => Promise<void>,
) => {
  const stat = await input.stat()
  if (!stat.isFile() || stat.size !== expected.bytes) throw new Error("Expected regular file")
  const hash = createHash("sha256"),
    buffer = Buffer.allocUnsafe(64 * 1024)
  let bytes = 0
  for (;;) {
    const { bytesRead } = await input.read(buffer, 0, buffer.length, null)
    if (!bytesRead) break
    bytes += bytesRead
    if (bytes > expected.bytes) throw new Error("Content grew")
    const chunk = buffer.subarray(0, bytesRead)
    hash.update(chunk)
    if (consume) await consume(chunk)
  }
  if (bytes !== expected.bytes || hash.digest("hex") !== expected.sha256)
    throw new Error("Content identity mismatch")
}

/** Immutable content names, exclusive temporary files and exact read-back on EEXIST. */
export const fileContentOwner = (directory: string): ContentOwner => {
  const withOwned = async <A>(
    content: Content,
    use: (input: FileHandle) => Promise<A>,
  ): Promise<A> => {
    const input = await open(
      join(directory, content.sha256),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    )
    try {
      return await use(input)
    } finally {
      await input.close()
    }
  }
  const persist = async (
    expected: Content,
    write: (output: FileHandle) => Promise<void>,
  ): Promise<Content> => {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const temporary = join(directory, `.copy-${randomUUID()}`)
    const output = await open(temporary, "wx", 0o600)
    try {
      try {
        await write(output)
        await output.sync()
      } finally {
        await output.close()
      }
      await chmod(temporary, 0o400)
      try {
        await link(temporary, join(directory, expected.sha256))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      }
      // An existing name is never accepted as proof of its contents.
      await withOwned(expected, (input) => scan(input, expected))
      const parent = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY)
      try {
        await parent.sync()
      } finally {
        await parent.close()
      }
      return expected
    } finally {
      await unlink(temporary)
    }
  }
  return {
    putOwned: (input) => {
      const bytes = new Uint8Array(input)
      return io(() => persist(identify(bytes), (output) => output.writeFile(bytes)))
    },
    putFileOwned: (source) =>
      io(async () => {
        const expected = decodeOwned(Content, { bytes: source.bytes, sha256: source.sha256 })
        if (typeof source.path !== "string" || source.path.includes("\0"))
          throw new Error("Invalid source path")
        const input = await open(
          source.path,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        )
        try {
          return await persist(expected, (output) =>
            scan(input, expected, (bytes) => output.writeFile(bytes)),
          )
        } finally {
          await input.close()
        }
      }),
    verify: (input) =>
      io(async () => {
        const content = decodeOwned(Content, input)
        await withOwned(content, (file) => scan(file, content))
      }),
    read: (input) =>
      io(async () => {
        const content = decodeOwned(Content, input)
        if (content.bytes > READ_CAPACITY) throw new Error("Buffered read capacity exceeded")
        const chunks: Buffer[] = []
        await withOwned(content, (file) =>
          scan(file, content, async (bytes) => {
            chunks.push(Buffer.from(bytes))
          }),
        )
        return new Uint8Array(Buffer.concat(chunks))
      }),
  }
}
