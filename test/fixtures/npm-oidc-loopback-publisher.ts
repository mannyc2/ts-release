#!/usr/bin/env bun

const fail = (reason: string): never => {
  console.error(`fixture npm publisher rejected: ${reason}`)
  process.exit(1)
}

if (process.argv.length === 3 && process.argv[2] === "--version") {
  console.log("11.5.1")
  process.exit(0)
}

const expectedEnvironment = [
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "GITHUB_ACTIONS",
  "GITHUB_EVENT_NAME",
  "GITHUB_REF",
  "GITHUB_REPOSITORY",
  "GITHUB_REPOSITORY_ID",
  "GITHUB_REPOSITORY_OWNER_ID",
  "GITHUB_RUN_ATTEMPT",
  "GITHUB_RUN_ID",
  "GITHUB_SERVER_URL",
  "GITHUB_SHA",
  "GITHUB_WORKFLOW_REF",
  "NPM_CONFIG_IGNORE_SCRIPTS",
  "PATH",
  "RUNNER_ENVIRONMENT"
]
const environmentNames = Object.keys(process.env).sort()
if (JSON.stringify(environmentNames) !== JSON.stringify(expectedEnvironment)) {
  fail("the process environment was not closed")
}
if (process.env.GITHUB_ACTIONS !== "true" || process.env.NPM_CONFIG_IGNORE_SCRIPTS !== "true") {
  fail("the certified GitHub Actions or lifecycle marker was absent")
}
if (process.env.NPM_TOKEN !== undefined || process.env.NODE_AUTH_TOKEN !== undefined ||
  process.env.NPM_CONFIG_USERCONFIG !== undefined) {
  fail("long-lived npm authority entered the workload publisher")
}

const argv = process.argv.slice(2)
if (argv[0] !== "publish" || argv[1] === undefined) fail("the publish command was malformed")
const tarballPath = argv[1]!
const option = (name: string): string | undefined => {
  const index = argv.indexOf(name)
  return index < 0 ? undefined : argv[index + 1]
}
if (!argv.includes("--ignore-scripts") || option("--registry") !== "https://registry.npmjs.org/" ||
  option("--tag") === undefined || option("--access") === undefined || !argv.includes("--json")) {
  fail("the certified npm argv contract was not exact")
}

const manifestResult = Bun.spawnSync([
  "/usr/bin/tar",
  "-xOzf",
  tarballPath,
  "package/package.json"
])
if (manifestResult.exitCode !== 0) fail("the prepared tarball manifest was unreadable")

let manifest: unknown
try {
  manifest = JSON.parse(manifestResult.stdout.toString())
} catch {
  fail("the prepared tarball manifest was malformed")
}
if (typeof manifest !== "object" || manifest === null ||
  !("name" in manifest) || typeof manifest.name !== "string" ||
  !("version" in manifest) || typeof manifest.version !== "string") {
  fail("the prepared tarball omitted its package coordinate")
}
const packageManifest = manifest as { readonly name: string, readonly version: string }
const packageName = packageManifest.name
const packageVersion = packageManifest.version

const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
if (requestUrl === undefined || requestToken === undefined) fail("GitHub OIDC request authority was absent")
const oidcRequestUrl = requestUrl!
const oidcRequestToken = requestToken!

const audience = "npm:registry.npmjs.org"
const oidcUrl = new URL(oidcRequestUrl)
oidcUrl.searchParams.append("audience", audience)
const oidcResponse = await fetch(oidcUrl, {
  redirect: "manual",
  headers: {
    accept: "application/json",
    authorization: `Bearer ${oidcRequestToken}`,
    "x-fixture-environment": environmentNames.join(",")
  }
})
if (oidcResponse.status < 200 || oidcResponse.status >= 300) fail("the GitHub OIDC issuer rejected the request")
const oidcBody = await oidcResponse.json().catch(() => undefined)
if (typeof oidcBody?.value !== "string" || oidcBody.value.length === 0) {
  fail("the GitHub OIDC issuer returned no id_token")
}
const idToken = oidcBody.value

const escapedPackageName = packageName.startsWith("@")
  ? packageName.replace("/", "%2f")
  : encodeURIComponent(packageName)
const exchangeUrl = new URL(
  `/-/npm/v1/oidc/token/exchange/package/${escapedPackageName}`,
  oidcUrl.origin
)
const exchangeResponse = await fetch(exchangeUrl, {
  method: "POST",
  redirect: "manual",
  headers: {
    accept: "application/json",
    authorization: `Bearer ${idToken}`
  }
})
if (exchangeResponse.status < 200 || exchangeResponse.status >= 300) {
  fail("the npm OIDC exchange rejected the id_token")
}
const exchangeBody = await exchangeResponse.json().catch(() => undefined)
if (typeof exchangeBody?.token !== "string" || exchangeBody.token.length === 0) {
  fail("the npm OIDC exchange returned no short-lived token")
}
const exchangeToken = exchangeBody.token

const bytes = await Bun.file(tarballPath).bytes()
const publishUrl = new URL(
  `/fixture/publish/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}`,
  oidcUrl.origin
)
const publishResponse = await fetch(publishUrl, {
  method: "PUT",
  redirect: "manual",
  body: bytes,
  headers: {
    authorization: `Bearer ${exchangeToken}`,
    "content-type": "application/octet-stream"
  }
})
if (publishResponse.status < 200 || publishResponse.status >= 300) {
  fail("the short-lived npm credential did not authorize publication")
}

console.log(JSON.stringify({ package: packageName, version: packageVersion, published: true }))
