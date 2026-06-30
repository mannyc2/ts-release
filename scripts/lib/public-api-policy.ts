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
  "host/http-live.ts",
  "host/platform.ts",
  "host/test.ts",
  "targets/live.ts",
  "targets/npm.ts",
  "targets/github.ts",
  "targets/homebrew.ts",
  "targets/pypi.ts",
  "targets/scoop.ts"
]

export const bannedExternalPrefixes: ReadonlyArray<string> = [
  "@effect/platform-bun",
  "effect/unstable/cli",
  "node:"
]

export const publicExportPolicies: ReadonlyArray<PublicExportPolicy> = [
  { subpath: ".", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false }
]

export const expectedPublicExports: ReadonlyArray<string> =
  publicExportPolicies.map((policy) => policy.subpath)
