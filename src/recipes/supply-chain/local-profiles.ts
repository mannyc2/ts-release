import { localToolProfile, type LocalToolProfile } from "../packages/tool.js"

const hosts = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"] as const
const profile = (id: string, executable: LocalToolProfile["contract"]["executable"],
  argv: ReadonlyArray<string>, inputs: ReadonlyArray<string>, type: string, validation: string) =>
  localToolProfile({
    profileId: `supply.${id}.v1`, contractFixtureId: `contract.supply.${id}.v1`,
    hosts, executable, argv, inputSelectors: inputs,
    outputs: [{ pathTemplate: "{output}", type }], validationOperation: validation })

export const supplyLocalProfiles = [
  profile("local-container-build", {
    name: "docker", versionProbe: ["version", "--format", "{{.Client.Version}}"],
    versionOutput: "semver-first-token", supportedRange: ">=27.0.0 <28.0.0"
  }, ["buildx", "build", "--metadata-file", "{output}", "{input}"],
  ["container-context"], "container-metadata", "observed-container-digest-and-sha256/v1"),
  profile("local-sbom", {
    name: "syft", versionProbe: ["version", "-o", "json"],
    versionOutput: "json-version-field", supportedRange: ">=1.0.0 <2.0.0"
  }, ["scan", "{input}", "-o", "spdx-json={output}"],
  ["verified-artifact"], "sbom", "spdx-subject-digest-and-sha256/v1"),
  profile("local-detached-sign", {
    name: "minisign", versionProbe: ["-v"],
    versionOutput: "semver-first-token", supportedRange: ">=0.12.0 <0.13.0"
  }, ["-S", "-s", "{keyFile}", "-m", "{input}", "-x", "{output}"],
  ["verified-artifact", "public-key-file"], "signature", "detached-signature-subject-digest/v1")
]
export const findSupplyLocalProfile = (id: string): LocalToolProfile => {
  const found = supplyLocalProfiles.find((candidate) => candidate.profileId === id)
  if (found === undefined) throw new Error(`Unknown immutable supply-chain local profile ${id}.`)
  return found
}
