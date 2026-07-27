import { compactLocalToolProfile as profile, type PackageHost } from "./tool.js"

const hosts: ReadonlyArray<PackageHost> = ["darwin-arm64", "darwin-x64"]
export const appleInstallerProfiles = [
  profile("macos-app", hosts,
    { name: "ditto", versionProbe: ["--version"], versionOutput: "apple-tool-version",
      supportedRange: ">=1.0.0 <2.0.0" },
    ["--rsrc", "{inputDir}", "{output}"], ["application-root"],
    { pathTemplate: "{output}.app", type: "directory" }, "macos-app-bundle-and-sha256/v1"),
  profile("dmg", hosts,
    { name: "hdiutil", versionProbe: ["help"], versionOutput: "apple-tool-version",
      supportedRange: ">=1.0.0 <2.0.0" },
    ["create", "-srcfolder", "{inputDir}", "-format", "UDZO", "{output}"], ["application-root"],
    { pathTemplate: "{output}.dmg", type: "package" }, "udif-image-and-sha256/v1"),
  profile("macos-pkg", hosts,
    { name: "pkgbuild", versionProbe: ["--version"], versionOutput: "apple-tool-version",
      supportedRange: ">=1.0.0 <2.0.0" },
    ["--root", "{inputDir}", "--identifier", "{bundleId}", "--version", "{version}", "{output}"],
    ["package-root"], { pathTemplate: "{output}.pkg", type: "package" }, "xar-package-and-sha256/v1")
]
