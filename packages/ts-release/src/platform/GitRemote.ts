import { checkedText, nativeText as text } from "./GitProcess.js"
import * as Effect from "effect/Effect"
import { attempt } from "../internal/Error.js"
import { invalid, objectFormat, type RefCoordinate } from "../internal/GitCatalog.js"
import { checked, type GitCommand, type GitEnvironment } from "./GitProcess.js"

export const remoteRef = Effect.fn("git.remoteRef")(function* (
  run: GitCommand,
  coordinate: RefCoordinate,
  environment: GitEnvironment,
) {
  const result = yield* run(
    ["ls-remote", "--refs", "--exit-code", "--", coordinate.remote, coordinate.ref],
    undefined,
    environment,
  )
  return yield* attempt(() => {
    const output = text(result.stdout)
    if (result.exitCode === 2 && output === "") return null
    if (result.exitCode !== 0) invalid()
    const fields = output.split("\t")
    if (fields.length !== 2 || fields[1] !== coordinate.ref + "\n") invalid()
    objectFormat(fields[0]!)
    if (/^0+$/u.test(fields[0]!)) invalid()
    return fields[0]!
  })
})
export const fetchRef = Effect.fn("git.fetchRef")(function* (
  run: GitCommand,
  coordinate: RefCoordinate,
  environment: GitEnvironment,
) {
  yield* checked(
    run,
    [
      "fetch",
      "--quiet",
      "--no-tags",
      "--no-write-fetch-head",
      "--no-auto-maintenance",
      "--",
      coordinate.remote,
      `${coordinate.ref}:refs/ts-release/capture`,
    ],
    undefined,
    environment,
  )
  const oid = (yield* checkedText(run, ["rev-parse", "--verify", "refs/ts-release/capture"])).trim()
  yield* attempt(() => objectFormat(oid))
  return oid
})
