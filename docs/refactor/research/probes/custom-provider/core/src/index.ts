// Harness-only boundary value. Core contains no provider names, registry, or
// extension admission mechanism.
export interface Artifact {
  readonly id: string
  readonly logicalName: string
  readonly bytes: Uint8Array
}

export const makeArtifact = (input: Artifact): Artifact => ({
  id: input.id,
  logicalName: input.logicalName,
  bytes: Uint8Array.from(input.bytes)
})
