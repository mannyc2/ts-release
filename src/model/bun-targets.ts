/**
 * The one advertised Bun artifact-target vocabulary. Config decoding, graph
 * compilation, capability documentation, and cross-compile certification all
 * project from these values.
 */
export const bunArtifactTargets = Object.freeze([
  { id: "linux-x64", bunTarget: "bun-linux-x64", format: "elf", architecture: "x86_64" },
  { id: "linux-arm64", bunTarget: "bun-linux-arm64", format: "elf", architecture: "aarch64" },
  { id: "darwin-x64", bunTarget: "bun-darwin-x64", format: "mach-o", architecture: "x86_64" },
  { id: "darwin-arm64", bunTarget: "bun-darwin-arm64", format: "mach-o", architecture: "aarch64" }
] as const)

// Windows targets are deliberately not advertised or shipped by this
// candidate. Header-valid cross-compilation alone cannot certify execution.
// Reopen one only after its public CLI binary executes on that Windows host in
// the same clean-candidate gate.
export type BunArtifactTarget = typeof bunArtifactTargets[number]
export type BunArtifactTargetId = BunArtifactTarget["id"]
export type BunBinaryFormat = BunArtifactTarget["format"]
export type BunBinaryArchitecture = BunArtifactTarget["architecture"]

const idsOf = <const Entries extends ReadonlyArray<{ readonly id: string }>>(
  entries: Entries
): { readonly [Index in keyof Entries]: Entries[Index] extends { readonly id: infer Id } ? Id : never } =>
  Object.freeze(entries.map(({ id }) => id)) as never

export const bunArtifactTargetIds = idsOf(bunArtifactTargets)

const byId = new Map<BunArtifactTargetId, BunArtifactTarget>(
  bunArtifactTargets.map((target) => [target.id, target])
)

/** Total after strict config decoding against `bunArtifactTargetIds`. */
export const bunArtifactTarget = (id: BunArtifactTargetId): BunArtifactTarget => byId.get(id)!
