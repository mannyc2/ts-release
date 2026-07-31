import { plan } from "@mannyc1/ts-release"
import {
  appPackagePath, isJsonObject, packagePath, readJson, releaseConfigPath,
  report, root, stringField
} from "./self-release-facts.js"

const failures: Array<string> = []
const manifest = readJson(packagePath)
const appManifest = readJson(appPackagePath)
const config = readJson(releaseConfigPath)

if (!isJsonObject(manifest)) failures.push(`${packagePath} must be a JSON object.`)
if (!isJsonObject(appManifest)) failures.push(`${appPackagePath} must be a JSON object.`)
if (!isJsonObject(config)) failures.push(`${releaseConfigPath} must be a JSON object.`)

const name = stringField(manifest, "name")
const version = stringField(manifest, "version")
if (name !== "@mannyc1/ts-release") failures.push("The root package name is not the release identity.")
if (version === undefined) failures.push("The root package version is missing.")
if (version !== stringField(appManifest, "version")) failures.push("The app and root package versions differ.")

let planId: string | undefined
if (isJsonObject(config)) {
  const project = config.project
  if (!isJsonObject(project)) failures.push("config.project must be a complete object.")
  else {
    if (stringField(project, "name") !== name) failures.push("config.project.name must equal package.json name.")
    if (stringField(project, "version") !== version) failures.push("config.project.version must equal package.json version.")
    if (stringField(project, "tag") !== `v${version ?? ""}`) failures.push("config.project.tag must equal v{version}.")
    if (stringField(project, "commit") !== "HEAD") failures.push("config.project.commit must explicitly be HEAD.")
  }
  if (!isJsonObject(config.publish)) failures.push("config.publish must be a complete object.")
  else {
    for (const provider of ["npm", "github", "homebrew", "scoop", "pypi"]) {
      if (!isJsonObject(config.publish[provider])) failures.push(`config.publish.${provider} must be configured.`)
    }
  }
  try {
    const planned = await plan({ config, workspace: root })
    planId = planned.planId
    if (planned.plan.identity.name !== name) failures.push("Planned name differs from package identity.")
    if (planned.plan.identity.version !== version) failures.push("Planned version differs from package identity.")
    if (planned.plan.identity.tag !== `v${version ?? ""}`) failures.push("Planned tag differs from package identity.")
    if (!planned.bytes.endsWith("\n")) failures.push("Plan bytes must end with one newline.")
  } catch (cause) {
    failures.push(`Public planning failed: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

report("self-release-config-report/v2", failures, { planId })
