export const optionalField = <Value, Field extends object>(
  value: Value | undefined,
  field: (value: Value) => Field
): Field | Record<string, never> => {
  if (value === undefined) {
    return {}
  }
  return field(value)
}
