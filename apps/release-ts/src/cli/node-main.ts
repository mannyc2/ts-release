// Invariant: this is the published executable. Same duties as main.ts — compose
// the host layer once, run exactly one decoded command, dispose what it created
// — but on the Node host, because `npx ts-release` must work on a machine that
// has never heard of Bun. main.ts stays the Bun-optimal dev entry.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { makeReleaseApi, unsupportedExecutionHost } from "@mannyc1/ts-release"
import { makeNodeReleaseLayer } from "@mannyc1/ts-release/node"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { dirname } from "node:path"
import { makeLocalPreparedReleaseStore } from "../../../../src/release/prepared-store.js"
import { makeCli } from "./command.js"

// The version is INJECTED by scripts/build-cli-bundle.ts rather than imported
// from the root manifest: a JSON import would inline the whole manifest —
// every devDependency and script — into the published bin, and would make the
// bundle carry the string "@effect/platform-bun" that check:cli-bundle exists
// to forbid. `typeof` keeps an unbundled run (bun run node-main.ts) working.
declare const __TS_RELEASE_VERSION__: string | undefined
const version = typeof __TS_RELEASE_VERSION__ === "string" ? __TS_RELEASE_VERSION__ : "0.0.0-unbundled"

const hostRefusal = unsupportedExecutionHost(process.platform)
if (hostRefusal !== undefined) {
  console.error(hostRefusal)
  process.exit(1)
}

const cli = makeCli((storeDirectory) => makeReleaseApi(makeNodeReleaseLayer(
  makeLocalPreparedReleaseStore(storeDirectory)
)), process.cwd(), {
  read: (path) => readFileSync(path, "utf8"),
  write: (path, value) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, value)
  },
  log: console.log
})

NodeRuntime.runMain(
  Command.run(cli, { version }).pipe(
    Effect.provide(NodeServices.layer)
  )
)
