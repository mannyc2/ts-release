// Invariant: this declaration-only compatibility shim narrows pinned Effect internals without adding runtime state.
declare global {
  const SchemaErrorTypeId: unique symbol
}

export {}
