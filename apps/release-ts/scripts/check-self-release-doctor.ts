import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import { plan } from "@mannyc1/ts-release"
import { makeCli } from "../src/cli/command.js"
import {
  readJson, releaseConfigPath, report, root
} from "./self-release-facts.js"

const directory = mkdtempSync(join(tmpdir(), "ts-release-doctor-"))
const path = join(directory, "plan.json")
const planned = await plan({ config: readJson(releaseConfigPath), workspace: root })
writeFileSync(path, planned.bytes)
const logs: Array<string> = []
const failures: Array<string> = []
try {
  const cli = makeCli(
    {
      plan: async () => planned,
      reviewExecution: (input) => import("@mannyc1/ts-release")
        .then((api) => api.reviewExecution(input)),
      apply: async () => {
        throw new Error("doctor must not apply")
      }
    },
    root,
    {
      read: (source: string) => readFileSync(source, "utf8"),
      write: () => {
        throw new Error("doctor must not write")
      },
      log: (value: string) => logs.push(value)
    }
  )
  await Effect.runPromise(
    Command.runWith(cli, { version: "self-release-doctor" })(
      ["doctor", path, "--plan-id", planned.planId]
    ).pipe(Effect.provide(BunServices.layer))
  )
  if (!logs.some((value) => value.includes("\"status\":\"valid\""))) {
    failures.push("Doctor did not report a valid canonical plan.")
  }
} catch (cause) {
  failures.push(cause instanceof Error ? cause.message : String(cause))
} finally {
  rmSync(directory, { recursive: true, force: true })
}

report("self-release-doctor-report/v1", failures, { planId: planned.planId })
