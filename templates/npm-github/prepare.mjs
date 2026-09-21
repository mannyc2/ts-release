import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import { prepareRelease } from "./release/prepare.js"

const input = JSON.parse(await readFile(process.argv[2], "utf8"))
const prepared = await Effect.runPromise(prepareRelease(input))
const identity = { bundleSha256: prepared.bundleSha256, planId: prepared.planId }
await writeFile(
  join(prepared.candidateDirectory, "identity.json"),
  JSON.stringify(identity) + "\n",
  { flag: "wx" },
)
console.log(JSON.stringify({ ...identity, candidateDirectory: prepared.candidateDirectory }))
