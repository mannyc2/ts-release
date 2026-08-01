import { describe, expect, test } from "@effect/bun-test"
import { matchGlob } from "../../src/drivers/glob.js"

// The differential table pins the internal matcher to Bun.Glob, the
// implementation it replaced, over the whole documented grammar. Bun usage is
// fine here: the ban applies to src/, and this test is the reason the ban can
// be enforced without a behavioural regression.
const patterns = [
  "plugin", "plugin/manifest.json", "plugin/",
  "*", "*.md", "*.txt", "a*", "*a*", "a*b",
  "?", "a?", "?.md", "a?c",
  "**", "**/*", "**/*.md", "**/manifest.json", "**/**",
  "plugin/*", "plugin/**", "plugin/**/*", "plugin/**/*.md", "plugin/*/*",
  "plugin/**/skills/**", "plugin/*/**", "plugin/**/**", "**/skills/**",
  "plugin/**.md", "plugin/**x", "a**b",
  "[ab]", "[a-c]", "[!a]", "[^a]", "[]]", "[a-c]*", "[0-9]*", "plugin/[ab].md",
  "{a,b}", "{a,b}.md", "{a,b}/**", "{md,txt}", "*.{md,txt}", "a{b,c}d",
  "{,a}b", "{a}", "{}", "{a,{b,c}}/x", "{plugin/skills,plugin}/*",
  "{a,b}{c,d}", "plugin/{skills,evals}/**",
  "\\*", "a\\?b", "a}b", "}", "[{]", "{[a,b],c}", "[a\\-c]",
  "plugin/skills/release/SKILL.md", "plugin//skills", "./plugin"
] as const
const paths = [
  "", "a", "b", "ab", "abc", "a?b", "a*b", "*", "}", "{", ",", "-", "]", "[",
  "0a", "a.md", "b.md", "c.md", "a.txt", "manifest.json", "x",
  "plugin", "plugin/", "plugin/manifest.json", "plugin/a.md", "plugin/a", "plugin/ab.md",
  "plugin/skills", "plugin/skills/release", "plugin/skills/release/SKILL.md",
  "plugin/skills/release/references/recovery.md", "plugin/evals/cases.json",
  "plugin/.claude-plugin/plugin.json", ".dotfile", "plugin/.dotfile",
  "a/b", "a/b/c", "a/x", "b/x", "c/x", "a/b/c/d", "./plugin", "plugin//skills",
  "a/manifest.json", "skills/a", "x/skills/y"
] as const

describe("archive pattern matcher", () => {
  test("agrees with Bun.Glob across the documented grammar", () => {
    const divergences: Array<string> = []
    for (const pattern of patterns) {
      const match = matchGlob(pattern)
      const reference = new Bun.Glob(pattern)
      for (const path of paths) {
        if (match(path) !== reference.match(path)) {
          divergences.push(`${JSON.stringify(pattern)} vs ${JSON.stringify(path)}: ${
            match(path)} expected ${reference.match(path)}`)
        }
      }
    }
    expect(divergences).toEqual([])
    expect(patterns.length * paths.length).toBeGreaterThan(2000)
  })

  test("globstar spans segments only as a whole segment", () => {
    expect(matchGlob("plugin/**")("plugin/skills/release/SKILL.md")).toBe(true)
    expect(matchGlob("plugin/**")("plugin")).toBe(false)
    expect(matchGlob("a/**/b")("a/b")).toBe(true)
    expect(matchGlob("a/**/b")("a/x/y/b")).toBe(true)
    expect(matchGlob("a/**b")("a/x/b")).toBe(false)
    expect(matchGlob("a/***")("a/b/c")).toBe(false)
  })

  test("single-segment wildcards never cross a separator", () => {
    expect(matchGlob("*")("a/b")).toBe(false)
    expect(matchGlob("a/?")("a/bc")).toBe(false)
    expect(matchGlob("*/*")("a/b/c")).toBe(false)
  })

  test("malformed patterns match nothing instead of guessing", () => {
    // Unclosed `[` and unclosed `{` are outside the documented grammar. Bun
    // silently keeps the first brace branch for "{a,b"; refusing the pattern
    // instead surfaces the typo as "patterns matched no workspace files".
    for (const pattern of ["[abc", "[", "{a,b", "x{y", "{a,{b}", "a\\", "[z-a]"]) {
      for (const path of ["a", "b", "ab", "xy", "[abc", "x{y"]) {
        expect(matchGlob(pattern)(path)).toBe(false)
      }
    }
  })

  test("alternation blowup is refused rather than expanded", () => {
    expect(matchGlob("{a,b}".repeat(11))("a".repeat(11))).toBe(false)
    expect(matchGlob("{a,b}".repeat(10))("a".repeat(10))).toBe(true)
  })
})
