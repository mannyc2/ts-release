// The reviewable IR's byte shape: readable JSON with sorted keys, so two
// resolutions of the same inputs produce the same file and a diff shows only
// what actually changed.
//
// This is deliberately NOT the plan-bytes canonical encoder. Canonical encoding
// is a durable-document discipline that plan identity depends on; this is a
// convenience artifact that nothing ever reads back.
// Also the plain-JSON conversion the resolver needs: decoding produces Schema
// class INSTANCES, and the canonical decoder refuses non-plain objects.
export const toPlainJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toPlainJson)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => [key, toPlainJson(entry)])
  )
}

export const encodeResolvedConfig = (config: unknown): string =>
  `${JSON.stringify(toPlainJson(config), null, 2)}\n`
