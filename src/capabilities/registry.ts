export interface ExecutableCapability {
  readonly id: string
  readonly entrypoint: string
  readonly verticalTest: string
  readonly executionHosts: ReadonlyArray<"linux" | "darwin" | "windows">
  readonly artifactTargets: ReadonlyArray<string>
}

// This is executable composition evidence, not a documentation profile. An
// entry exists only next to a compiler/driver path and names the vertical test
// that proves that path can run. Empirical live-read/write evidence is kept in
// plan-220's dated report and is never consumed by runtime code.
export const executableCapabilities = [
  {
    id: "build.bun-compile",
    entrypoint: "src/recipes/current-build.ts:lowerBuildTarget",
    verticalTest: "test/core/current-recipes.test.ts",
    executionHosts: ["linux", "darwin"],
    artifactTargets: ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64", "windows-arm64"]
  },
  {
    id: "artifact.archive",
    entrypoint: "src/recipes/current-build.ts:lowerArchives",
    verticalTest: "test/core/current-recipes.test.ts",
    executionHosts: ["linux", "darwin"], artifactTargets: []
  },
  {
    id: "artifact.checksum",
    entrypoint: "src/recipes/current-build.ts:lowerChecksum",
    verticalTest: "test/core/current-recipes.test.ts",
    executionHosts: ["linux", "darwin"], artifactTargets: []
  },
  {
    id: "publish.npm",
    entrypoint: "src/recipes/current-publish.ts:lowerNpm",
    verticalTest: "test/core/current-recipes.test.ts",
    executionHosts: ["linux", "darwin"], artifactTargets: []
  },
  {
    id: "publish.github",
    entrypoint: "src/recipes/current-publish.ts:lowerGitHub",
    verticalTest: "test/core/current-recipes.test.ts",
    executionHosts: ["linux", "darwin"], artifactTargets: []
  },
  {
    id: "publish.pypi-files",
    entrypoint: "src/recipes/current-publish.ts:lowerPyPi",
    verticalTest: "test/core/current-recipes.test.ts",
    executionHosts: ["linux", "darwin"], artifactTargets: []
  },
  {
    id: "catalog.render",
    entrypoint: "src/recipes/current-catalog.ts:lowerCurrentCatalogs",
    verticalTest: "test/core/current-recipes.test.ts",
    executionHosts: ["linux", "darwin"], artifactTargets: []
  }
] as const satisfies ReadonlyArray<ExecutableCapability>

export const capabilityIds = new Set(executableCapabilities.map((entry) => entry.id))
