import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Path from "effect/Path"
import {
  isInsidePathBoundary,
  resolveWorkspacePath,
  validateWorkspaceWritePath
} from "../src/internal/workspace-path.js"

const withPath = <A>(body: (path: Path.Path) => A) =>
  Effect.runSync(
    Effect.gen(function*() {
      const path = yield* Path.Path
      return body(path)
    }).pipe(Effect.provide(Path.layer))
  )

describe("workspace path helpers", () => {
  test("resolves relative paths below Windows drive-letter roots with the POSIX path layer", () => {
    const result = withPath((path) =>
      resolveWorkspacePath(path, "D:\\a\\ts-release\\ts-release", ".release/evidence/render.json")
    )

    expect(result).toBe("D:\\a\\ts-release\\ts-release/.release/evidence/render.json")
  })

  test("checks Windows drive-letter path boundaries without double-prefixing roots", () => {
    const inside = withPath((path) =>
      isInsidePathBoundary(
        path,
        "D:\\a\\ts-release\\ts-release",
        "D:\\a\\ts-release\\ts-release/.release/evidence/render.json"
      )
    )
    const outside = withPath((path) =>
      isInsidePathBoundary(
        path,
        "D:\\a\\ts-release\\ts-release",
        "D:\\a\\ts-release\\other/.release/evidence/render.json"
      )
    )

    expect(inside).toBe(true)
    expect(outside).toBe(false)
  })

  test("validates Windows drive-letter workspace writes", () => {
    const accepted = withPath((path) =>
      validateWorkspaceWritePath(path, "D:\\a\\ts-release\\ts-release", ".release/evidence/render.json")
    )
    const rejected = withPath((path) =>
      validateWorkspaceWritePath(path, "D:\\a\\ts-release\\ts-release", "D:\\a\\outside\\render.json")
    )

    expect(accepted).toEqual({
      _tag: "Ok",
      path: "D:\\a\\ts-release\\ts-release/.release/evidence/render.json"
    })
    expect(rejected).toEqual({
      _tag: "Invalid",
      reason: "outside-root"
    })
  })
})
