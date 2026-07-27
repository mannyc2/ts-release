import { localToolProfile } from "./tool.js"

export const universalMachoProfile = localToolProfile({
  profileId: "package.universal-macho.v1",
  contractFixtureId: "contract.package.universal-macho.v1",
  hosts: ["darwin-arm64", "darwin-x64"],
  executable: {
    name: "lipo", versionProbe: ["-version"], versionOutput: "apple-tool-version",
    supportedRange: ">=1000.0.0 <2000.0.0"
  },
  argv: ["-create", "{input:arm64}", "{input:amd64}", "-output", "{output}"],
  inputSelectors: ["macho-arm64", "macho-amd64"],
  outputs: [{ pathTemplate: "{output}", type: "executable" }],
  validationOperation: "universal-macho-two-architectures-and-sha256/v1"
})
