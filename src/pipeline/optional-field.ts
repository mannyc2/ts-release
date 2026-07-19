// Invariant: optional encoded fields omit only undefined; every declared false, zero, and empty value is preserved.
export const optionalField = <Value, Field extends object>(
  value: Value | undefined,
  field: (value: Value) => Field
): Field | Record<string, never> => {
  if (value === undefined) {
    return {}
  }
  return field(value)
}
