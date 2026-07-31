import { plan } from "@mannyc1/ts-release"
import {
  packagePath, readJson, releaseConfigPath, report, root, stringField
} from "./self-release-facts.js"

const failures: Array<string> = []
const planned = await plan({ config: readJson(releaseConfigPath), workspace: root })
const stages = planned.plan.stages
const operations = [
  ...stages.build, ...stages.process, ...stages.catalog, ...stages.validate,
  ...stages.publish, ...stages.announce, ...stages.verify
]
const outputs = operations.flatMap((operation) => operation.outputs)
const outputIds = outputs.map((output) => output.id)
const outputPaths = outputs.map((output) => output.path)
const tags = new Set(operations.map((operation) => operation._tag))
const registryKinds = new Set(stages.publish.flatMap((operation) =>
  operation._tag === "PackageRegistryRelease" ? [operation.registryKind] : []))

if (outputs.length === 0) failures.push("The self-release plan declares no materialized outputs.")
if (new Set(outputIds).size !== outputIds.length) failures.push("The self-release plan declares duplicate output ids.")
if (!tags.has("ForgeRelease")) failures.push("The self-release plan has no forge release operation.")
if (!registryKinds.has("npm")) failures.push("The self-release plan has no npm registry operation.")
if (!registryKinds.has("pypi")) failures.push("The self-release plan has no PyPI registry operation.")
if (stages.catalog.length === 0) failures.push("The self-release plan has no product-owned catalog operations.")
if (outputPaths.some((path) => path.startsWith("/") || path.includes("../"))) {
  failures.push("The self-release plan contains a non-contained output path.")
}

const version = stringField(readJson(packagePath), "version") ?? ""
const pluginZip = `ts-release-plugin-${version}.zip`
const packs = stages.process.filter((operation) =>
  operation._tag === "Pack" && operation.outputs.some((output) => output.id === "ts-release-plugin"))
const pack = packs[0]
if (packs.length !== 1 || pack?._tag !== "Pack") {
  failures.push("Exactly one Pack must produce the ts-release-plugin output.")
} else {
  if ([...(pack.files ?? [])].map(String).join(",") !== "ts-release-plugin/**") {
    failures.push("The plugin Pack must carry exactly the ts-release-plugin/** file pattern.")
  }
  if (pack.inputs.length !== 0) failures.push("The plugin Pack must be files-only.")
  if (pack.outputs[0]?.path !== `.release/artifacts/${pluginZip}`) {
    failures.push(`The plugin archive path must be .release/artifacts/${pluginZip}.`)
  }
}
const digest = stages.process.find((operation) => operation._tag === "Digest")
if (digest?._tag !== "Digest" || !digest.inputs.some((input) => input === "ts-release-plugin")) {
  failures.push("The checksum digest must cover the plugin archive.")
}
const forge = stages.publish.find((operation) => operation._tag === "ForgeRelease")
const assetNames = forge?._tag === "ForgeRelease" ? forge.assets.map((asset) => asset.name) : []
if (!assetNames.includes(pluginZip)) failures.push("ForgeRelease assets must include the plugin ZIP.")
if (!assetNames.some((asset) => asset.endsWith("checksums.txt"))) {
  failures.push("ForgeRelease assets must include the checksum file.")
}
for (const manifestPath of [
  "ts-release-plugin/.codex-plugin/plugin.json", "ts-release-plugin/.claude-plugin/plugin.json"
]) {
  if (stringField(readJson(manifestPath), "version") !== version) {
    failures.push(`${manifestPath} version must equal the root package version.`)
  }
}

report("self-release-artifacts-report/v2", failures, {
  planId: planned.planId,
  operations: operations.length,
  outputs: outputs.length
})
