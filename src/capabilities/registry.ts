export interface ExecutableCapability {
  readonly id: string
  readonly entrypoint: string
  readonly verticalTest: string
  readonly support: "supported" | "unsupported"
  readonly executionHosts: ReadonlyArray<"linux" | "darwin" | "windows">
  readonly artifactTargets: ReadonlyArray<string>
  readonly nativeToolHosts: ReadonlyArray<"linux" | "darwin" | "windows">
}

// This is executable composition evidence, not a documentation profile. An
// entry exists only next to a compiler/driver path and names the vertical test
// that proves that path can run. Empirical live-read/write evidence is kept in
// plan-220's dated report and is never consumed by runtime code.
export const executableCapabilities = [
  {
    id: "build.bun-compile",
    entrypoint: "src/release/capabilities.ts:contributeBuild",
    verticalTest: "test/core/current-recipes.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"],
    artifactTargets: ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64", "windows-arm64"],
    nativeToolHosts: ["linux", "darwin"]
  },
  {
    id: "artifact.archive",
    entrypoint: "src/release/capabilities.ts:contributeArchives",
    verticalTest: "test/core/current-recipes.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "artifact.checksum",
    entrypoint: "src/release/capabilities.ts:contributeArchives",
    verticalTest: "test/core/current-recipes.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "publish.npm",
    entrypoint: "src/publication/npm.ts:makeNpmSubject",
    verticalTest: "test/publication/npm-adapter.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "publish.github",
    entrypoint: "src/publication/github.ts:makeGithubSubjects",
    verticalTest: "test/publication/github-adapter.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "catalog.render",
    entrypoint: "src/release/capabilities.ts:contributeCatalog",
    verticalTest: "test/core/current-recipes.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "publish.catalog-git",
    entrypoint: "src/publication/catalog-git.ts:makeCatalogSubject",
    verticalTest: "test/publication/catalog-git.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "correct.npm-deprecation",
    entrypoint: "src/correction/npm.ts:makeNpmDeprecationSubject",
    verticalTest: "test/correction/npm-deprecate.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "correct.catalog-state",
    entrypoint: "src/correction/catalog.ts:makeCatalogCorrectionSubject",
    verticalTest: "test/correction/catalog-state.test.ts",
    support: "supported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "correct.github-release",
    entrypoint: "src/correction/coordinator.ts:correctPreparedRelease",
    verticalTest: "test/correction/github-release.test.ts",
    support: "unsupported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  },
  {
    id: "correct.pypi-file-yank",
    entrypoint: "src/correction/coordinator.ts:correctPreparedRelease",
    verticalTest: "test/correction/pypi-file-yank.test.ts",
    support: "unsupported",
    executionHosts: ["linux", "darwin"], artifactTargets: [], nativeToolHosts: []
  }
] as const satisfies ReadonlyArray<ExecutableCapability>

export const capabilityIds = new Set(executableCapabilities.map((entry) => entry.id))
