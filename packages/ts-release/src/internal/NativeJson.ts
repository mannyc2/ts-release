import { fail } from "./Error.js"
const invalid = (code: string): never => fail(code, "Native JSON could not be admitted")
/** Match the retained native policy: no duplicate keys, unsafe integers, or
 * ambiguous strings. JSON.parse builds the value only after lexical admission. */
export const decodeJson = (bytes: Uint8Array): unknown => {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  const lexer =
    /[\t\n\r ]+|"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|true|false|null|-?(?:0|[1-9][0-9]*)|[{}\[\]:,]/uy
  let token = "",
    offset = 0
  const next = () => {
    do {
      if (offset === text.length) {
        token = ""
        return
      }
      lexer.lastIndex = offset
      const match = lexer.exec(text)
      if (!match) return invalid("json-token")
      token = match[0]
      offset = lexer.lastIndex
    } while (/^[\t\n\r ]/u.test(token))
  }
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
      const record = ["{"].includes(token),
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
  next()
  value(0)
  if (token !== "") invalid("json-trailing-input")
  return JSON.parse(text)
}
