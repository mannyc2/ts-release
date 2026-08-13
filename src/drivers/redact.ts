import { secretPatterns } from "../model/secret-patterns.js"

const EXCERPT_LIMIT = 2000

const redact = (text: string, env: Readonly<Record<string, string>>): string => {
  let out = text
  for (const [name, value] of Object.entries(env)
    .filter(([name, value]) => name !== "PATH" && value.length >= 6)
    .sort((left, right) => right[1].length - left[1].length)) {
    out = out.split(value).join(`[redacted:${name}]`)
  }
  for (const pattern of secretPatterns) {
    out = out.replace(new RegExp(pattern.source, `${pattern.flags.replace("u", "")}gu`), "[redacted:token]")
  }
  return out
}

// Redacts KNOWN values (the exact env values the child received, longest
// first, except PATH) and known token shapes, then bounds the excerpt. Child
// output enters a durable diagnostic ledger only through this bounded form.
export const redactOutput = (
  text: string, env: Readonly<Record<string, string>>
): string => {
  const out = redact(text, env)
  return out.length > EXCERPT_LIMIT ? `${out.slice(0, EXCERPT_LIMIT)}…[truncated]` : out
}

/** Complete redacted machine-protocol output for immediate decoding only. */
export const redactProtocolOutput = (
  text: string, env: Readonly<Record<string, string>>
): string => redact(text, env)
