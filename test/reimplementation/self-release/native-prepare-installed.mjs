// Copied into the isolated installed consumer beside its production application.
import { readFile } from "node:fs/promises"
import { Effect } from "effect"
import * as Npm from "@mannyc1/ts-release-npm"
import { prepareRelease } from "./application/prepare.js"

const input = JSON.parse(await readFile(process.argv[2], "utf8"))
const result = await Effect.runPromise(
  prepareRelease({
    ...input,
    npm: { authorization: new Npm.TokenAuthorization({ principal: "npm-publisher" }) },
  }),
)
console.log(JSON.stringify(result))
