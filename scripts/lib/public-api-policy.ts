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
  "runtime/bun.ts",
  "workflows/live.ts",
  "targets/live.ts",
  "targets/npm.ts",
  "targets/github.ts",
  "targets/homebrew.ts",
  "targets/pypi.ts",
  "targets/scoop.ts",
  "cli/main.ts"
]

export const bannedExternalPrefixes: ReadonlyArray<string> = [
  "@effect/platform-bun",
  "effect/unstable/cli",
  "node:"
]

export const publicExportPolicies: ReadonlyArray<PublicExportPolicy> = [
  { subpath: ".", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./cli", allowedRuntimeSourcePaths: ["cli/command.ts"], allowedExternalPrefixes: ["effect/unstable/cli"], allowsBunGlobal: false },
  { subpath: "./cli/command", allowedRuntimeSourcePaths: ["cli/command.ts"], allowedExternalPrefixes: ["effect/unstable/cli"], allowsBunGlobal: false },
  { subpath: "./config/errors", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./config/load", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./config/schema", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./domain/artifact", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./domain/evidence", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./domain/operation", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./domain/release", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./domain/status", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./domain/target", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./host", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./host/http", allowedRuntimeSourcePaths: ["host/http.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./host/http-live", allowedRuntimeSourcePaths: ["host/http-live.ts", "host/http.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./host/platform", allowedRuntimeSourcePaths: ["host/platform.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./host/test", allowedRuntimeSourcePaths: ["host/test.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./planner/create-release-plan", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./planner/errors", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./planner/evidence-recorder", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./planner/executor", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./planner/normalize-release", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./planner/render-plan", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./planner/status", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  {
    subpath: "./runtime/bun",
    allowedRuntimeSourcePaths: [
      "runtime/bun.ts",
      "host/platform.ts",
      "host/http-live.ts",
      "host/http.ts",
      "workflows/live.ts",
      "targets/live.ts",
      "targets/npm.ts",
      "targets/github.ts",
      "targets/homebrew.ts",
      "targets/pypi.ts",
      "targets/scoop.ts"
    ],
    allowedExternalPrefixes: ["@effect/platform-bun"],
    allowsBunGlobal: false
  },
  { subpath: "./targets/adapter", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./targets/github", allowedRuntimeSourcePaths: ["targets/github.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./targets/homebrew", allowedRuntimeSourcePaths: ["targets/homebrew.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  {
    subpath: "./targets/live",
    allowedRuntimeSourcePaths: [
      "targets/live.ts",
      "targets/npm.ts",
      "targets/github.ts",
      "targets/homebrew.ts",
      "targets/pypi.ts",
      "targets/scoop.ts"
    ],
    allowedExternalPrefixes: [],
    allowsBunGlobal: false
  },
  { subpath: "./targets/npm", allowedRuntimeSourcePaths: ["targets/npm.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./targets/pypi", allowedRuntimeSourcePaths: ["targets/pypi.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./targets/registry", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./targets/scoop", allowedRuntimeSourcePaths: ["targets/scoop.ts"], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./workflows/config", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  { subpath: "./workflows/evidence", allowedRuntimeSourcePaths: [], allowedExternalPrefixes: [], allowsBunGlobal: false },
  {
    subpath: "./workflows/live",
    allowedRuntimeSourcePaths: ["workflows/live.ts", "host/http-live.ts", "host/http.ts", "targets/live.ts", "targets/npm.ts", "targets/github.ts", "targets/homebrew.ts", "targets/pypi.ts", "targets/scoop.ts"],
    allowedExternalPrefixes: [],
    allowsBunGlobal: false
  }
]

export const expectedPublicExports: ReadonlyArray<string> =
  publicExportPolicies.map((policy) => policy.subpath)
