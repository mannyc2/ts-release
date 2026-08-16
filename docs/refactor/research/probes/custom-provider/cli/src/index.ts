#!/usr/bin/env node
import { NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { pathToFileURL } from "node:url"

const modulePath = process.argv[2]

const program: Effect.Effect<unknown, unknown, never> = modulePath === undefined
  ? Effect.sync(() => {
    console.error("usage: research-release <release-module.mjs>")
    process.exitCode = 2
  })
  : Effect.tryPromise({
    try: () => import(pathToFileURL(modulePath).href),
    catch: (cause) => cause
  }).pipe(
    Effect.flatMap((loaded) => {
      const candidate = loaded as { readonly default?: unknown }
      if (!Effect.isEffect(candidate.default)) {
        return Effect.die("release module must default-export an Effect")
      }
      // The consumer-owned module must have supplied its own Layers before it
      // crosses this dynamic application boundary.
      return candidate.default as Effect.Effect<unknown, unknown, never>
    }),
    Effect.tap((receipt) => Effect.sync(() => {
      process.stdout.write(`${JSON.stringify(receipt)}\n`)
    }))
  )

// Runtime execution remains at the application boundary. The library and the
// outside provider expose Effects and Layers, not Promises.
NodeRuntime.runMain(program)
