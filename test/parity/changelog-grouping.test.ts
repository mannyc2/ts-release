import { describe, expect, test } from "bun:test"
import { renderGroupedNotes } from "../../src/recipes/changelog-policy.js"

describe("closed changelog grouping policy", () => {
  test("filters, groups, subgroups, sorts, and divides deterministically", () => {
    const entries = [
      { path: "packages/b/z", summary: "Zulu" }, { path: "packages/a/x", summary: "Alpha" },
      { path: "private/x", summary: "Hidden" }
    ]
    expect(renderGroupedNotes(entries, ["private"], [{
      title: "Packages", prefix: "packages", subgroup: "Changes", divider: true
    }])).toBe("## Packages\n### Changes\n- Alpha\n- Zulu\n---")
  })
})
