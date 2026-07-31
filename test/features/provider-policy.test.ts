import { describe, expect, test } from "bun:test"
import { applyCatalogCheckboxPolicy } from "../../src/recipes/providers/catalog-policy.js"

describe("catalog checkbox policy", () => {
  test("preserves or checks only unchecked task-list markers deterministically", () => {
    const source = "- [ ] first\n- [x] second\nplain [ ] text\n"
    expect(applyCatalogCheckboxPolicy(source, "preserve")).toBe(source)
    expect(applyCatalogCheckboxPolicy(source, "check")).toBe(
      "- [x] first\n- [x] second\nplain [ ] text\n"
    )
  })
})
