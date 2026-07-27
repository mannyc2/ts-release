import { localToolProfile, type LocalToolProfile } from "./tool.js"
import { pythonBuilderProfiles } from "./python.js"
import { universalMachoProfile } from "./universal-macho.js"
import { archiveGeneratorProfiles } from "./archive-generators.js"
import { storePackageProfiles } from "./store-packages.js"

export const localToolProfiles: ReadonlyArray<LocalToolProfile> = [
  ...pythonBuilderProfiles, universalMachoProfile, ...archiveGeneratorProfiles, ...storePackageProfiles,
  localToolProfile({
    profileId: "package.node-sea.v1",
    contractFixtureId: "contract.package.node-sea.v1",
    hosts: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"],
    executable: {
      name: "node", versionProbe: ["--version"], versionOutput: "semver-first-token",
      supportedRange: ">=22.0.0 <23.0.0"
    },
    argv: ["--experimental-sea-config", "{configPath}"],
    inputSelectors: ["javascript-entry", "sea-config"],
    outputs: [{ pathTemplate: "{output}", type: "executable" }],
    validationOperation: "nonempty-executable-and-sha256/v1"
  })]
export const findLocalToolProfile = (id: string): LocalToolProfile => {
  const found = localToolProfiles.find((profile) => profile.profileId === id)
  if (found === undefined) throw new Error(`Unknown immutable package profile ${id}.`)
  return found
}
