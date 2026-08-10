import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createHash } from "node:crypto"
import { readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import {
  makeSourceObserver, SourceObserver, type SourceObserverRuntime
} from "../release/context.js"

const runtime: SourceObserverRuntime = {
  canonicalRoot: (workspace) => Effect.try({
    try: () => realpathSync(workspace), catch: (cause) => cause
  }),
  read: (workspace, path) => Effect.try({
    try: () => new Uint8Array(readFileSync(join(workspace, path))), catch: (cause) => cause
  }),
  command: (workspace, argv) => Effect.try({
    try: () => {
      const result = spawnSync("git", [...argv], { cwd: workspace, encoding: "utf8", stdio: "pipe" })
      if (result.error !== undefined) throw result.error
      if (result.status !== 0) throw new Error(result.stderr.trim() || `Command exited ${result.status}.`)
      return result.stdout
    },
    catch: (cause) => cause
  }),
  digest: (bytes) => Effect.sync(() => `sha256:${createHash("sha256").update(bytes).digest("hex")}`)
}

// Both supported runtimes use the same observation contract; only this host
// layer closes its filesystem/process primitives. The observer itself remains
// shared with tests and future library hosts.
export const SourceObserverLive = Layer.succeed(SourceObserver, makeSourceObserver(runtime))
