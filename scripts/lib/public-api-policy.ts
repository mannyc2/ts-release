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
  "drivers/archive.ts",
  "drivers/environment.ts",
  "drivers/glob.ts",
  "drivers/process.ts",
  "drivers/utils.ts",
  "drivers/workspace.ts",
  "model/canonical.ts",
  "host.ts",
  "provider-sdk.ts",
  "extensions/provider-adapter.ts",
  "store.ts",
  "platform/bun.ts",
  "platform/bun-journal.ts",
  "platform/npm-native-client.ts",
  "platform/node.ts",
  "platform/services.ts",
  "platform/release-runtime.ts",
  "publication/npm-native.ts",
  "publication/npm-operation.ts",
  "release/artifact-bundle.ts",
  "release/release-plan.ts",
  "release/journal.ts",
  "release/release-report.ts"
]

export const bannedExternalPrefixes: ReadonlyArray<string> = [
  "@effect/platform-bun",
  "@effect/platform-node",
  "effect/unstable/cli",
  "effect/unstable/http",
  "effect/unstable/process",
  "bun:",
  "node:"
]

// These vNext modules are intentionally internal while their application API
// remains provisional. Listing them as runtime-bearing makes every public
// entry graph prove that it does not accidentally retain them.
const internalReleaseKernelSourcePaths: ReadonlySet<string> = new Set([
  "platform/bun-journal.ts",
  "platform/npm-native-client.ts",
  "publication/npm-native.ts",
  "publication/npm-operation.ts",
  "release/artifact-bundle.ts",
  "release/release-plan.ts",
  "release/journal.ts",
  "release/release-report.ts"
])

// One host module per host, and each is reachable only from its own
// entrypoint: importing the package root under Node must never pull a Bun
// module into the graph, and the reverse.
const withoutHost = (host: string): ReadonlyArray<string> =>
  runtimeBearingSourcePaths.filter((path) =>
    path !== `platform/${host}.ts`
    && !path.startsWith(`platform/${host}-`)
    && !internalReleaseKernelSourcePaths.has(path))

// effect/unstable/{http,process} are runtime necessities of the live driver
// graph (every subpath today), allowed per-subpath; the declaration-side bite
// is check-package-exports' entry-declaration grep. A future subpath does NOT
// inherit these holes.
export const publicExportPolicies: ReadonlyArray<PublicExportPolicy> = [
  {
    subpath: ".",
    allowedRuntimeSourcePaths: withoutHost("bun"),
    allowedExternalPrefixes: [
      "node:", "@effect/platform-node", "effect/unstable/http", "effect/unstable/process"
    ],
    allowsBunGlobal: false
  },
  {
    subpath: "./node",
    allowedRuntimeSourcePaths: withoutHost("bun"),
    allowedExternalPrefixes: [
      "node:", "@effect/platform-node", "effect/unstable/http", "effect/unstable/process"
    ],
    allowsBunGlobal: false
  },
  {
    subpath: "./bun",
    allowedRuntimeSourcePaths: withoutHost("node"),
    allowedExternalPrefixes: [
      "node:", "@effect/platform-bun", "effect/unstable/http", "effect/unstable/process"
    ],
    allowsBunGlobal: false
  },
  {
    subpath: "./store",
    allowedRuntimeSourcePaths: [
      "store.ts",
      "drivers/workspace.ts",
      "model/canonical.ts"
    ],
    allowedExternalPrefixes: ["node:"],
    allowsBunGlobal: false
  },
  {
    subpath: "./host",
    allowedRuntimeSourcePaths: [
      "host.ts",
      "drivers/workspace.ts",
      "model/canonical.ts"
    ],
    allowedExternalPrefixes: ["node:"],
    allowsBunGlobal: false
  },
  {
    subpath: "./provider-sdk",
    allowedRuntimeSourcePaths: [
      "provider-sdk.ts",
      "extensions/provider-adapter.ts",
      "model/canonical.ts"
    ],
    allowedExternalPrefixes: ["node:"],
    allowsBunGlobal: false
  }
]

export const expectedPublicExports: ReadonlyArray<string> =
  publicExportPolicies.map((policy) => policy.subpath)
