#!/usr/bin/env bun
// Invariant: this executable composes the Bun host layer once, runs exactly one
// decoded command, and disposes what it created. Two runtimes with disjoint
// duties meet here: the CLI runtime parses argv and renders, while the api's
// ManagedRuntime owns the release services.
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import { makeReleaseApi, unsupportedExecutionHost } from "@mannyc1/ts-release"
import { BunReleaseLayer } from "@mannyc1/ts-release/bun"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { dirname } from "node:path"
import packageManifest from "../../../../package.json" with { type: "json" }
import { makeCli } from "./command.js"

const hostRefusal = unsupportedExecutionHost(process.platform)
if (hostRefusal !== undefined) {
  console.error(hostRefusal)
  process.exit(1)
}

const api = makeReleaseApi(BunReleaseLayer)
const cli = makeCli(api, process.cwd(), {
  read: (path) => readFileSync(path, "utf8"),
  write: (path, value) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, value)
  },
  log: console.log
})

BunRuntime.runMain(
  Command.run(cli, { version: packageManifest.version }).pipe(
    Effect.ensuring(Effect.promise(() => api.dispose())),
    Effect.provide(BunServices.layer)
  )
)
