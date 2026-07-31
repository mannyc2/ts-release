import { compactLocalToolProfile as profile } from "./tool.js"

const hosts = ["windows-x64"] as const
export const windowsInstallerProfiles = [
  profile("msi", hosts,
    { name: "wix", versionProbe: ["--version"], versionOutput: "semver-first-token",
      supportedRange: ">=5.0.0 <6.0.0" },
    ["build", "{sourcePath}", "-o", "{output}"], ["wix-source", "package-root"],
    { pathTemplate: "{output}.msi", type: "package" }, "msi-database-and-sha256/v1"),
  profile("nsis", hosts,
    { name: "makensis", versionProbe: ["/VERSION"], versionOutput: "semver-first-token",
      supportedRange: ">=3.10.0 <4.0.0" },
    ["/V2", "/DOUTPUT={output}", "{scriptPath}"], ["nsis-script", "package-root"],
    { pathTemplate: "{output}.exe", type: "executable" }, "pe-installer-and-sha256/v1")
]
