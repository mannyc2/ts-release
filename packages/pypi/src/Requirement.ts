import { validRange } from "@renovatebot/pep440"
import { invalid } from "./Native.js"

/** Admission only; evaluation of Python environment markers belongs to pip.
 * Grammar: PyPA dependency-specifiers. Range semantics: pinned PEP440 parser,
 * with native packaging's stricter release-only wildcard rule. */
export const specifiers = (value: string) => {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  for (const part of parts) {
    if (part.startsWith("===")) {
      if (!/^===[^\s;)]*$/u.test(part)) invalid("metadata-specifier")
    } else if (
      !validRange(part) ||
      (part.includes("*") && !/^(?:==|!=)\s*v?(?:[0-9]+!)?[0-9]+(?:\.[0-9]+)*\.\*$/iu.test(part))
    )
      invalid("metadata-specifier")
  }
}
export const requirement = (value: string) => {
  if (value.length > 16384 || /[\r\n\u0000]/u.test(value)) invalid("metadata-requirement")
  let rest = value.trim()
  const take = (pattern: RegExp) => {
    const match = pattern.exec(rest)
    if (!match) return invalid("metadata-requirement")
    rest = rest.slice(match[0].length).trimStart()
    return match[0]
  }
  const name = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?/u
  take(name)
  if (rest.startsWith("[")) {
    take(/^\[/u)
    if (!rest.startsWith("]")) {
      take(name)
      while (rest.startsWith(",")) {
        take(/^,/u)
        take(name)
      }
    }
    take(/^\]/u)
  }
  if (rest.startsWith("@")) {
    take(/^@/u)
    take(/^[^ \t]+/u)
  } else {
    let ranges: string
    if (rest.startsWith("(")) {
      ranges = take(/^\([^)]*\)/u).slice(1, -1)
    } else ranges = take(/^[^;]*/u)
    // Requirements permit a trailing comma, but not empty interior specifiers.
    if (/^\s*,|,\s*,/u.test(ranges)) invalid("metadata-requirement")
    specifiers(ranges)
  }
  if (!rest) return
  take(/^;/u)
  const variable =
    /^(?:python_(?:full_version|version|implementation)|os[._]name|sys[._]platform|platform_(?:release|system)|platform[._](?:version|machine|python_implementation)|implementation_(?:name|version)|extras?|dependency_groups)\b/u
  const operand = () => {
    if (/^["']/u.test(rest)) {
      const literal = take(/^(?:"[^"\r\n]*"|'[^'\r\n]*')/u).slice(1, -1)
      for (let at = 0; at < literal.length; at++) {
        if (literal[at] !== "\\") continue
        const escape = literal[++at]
        if (escape === undefined) invalid("metadata-marker-literal")
        const digits = escape === "x" ? 2 : escape === "u" ? 4 : escape === "U" ? 8 : 0
        if (digits) {
          const hex = literal.slice(at + 1, at + 1 + digits)
          if (
            hex.length !== digits ||
            !/^[0-9a-f]+$/iu.test(hex) ||
            Number.parseInt(hex, 16) > 0x10ffff
          )
            invalid("metadata-marker-literal")
          at += digits
        }
        // Named Unicode escapes are outside the PyPA marker-string grammar;
        // admitting one requires Python's Unicode-name database, not JS eval.
        if (escape === "N") invalid("metadata-marker-named-escape")
      }
    } else take(variable)
  }
  const expression = (depth: number) => {
    if (depth > 64) invalid("metadata-marker-bound")
    const atom = () => {
      if (rest.startsWith("(")) {
        take(/^\(/u)
        expression(depth + 1)
        take(/^\)/u)
      } else {
        operand()
        take(/^(?:===|==|~=|!=|<=|>=|<|>|not\b[ \t]+in\b|in\b)/u)
        operand()
      }
    }
    atom()
    while (/^(?:and|or)\b/u.test(rest)) {
      take(/^(?:and|or)\b/u)
      atom()
    }
  }
  expression(0)
  if (rest) invalid("metadata-marker")
}
