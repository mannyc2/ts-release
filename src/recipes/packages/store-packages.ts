import { compactLocalToolProfile as profile, type PackageHost } from "./tool.js"

const linux: ReadonlyArray<PackageHost> = ["linux-arm64", "linux-x64"]
export const storePackageProfiles = [
  profile("snap-build", linux,
    { name: "snapcraft", versionProbe: ["version"], versionOutput: "semver-second-token",
      supportedRange: ">=8.0.0 <9.0.0" },
    ["pack", "{inputDir}", "--output", "{output}"], ["snap-project"],
    { pathTemplate: "{output}.snap", type: "package" }, "squashfs-package-and-sha256/v1"),
  profile("flatpak-build", linux,
    { name: "flatpak-builder", versionProbe: ["--version"], versionOutput: "semver-second-token",
      supportedRange: ">=1.4.0 <2.0.0" },
    ["--force-clean", "{buildDir}", "{manifestPath}"], ["flatpak-manifest", "package-root"],
    { pathTemplate: "{output}", type: "directory" }, "flatpak-repository-and-sha256/v1"),
  profile("chocolatey-pack", ["windows-x64"],
    { name: "choco", versionProbe: ["--version"], versionOutput: "semver-first-token",
      supportedRange: ">=2.4.0 <3.0.0" },
    ["pack", "{specPath}", "--outputdirectory", "{outputDir}"], ["chocolatey-spec", "package-root"],
    { pathTemplate: "{outputDir}/{name}.{version}.nupkg", type: "package" }, "zip-nupkg-and-sha256/v1")
]
