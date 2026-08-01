export interface PublicExportPolicy {
  readonly subpath: string
  readonly allowedRuntimeSourcePaths: ReadonlyArray<string>
  readonly allowedExternalPrefixes: ReadonlyArray<string>
  readonly allowsBunGlobal: boolean
}

export const bannedAggregateExports: ReadonlyArray<string> = [
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
  "drivers/environment.ts",
  "drivers/glob.ts",
  "drivers/local.ts",
  "drivers/process.ts",
  "drivers/remote.ts",
  "drivers/services.ts",
  "drivers/utils.ts",
  "drivers/workspace.ts",
  "model/canonical.ts",
  "platform/bun.ts",
  "platform/node.ts",
  "platform/services.ts"
]

export const bannedExternalPrefixes: ReadonlyArray<string> = [
  "@effect/platform-bun",
  "@effect/platform-node",
  "effect/unstable/cli",
  "node:"
]

// One host module per host, and each is reachable only from its own
// entrypoint: importing the package root under Node must never pull a Bun
// module into the graph, and the reverse.
const withoutHost = (host: string): ReadonlyArray<string> =>
  runtimeBearingSourcePaths.filter((path) => path !== `platform/${host}.ts`)

export const publicExportPolicies: ReadonlyArray<PublicExportPolicy> = [
  {
    subpath: ".",
    allowedRuntimeSourcePaths: withoutHost("bun"),
    allowedExternalPrefixes: ["node:", "@effect/platform-node"],
    allowsBunGlobal: false
  },
  {
    subpath: "./node",
    allowedRuntimeSourcePaths: withoutHost("bun"),
    allowedExternalPrefixes: ["node:", "@effect/platform-node"],
    allowsBunGlobal: false
  },
  {
    subpath: "./bun",
    allowedRuntimeSourcePaths: withoutHost("node"),
    allowedExternalPrefixes: ["node:", "@effect/platform-bun"],
    allowsBunGlobal: false
  }
]

export const expectedPublicExports: ReadonlyArray<string> =
  publicExportPolicies.map((policy) => policy.subpath)
