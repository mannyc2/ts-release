import * as Schema from "effect/Schema"
import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import { AuthoredConfig } from "../../../src/resolve/authored.js"
import {
  appPackagePath, candidateActionReference, isJsonObject, packagePath, readJson,
  releaseConfigPath, report, root, selfReleaseConfig, stringField
} from "./self-release-facts.js"

const failures: Array<string> = []
const manifest = readJson(packagePath)
const appManifest = readJson(appPackagePath)
const config = readJson(releaseConfigPath)
const packageName = stringField(manifest, "name")
const version = stringField(manifest, "version")

if (packageName !== "@mannyc1/ts-release") failures.push("The root package name is not the canonical release identity.")
if (version === undefined) failures.push("The root package version is missing.")
if (version !== stringField(appManifest, "version")) failures.push("The app and root package versions differ.")
if (!isJsonObject(config)) failures.push("The self-release config must be a JSON object.")
else {
  try {
    Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })(config)
  } catch (cause) {
    failures.push(`Authored self-release configuration is invalid: ${String(cause)}`)
  }
  const project = config.project
  if (!isJsonObject(project) || project.repository !== "mannyc2/ts-release" || Object.keys(project).some((key) => key !== "repository")) {
    failures.push("config.project must declare only the canonical repository required by trusted publishing.")
  }
  if (config.versionFrom !== "manifest") failures.push("config.versionFrom must be manifest.")
  if (!isJsonObject(config.npmPackage) || config.npmPackage.path !== ".") failures.push("config.npmPackage.path must be the root package.")
  const builds = Array.isArray(config.builds) ? config.builds : []
  const requiredTargets = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"]
  if (builds.length !== 1 || !isJsonObject(builds[0]) || !Array.isArray(builds[0].targets) ||
      builds[0].targets.join(",") !== requiredTargets.join(",")) {
    failures.push("Self-release build must contain exactly the four advertised Linux/macOS artifact targets.")
  }
  const archives = Array.isArray(config.archives) ? config.archives : []
  if (archives.length !== requiredTargets.length || requiredTargets.some((target) => {
    const archive = archives.find((item) => isJsonObject(item) && item.id === `cli-${target}`)
    return !isJsonObject(archive) || !Array.isArray(archive.ids) || archive.ids.join(",") !== `cli-${target}` ||
      !Array.isArray(archive.formats) || archive.formats.join(",") !== "tar.gz,zip"
  })) {
    failures.push("Self-release archives must partition the four binaries into one tar.gz and ZIP pair per target.")
  }
  const publish = isJsonObject(config.publish) ? config.publish : {}
  if (Object.keys(publish).some((key) => !["npm", "github"].includes(key))) failures.push("Self-release config contains an unconfigured publication destination.")
  if (!Array.isArray(config.preparations) || !config.preparations.some((item) => isJsonObject(item) && item.id === "agents" && item.kind === "artifact")) {
    failures.push("Self-release config must declare the agent generator as one artifact preparation.")
  } else {
    const agents = config.preparations.find((item) => isJsonObject(item) && item.id === "agents")
    const collection = isJsonObject(agents) && isJsonObject(agents.collection) ? agents.collection : undefined
    if (collection?.root !== ".release/agents/archives" || collection.artifactKind !== "archive" ||
        collection.pathSuffix !== ".zip" || collection.mediaType !== "application/zip") {
      failures.push("Self-release agent preparation must declare the canonical ZIP collection contract.")
    }
  }
}

const api = makeReleaseApi(NodeReleaseLayer)
try {
  const inspection = await api.inspect({ config: selfReleaseConfig(), workspace: root })
  if (!("preparations" in inspection)) failures.push("Self-release context inspection did not return the authored graph projection.")
  else {
    if (packageName !== undefined && inspection.package.name.toString() !== packageName) failures.push("Observed package name disagrees with package.json.")
    if (version !== undefined && inspection.package.version.toString() !== version) failures.push("Observed package version disagrees with package.json.")
    if (inspection.publications.filter((publication) => !["npm", "github"].includes(publication.destination)).length > 0) failures.push("Inspection contains an unconfigured publication destination.")
    if (inspection.publications.map((publication) => publication.destination).join(",") !== "github,npm") {
      failures.push("Self-release publication order must make the immutable GitHub Action ref available before npm publishes its README.")
    }
    if (!inspection.preparations.some((preparation) => preparation.id.toString() === "preparation:agents")) failures.push("Inspection omitted the agent preparation.")
    const agents = inspection.collections.find((collection) => collection.id.toString() === "agents")
    if (agents?.producer.toString() !== "preparation:agents" || agents.root.toString() !== ".release/agents/archives") {
      failures.push("Inspection omitted or changed the agent artifact collection contract.")
    }
  }
} catch (cause) {
  failures.push(`Public inspect failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`)
} finally {
  await api.dispose()
}

report("self-release-context-report/v1", failures, {
  packageName, version, actionReference: candidateActionReference(), evidenceState: "source-derived"
})
