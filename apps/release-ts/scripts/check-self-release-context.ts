import * as Schema from "effect/Schema"
import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import { AuthoredConfig } from "../../../src/resolve/authored.js"
import {
  appPackagePath, candidateActionReference, githubReleaseConfigPath,
  isJsonObject, npmReleaseConfigPath, packagePath, readJson, report, root,
  selfReleaseConfigs, stringField
} from "./self-release-facts.js"

const failures: Array<string> = []
const manifest = readJson(packagePath)
const packageName = stringField(manifest, "name")
const version = stringField(manifest, "version")
const workspaceManifests = [
  appPackagePath,
  "apps/ts-release-action/package.json",
  "apps/ts-release-agents/package.json"
]

if (packageName !== "@mannyc1/ts-release") failures.push("The root package name is not the canonical release identity.")
if (version === undefined) failures.push("The root package version is missing.")
for (const path of workspaceManifests) {
  if (version !== stringField(readJson(path), "version")) failures.push(`${path} and the root package versions differ.`)
}

const configs = selfReleaseConfigs()
for (const { lane, path, config } of configs) {
  if (!isJsonObject(config)) {
    failures.push(`${path} must be a JSON object.`)
    continue
  }
  try {
    Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })(config)
  } catch (cause) {
    failures.push(`${path} is invalid: ${String(cause)}`)
  }
  const project = config.project
  if (!isJsonObject(project) || project.repository !== "mannyc2/ts-release" ||
      Object.keys(project).some((key) => key !== "repository")) {
    failures.push(`${path} project must declare only the canonical trusted-publishing repository.`)
  }
  if (config.versionFrom !== "manifest") failures.push(`${path} must derive its version from the manifest.`)
  const publish = isJsonObject(config.publish) ? config.publish : {}
  if (Object.keys(publish).join(",") !== lane) {
    failures.push(`${path} must contain only the ${lane} publication authority.`)
  }
}

const npmConfig = readJson(npmReleaseConfigPath)
if (!isJsonObject(npmConfig) || !isJsonObject(npmConfig.npmPackage) || npmConfig.npmPackage.path !== ".") {
  failures.push("The npm self-release lane must package only the root package.")
}
if (isJsonObject(npmConfig) && ["builds", "preparations", "archives", "checksum"].some((key) => key in npmConfig)) {
  failures.push("The npm self-release lane must not adopt GitHub release artifacts.")
}

const githubConfig = readJson(githubReleaseConfigPath)
const requiredTargets = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"]
if (!isJsonObject(githubConfig)) {
  failures.push("The GitHub self-release lane must be an object.")
} else {
  if ("npmPackage" in githubConfig) failures.push("The GitHub self-release lane must not adopt npm package bytes.")
  const builds = Array.isArray(githubConfig.builds) ? githubConfig.builds : []
  if (builds.length !== 1 || !isJsonObject(builds[0]) || builds[0].entry !== "apps/release-ts/src/cli/main.ts" ||
      !Array.isArray(builds[0].targets) || builds[0].targets.join(",") !== requiredTargets.join(",")) {
    failures.push("The GitHub self-release lane must build exactly the four advertised targets from the version-bearing CLI entrypoint.")
  }
  const archives = Array.isArray(githubConfig.archives) ? githubConfig.archives : []
  if (archives.length !== requiredTargets.length || requiredTargets.some((target) => {
    const archive = archives.find((item) => isJsonObject(item) && item.id === `cli-${target}`)
    return !isJsonObject(archive) || !Array.isArray(archive.ids) || archive.ids.join(",") !== `cli-${target}` ||
      !Array.isArray(archive.formats) || archive.formats.join(",") !== "tar.gz,zip"
  })) failures.push("The GitHub self-release lane must partition every executable into one tar.gz/ZIP pair.")
  const preparations = Array.isArray(githubConfig.preparations) ? githubConfig.preparations : []
  const agents = preparations.find((item) => isJsonObject(item) && item.id === "agents" && item.kind === "artifact")
  const collection = isJsonObject(agents) && isJsonObject(agents.collection) ? agents.collection : undefined
  if (collection?.root !== ".release/agents/archives" || collection.artifactKind !== "archive" ||
      collection.pathSuffix !== ".zip" || collection.mediaType !== "application/zip") {
    failures.push("The GitHub self-release lane must retain the provider-native agent ZIP collection.")
  }
}

const api = makeReleaseApi(NodeReleaseLayer)
const inspected: Record<string, number> = {}
try {
  for (const { lane, config } of configs) {
    const inspection = await api.inspect({ config, workspace: root })
    if (!("preparations" in inspection)) {
      failures.push(`${lane} self-release inspection did not return the authored graph projection.`)
      continue
    }
    if (packageName !== undefined && inspection.package.name.toString() !== packageName) failures.push(`${lane} inspection changed the package name.`)
    if (version !== undefined && inspection.package.version.toString() !== version) failures.push(`${lane} inspection changed the package version.`)
    if (inspection.publications.length !== 1 || inspection.publications[0]?.destination !== lane) {
      failures.push(`${lane} inspection must contain exactly its one provider-native publication.`)
    }
    inspected[lane] = inspection.publications.length
    if (lane === "github") {
      const agents = inspection.collections.find((collection) => collection.id.toString() === "agents")
      if (!inspection.preparations.some((preparation) => preparation.id.toString() === "preparation:agents") ||
          agents?.producer.toString() !== "preparation:agents" || agents.root.toString() !== ".release/agents/archives") {
        failures.push("GitHub inspection omitted or changed the agent artifact collection contract.")
      }
    }
  }
} catch (cause) {
  failures.push(`Public inspect failed: ${cause instanceof Error && cause.message.length > 0 ? cause.message : JSON.stringify(cause)}`)
} finally {
  await api.dispose()
}

report("self-release-context-report/v2", failures, {
  packageName,
  version,
  actionReference: candidateActionReference(),
  configs: { github: githubReleaseConfigPath, npm: npmReleaseConfigPath },
  inspected,
  evidenceState: "source-derived"
})
