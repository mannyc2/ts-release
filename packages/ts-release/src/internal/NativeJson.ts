import { fail } from "./Error.js"
const invalid = (code: string): never => fail(code, "Native JSON could not be admitted")
const tokenize = (text: string): string[] => {
  const tokens: string[] = []
  const simple = /[\t\n\r ]+|true|false|null|-?(?:0|[1-9][0-9]*)|[{}\[\]:,]/uy
  let at = 0
  while (at < text.length) {
    if (text[at] === '"') {
      const start = at++
      // Scan strings without a repeated regexp alternation: native npm bodies
      // contain large base64 attachments that exhaust V8's regexp stack.
      while (true) {
        if (at === text.length) invalid("json-token")
        const code = text.charCodeAt(at++)
        if (code === 34) break
        if (code < 32) invalid("json-token")
        if (code === 92) {
          const escape = text[at++]
          if (escape === "u") {
            if (!/^[0-9a-fA-F]{4}$/u.test(text.slice(at, at + 4))) invalid("json-token")
            at += 4
          } else if (escape === undefined || !'"\\/bfnrt'.includes(escape)) invalid("json-token")
        }
      }
      tokens.push(text.slice(start, at))
    } else {
      simple.lastIndex = at
      const match = simple.exec(text)
      if (match === null) return invalid("json-token")
      at = simple.lastIndex
      if (!/^[\t\n\r ]/u.test(match[0])) tokens.push(match[0])
    }
  }
  return tokens
}
/** Match the retained native policy: no duplicate keys, unsafe integers, or
 * ambiguous strings. JSON.parse builds the value only after lexical admission. */
export const decodeJson = (input: string | Uint8Array): unknown => {
  const text =
    typeof input === "string" ? input : new TextDecoder("utf-8", { fatal: true }).decode(input)
  const tokens = tokenize(text)
  let at = 0,
    token = tokens[0] ?? ""
  const next = () => (token = tokens[++at] ?? "")
  const string = () => {
    if (!token.startsWith('"')) return invalid("json-string")
    const value = JSON.parse(token) as string
    if (
      value !== value.normalize("NFC") ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)
    )
      invalid("json-string")
    return value
  }
  const value = (depth: number): void => {
    if (depth > 128) invalid("json-depth")
    if (["{", "["].includes(token)) {
      const record = token === "{",
        end = record ? "}" : "]",
        keys = new Set<string>()
      next()
      if (token === end) {
        next()
        return
      }
      while (true) {
        if (record) {
          const key = string()
          if (keys.has(key)) invalid("duplicate-json-key")
          keys.add(key)
          next()
          if (token !== ":") invalid("json-colon")
          next()
        }
        value(depth + 1)
        if (token === end) {
          next()
          return
        }
        if (token !== ",") invalid("json-separator")
        next()
      }
    }
    if (token.startsWith('"')) string()
    else if (!["true", "false", "null"].includes(token)) {
      if (!token || !Number.isSafeInteger(Number(token)) || Object.is(Number(token), -0))
        invalid("json-integer")
    }
    next()
  }
  value(0)
  if (token !== "") invalid("json-trailing-input")
  return JSON.parse(text)
}
