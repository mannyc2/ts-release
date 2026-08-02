// Invariant: this is the PUBLISHED executable. Same duties as main.ts — compose
// the host layer once, run exactly one decoded command, dispose what it created
// — but on the Node host, because `npx ts-release` must work on a machine that
// has never heard of Bun. main.ts stays the Bun-optimal dev entry.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { makeReleaseApi } from "@mannyc1/ts-release"
import { NodeReleaseLayer } from "@mannyc1/ts-release/node"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { dirname } from "node:path"
import { makeCli } from "./command.js"

// The version is INJECTED by scripts/build-cli-bundle.ts rather than imported
// from the root manifest: a JSON import would inline the whole manifest —
// every devDependency and script — into the published bin, and would make the
// bundle carry the string "@effect/platform-bun" that check:cli-bundle exists
// to forbid. `typeof` keeps an unbundled run (bun run node-main.ts) working.
declare const __TS_RELEASE_VERSION__: string | undefined
const version = typeof __TS_RELEASE_VERSION__ === "string" ? __TS_RELEASE_VERSION__ : "0.0.0-unbundled"

// Windows is a supported release TARGET, not a host: the store and drivers
// assume POSIX open flags (O_NOFOLLOW) and absolute-path branding.
if (process.platform === "win32") {
  console.error("ts-release runs on Linux and macOS hosts; Windows is a supported release TARGET only. Use WSL to run ts-release on Windows.")
  process.exit(1)
}

const api = makeReleaseApi(NodeReleaseLayer)
const cli = makeCli(api, process.cwd(), {
  read: (path) => readFileSync(path, "utf8"),
  write: (path, value) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, value)
  },
  log: console.log
})

NodeRuntime.runMain(
  Command.run(cli, { version }).pipe(
    Effect.ensuring(Effect.promise(() => api.dispose())),
    Effect.provide(NodeServices.layer)
  )
)
