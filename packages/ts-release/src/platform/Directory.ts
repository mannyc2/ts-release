import * as Effect from "effect/Effect"
import { isAbsolute } from "node:path"
import { AdoptionError } from "../internal/ArtifactModel.js"
import type { ContentOwner } from "../internal/Content.js"
import { command } from "./Process.js"

const error = () => new AdoptionError({ reason: "Bounded native Node directory read failed" })
const program = `
import { opendir } from "node:fs/promises";
if (process.versions.bun) throw new Error("Native Node is required");
const [directory, maximum] = process.argv.slice(1), names = [];
const cursor = await opendir(directory, { bufferSize: 1 });
for await (const entry of cursor) {
  if (names.length === Number(maximum)) throw new Error("Directory entry bound exceeded");
  names.push(entry.name);
}
process.stdout.write(JSON.stringify(names));
`

/** Explicit native Node capability for bounded enumeration, including in Bun
 * applications. No ambient PATH lookup or Bun readdir fallback. Cancellation
 * kills and awaits the child. Native cursor prefetch is bounded by Node/libuv. */
export const nodeDirectoryReader = (nodeExecutable: string): ContentOwner["readDirectoryBounded"] =>
  Effect.fn("content.readDirectoryBounded")(function* (directory, maximumEntries) {
    if (
      !isAbsolute(nodeExecutable) ||
      !isAbsolute(directory) ||
      !Number.isSafeInteger(maximumEntries) ||
      maximumEntries < 0 ||
      maximumEntries > 300_000
    )
      return yield* error()
    const result = yield* command(
      nodeExecutable,
      directory,
      {
        timeoutMilliseconds: 30_000,
        maximumOutputBytes: 64 * 1024 * 1024,
      },
      error,
    )(["--input-type=module", "--eval", program, "--", directory, String(maximumEntries)])
    return yield* Effect.try({
      try: () => {
        if (result.exitCode !== 0) throw error()
        const names: unknown = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(result.stdout),
        )
        if (
          !Array.isArray(names) ||
          names.length > maximumEntries ||
          names.some(
            (name) =>
              typeof name !== "string" ||
              !name ||
              /[\\/\0]/u.test(name) ||
              name === "." ||
              name === "..",
          )
        )
          throw error()
        return Object.freeze(names as string[])
      },
      catch: error,
    })
  })
