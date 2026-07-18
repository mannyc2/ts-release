export interface TaggedReason {
  readonly tag: string
  readonly reason?: string | undefined
  readonly cause?: unknown
}

export const taggedReason = (value: unknown): TaggedReason | undefined => {
  if (typeof value !== "object" || value === null || !("_tag" in value) || typeof value._tag !== "string") {
    return undefined
  }
  return {
    tag: value._tag,
    reason: "reason" in value && typeof value.reason === "string" ? value.reason : undefined,
    cause: "cause" in value ? value.cause : undefined
  }
}

export const formatTaggedReason = (
  value: unknown,
  renderCause?: ((cause: unknown) => string) | undefined
): string | undefined => {
  const tagged = taggedReason(value)
  if (tagged === undefined) {
    return undefined
  }
  const causeMessage = tagged.cause === undefined || renderCause === undefined
    ? undefined
    : renderCause(tagged.cause)
  const causeSuffix = causeMessage !== undefined &&
      causeMessage.length > 0 &&
      causeMessage !== tagged.reason
    ? ` (cause: ${causeMessage})`
    : ""
  return `${tagged.tag}${tagged.reason === undefined ? "" : `: ${tagged.reason}`}${causeSuffix}`
}
