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
  if (!isJsonObject(project) || Object.keys(project).length !== 0) failures.push("config.project must stay empty so source and manifest facts are inferred.")
  if (config.versionFrom !== "manifest") failures.push("config.versionFrom must be manifest.")
  if (!isJsonObject(config.npmPackage) || config.npmPackage.path !== ".") failures.push("config.npmPackage.path must be the root package.")
  const builds = Array.isArray(config.builds) ? config.builds : []
  if (builds.some((build) => !isJsonObject(build) || !Array.isArray(build.targets) || build.targets.some((target) => typeof target !== "string" || target.startsWith("windows-")))) {
    failures.push("Self-release builds must contain only the retained Linux/macOS targets.")
  }
  const publish = isJsonObject(config.publish) ? config.publish : {}
  if (Object.keys(publish).some((key) => !["npm", "github"].includes(key))) failures.push("Self-release config contains an unconfigured publication destination.")
  if (!Array.isArray(config.preparations) || !config.preparations.some((item) => isJsonObject(item) && item.id === "agents" && item.kind === "artifact")) {
    failures.push("Self-release config must declare the agent generator as one artifact preparation.")
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
    if (!inspection.preparations.some((preparation) => preparation.id.toString() === "preparation:agents")) failures.push("Inspection omitted the agent preparation.")
  }
} catch (cause) {
  failures.push(`Public inspect failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`)
} finally {
  await api.dispose()
}

report("self-release-context-report/v1", failures, {
  packageName, version, actionReference: candidateActionReference(), evidenceState: "source-derived"
})
