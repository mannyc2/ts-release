import * as Schema from "effect/Schema"
import { AuthoredConfig } from "../../../src/resolve/authored.js"
import {
  appPackagePath, isJsonObject, packagePath, readJson, releaseConfigPath,
  report, stringField
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
if (isJsonObject(config)) {
  try {
    Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })(config)
  } catch (cause) {
    failures.push(`Authored release configuration is invalid: ${String(cause)}`)
  }
  const project = config.project
  if (!isJsonObject(project)) failures.push("config.project must be an object.")
  else {
    if (stringField(project, "name") !== name) failures.push("config.project.name must equal package.json name.")
    if (stringField(project, "version") !== version) failures.push("config.project.version must equal package.json version.")
    if (stringField(project, "tag") !== `v${version ?? ""}`) failures.push("config.project.tag must equal v{version}.")
  }
}
report("self-release-config-report/v3", failures, { version })
