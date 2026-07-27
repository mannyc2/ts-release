import { localToolProfile } from "./tool.js"

const hosts = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"] as const
const outputs = [
  { pathTemplate: "{outputDir}/{name}-{version}.tar.gz", type: "archive" },
  { pathTemplate: "{outputDir}/{name}-{version}-py3-none-" + "an" + "y.whl", type: "wheel" }
] as const
const profile = (name: "uv" | "poetry", versionOutput: string, supportedRange: string, flag: string) =>
  localToolProfile({
    profileId: `package.${name}-build.v1`, contractFixtureId: `contract.package.${name}-build.v1`, hosts,
    executable: { name, versionProbe: ["--version"], versionOutput, supportedRange },
    argv: ["build", flag, "{outputDir}"], inputSelectors: ["python-project"], outputs,
    validationOperation: "python-distribution-and-sha256/v1"
  })

export const pythonBuilderProfiles = [
  profile("uv", "semver-second-token", ">=0.8.0 <0.9.0", "--out-dir"),
  profile("poetry", "semver-parenthesized", ">=2.0.0 <3.0.0", "--output")
]
