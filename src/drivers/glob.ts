// Portable matcher for the documented archive `files` grammar: `*` and `?`
// inside one segment, `**` as a whole segment spanning segments, `[...]`
// classes, and `{a,b}` alternation. Patterns reach here already slash
// normalized, so a backslash is only ever an explicit escape.
// A malformed pattern (unclosed `[` or `{`) matches nothing, so a typo fails
// loudly upstream as "patterns matched no workspace files".
const alternativeLimit = 1024
const metacharacters = new Set(["\\", "^", "$", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", "|", "/"])
const literal = (value: string): string => metacharacters.has(value) ? `\\${value}` : value
const classLiteral = (value: string): string => ["\\", "]", "^", "["].includes(value) ? `\\${value}` : value
const classEnd = (pattern: string, open: number): number | undefined => {
  let index = open + 1
  if (pattern[index] === "!" || pattern[index] === "^") index += 1
  if (pattern[index] === "]") index += 1
  while (index < pattern.length) {
    if (pattern[index] === "\\") index += 2
    else if (pattern[index] === "]") return index
    else index += 1
  }
  return undefined
}
const characterClass = (body: string): string => {
  const negated = body.startsWith("!") || body.startsWith("^")
  const members = negated ? body.slice(1) : body
  let source = ""
  let index = 0
  while (index < members.length) {
    const value = members[index]!
    if (value === "\\" && index + 1 < members.length) {
      source += `\\${members[index + 1]!}`
      index += 2
      continue
    }
    source += value === "-" ? "-" : classLiteral(value)
    index += 1
  }
  return `[${negated ? "^" : ""}${source}]`
}
// `{a,b}` expands to whole alternative patterns because a branch may contain
// separators (`{src/a,b}/x`); a class is copied verbatim so `,` inside it stays
// a class member.
const expand = (
  pattern: string, start: number, depth: number
): { readonly alternatives: ReadonlyArray<string>, readonly next: number } | undefined => {
  const completed: Array<string> = []
  let current: ReadonlyArray<string> = [""]
  let index = start
  const append = (text: string) => { current = current.map((value) => value + text) }
  const flush = () => { completed.push(...current); current = [""] }
  while (index < pattern.length) {
    const value = pattern[index]!
    if (value === "\\") {
      if (index + 1 >= pattern.length) return undefined
      append(pattern.slice(index, index + 2))
      index += 2
    } else if (value === "[") {
      const end = classEnd(pattern, index)
      if (end === undefined) return undefined
      append(pattern.slice(index, end + 1))
      index = end + 1
    } else if (value === "{") {
      const group = expand(pattern, index + 1, depth + 1)
      if (group === undefined) return undefined
      current = current.flatMap((prefix) => group.alternatives.map((suffix) => prefix + suffix))
      if (current.length > alternativeLimit) return undefined
      index = group.next
    } else if (depth > 0 && value === "}") {
      flush()
      return { alternatives: completed, next: index + 1 }
    } else if (depth > 0 && value === ",") {
      flush()
      index += 1
    } else {
      append(value)
      index += 1
    }
  }
  if (depth > 0) return undefined
  flush()
  return { alternatives: completed, next: index }
}
const globstarAt = (pattern: string, index: number): boolean =>
  pattern.startsWith("**", index) &&
  (index + 2 === pattern.length || pattern[index + 2] === "/")
const compile = (pattern: string): RegExp | undefined => {
  let source = "^"
  let index = 0
  while (index < pattern.length) {
    const value = pattern[index]!
    if (value === "\\") {
      if (index + 1 >= pattern.length) return undefined
      source += literal(pattern[index + 1]!)
      index += 2
    } else if (value === "[") {
      const end = classEnd(pattern, index)
      if (end === undefined) return undefined
      source += characterClass(pattern.slice(index + 1, end))
      index = end + 1
    } else if (value === "*") {
      let run = 1
      while (pattern[index + run] === "*") run += 1
      const whole = (index === 0 || pattern[index - 1] === "/") &&
        (index + run === pattern.length || pattern[index + run] === "/")
      const rest = index + run + 1
      if (run === 2 && whole && index + run === pattern.length) source += ".*"
      else if (run === 2 && whole) {
        // `**/**` collapses; otherwise `**/` skips whole segments and whatever
        // follows must still match at least one character, so `**/*` never
        // matches a bare directory the way `a/*` does.
        if (!globstarAt(pattern, rest)) {
          source += rest === pattern.length ? "(?:[^/]*/)*" : "(?:[^/]*/)*(?=[\\s\\S])"
        }
        run += 1
      } else source += "[^/]*"
      index += run
    } else if (value === "?") {
      source += "[^/]"
      index += 1
    } else {
      source += literal(value)
      index += 1
    }
  }
  // A reversed class range like [z-a] is legal glob text but an invalid
  // regular expression; it matches nothing, like every other malformed pattern.
  try {
    return new RegExp(`${source}$`)
  } catch {
    return undefined
  }
}
export const matchGlob = (pattern: string): (path: string) => boolean => {
  const expanded = expand(pattern, 0, 0)
  const compiled = expanded?.alternatives.map(compile)
  if (compiled === undefined || compiled.some((item) => item === undefined)) return () => false
  return (path) => compiled.some((item) => item!.test(path))
}
