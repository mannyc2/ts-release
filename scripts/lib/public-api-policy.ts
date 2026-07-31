export interface PublicExportPolicy {
  readonly subpath: string
  readonly allowedRuntimeSourcePaths: ReadonlyArray<string>
  readonly allowedExternalPrefixes: ReadonlyArray<string>
  readonly allowsBunGlobal: boolean
}

export const bannedAggregateExports: ReadonlyArray<string> = [
  "./bun",
  "./test",
  "./targets"
]

export const aggregateSourcePaths: ReadonlyArray<string> = [
  "bun.ts",
  "test.ts",
  "targets.ts"
]

export const runtimeBearingSourcePaths: ReadonlyArray<string> = [
  "api/input.ts",
  "api/apply-boundary.ts",
  "apply/store.ts",
  "drivers/archive.ts",
  "drivers/node.ts",
  "drivers/remote.ts",
  "drivers/services.ts",
  "drivers/utils.ts",
  "drivers/workspace.ts",
  "model/canonical.ts"
]

export const bannedExternalPrefixes: ReadonlyArray<string> = [
  "@effect/platform-bun",
  "effect/unstable/cli",
  "node:"
]

export const publicExportPolicies: ReadonlyArray<PublicExportPolicy> = [
  {
    subpath: ".",
    allowedRuntimeSourcePaths: runtimeBearingSourcePaths,
    allowedExternalPrefixes: ["node:"],
    allowsBunGlobal: true
  }
]

export const expectedPublicExports: ReadonlyArray<string> =
  publicExportPolicies.map((policy) => policy.subpath)
