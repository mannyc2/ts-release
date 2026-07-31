import { localToolProfile, type PackageHost } from "./tool.js"

const unix: ReadonlyArray<PackageHost> = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"]
const profile = (
  id: string, tool: string, versionOutput: string, range: string, argv: ReadonlyArray<string>,
  inputs: ReadonlyArray<string>, type: string, validation: string, hosts = unix
) => localToolProfile({
  profileId: `package.${id}.v1`, contractFixtureId: `contract.package.${id}.v1`, hosts,
  executable: { name: tool, versionProbe: ["--version"], versionOutput, supportedRange: range },
  argv, inputSelectors: inputs, outputs: [{ pathTemplate: "{output}", type }],
  validationOperation: validation
})

export const archiveGeneratorProfiles = [
  profile("nfpm", "nfpm", "semver-first-token", ">=2.40.0 <3.0.0",
    ["package", "--config", "{configPath}", "--packager", "{format}", "--target", "{output}"],
    ["package-root", "package-config"], "package", "package-container-and-sha256/v1"),
  profile("makeself", "makeself", "semver-first-token", ">=2.5.0 <3.0.0",
    ["--nox11", "{inputDir}", "{output}", "{label}", "./{entrypoint}"],
    ["package-root"], "executable", "nonempty-executable-and-sha256/v1"),
  profile("source-rpm", "rpmbuild", "semver-last-token", ">=4.18.0 <5.0.0",
    ["-bs", "{specPath}", "--define", "_topdir {topDir}"],
    ["source-archive", "rpm-spec"], "package", "source-rpm-and-sha256/v1",
    ["linux-arm64", "linux-x64"])
]
