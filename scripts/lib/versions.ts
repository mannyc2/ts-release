import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export interface VersionsReport {
  readonly failures: ReadonlyArray<string>
  readonly sitesChecked: number
}

const releaseNode = "22.22.2"
const releaseNpm = "11.11.0"
const runnerLabels = new Set(["ubuntu-24.04", "macos-15"])
const actionPins = new Map([
  ["actions/checkout", "11d5960a326750d5838078e36cf38b85af677262"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
  ["actions/cache", "0057852bfaa89a56745cba8c7296529d2fc39830"],
  ["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"],
  ["actions/download-artifact", "d3f86a106a0bac45b974a628896c90dbdf5c8093"],
  ["oven-sh/setup-bun", "0c5077e51419868618aeaa5fe8019c62421857d6"],
  ["pypa/gh-action-pypi-publish", "dc37677b2e1c63e2034f94d8a5b11f265b73ba33"]
])

// One census owns every release-host pin. The packageManager and package
// version remain their manifest authorities; runner and third-party Action
// identities are intentionally immutable source constants.
export const checkVersions = (root: string): VersionsReport => {
  const failures: Array<string> = []
  let sites = 0
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    readonly packageManager?: string
    readonly version?: string
    readonly engines?: { readonly bun?: string }
    readonly dependencies?: Readonly<Record<string, string>>
    readonly peerDependencies?: Readonly<Record<string, string>>
    readonly devDependencies?: Readonly<Record<string, string>>
  }
  const pin = manifest.packageManager?.match(/^bun@([0-9]+\.[0-9]+\.[0-9]+)$/u)?.[1]
  if (pin === undefined) {
    return { failures: ["package.json packageManager must pin bun@X.Y.Z"], sitesChecked: 0 }
  }
  const packageVersion = manifest.version
  if (packageVersion === undefined) failures.push("package.json version is required")
  sites += 1
  sites += 1
  if (manifest.engines?.bun !== `>=${pin}`) {
    failures.push(`package.json engines.bun must be >=${pin}, got ${manifest.engines?.bun ?? "none"}`)
  }
  const workflowSites = [
    ...readdirSync(join(root, ".github/workflows")).filter((entry) => entry.endsWith(".yml"))
      .map((name) => `.github/workflows/${name}`),
    ...readdirSync(join(root, "templates/github-actions")).filter((entry) => entry.endsWith(".yml"))
      .map((name) => `templates/github-actions/${name}`)
  ].sort()
  for (const name of workflowSites) {
    const text = readFileSync(join(root, name), "utf8")
    if (name === ".github/workflows/release.yml") {
      sites += 1
      if ((text.match(/install-self-release-npm\.ts/gu)?.length ?? 0) !== 1 ||
          (text.match(/bootstrap-self-release-tools\.sh/gu)?.length ?? 0) !== 5 ||
          text.includes("bun add --global npm@")) {
        failures.push(`${name} must use one audited preparation installer and five digest-bound native authority/preflight bootstraps`)
      }
    }
    if (/\b(?:ubuntu|macos)-latest\b/u.test(text)) failures.push(`${name} uses a floating runner label`)
    for (const match of text.matchAll(/runs-on:\s*([^\s#]+)/gu)) {
      sites += 1
      const label = match[1]!
      if (!runnerLabels.has(label) && label !== "${{") failures.push(`${name} uses unadmitted runner ${label}`)
    }
    for (const match of text.matchAll(/bun-version:\s*([0-9]+\.[0-9]+\.[0-9]+)/gu)) {
      sites += 1
      if (match[1] !== pin) {
        failures.push(`${name} pins bun-version ${match[1]}, expected ${pin}`)
      }
    }
    for (const match of text.matchAll(/node-version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)/gu)) {
      sites += 1
      if (match[1] !== releaseNode) failures.push(`${name} pins Node ${match[1]}, expected ${releaseNode}`)
    }
    for (const match of text.matchAll(/bun add --global npm@([0-9]+\.[0-9]+\.[0-9]+)/gu)) {
      sites += 1
      if (match[1] !== releaseNpm) failures.push(`${name} pins npm ${match[1]}, expected ${releaseNpm}`)
    }
    for (const match of text.matchAll(/uses:\s*([^\s#]+)@([^\s#]+)/gu)) {
      sites += 1
      const ownerRepository = match[1]!
      const ref = match[2]!
      if (ownerRepository === "mannyc2/ts-release/apps/ts-release-action") {
        if (packageVersion === undefined || ref !== `v${packageVersion}`) {
          failures.push(`${name} uses ${ownerRepository}@${ref}, expected v${packageVersion ?? "<missing>"}`)
        }
        continue
      }
      const expected = actionPins.get(ownerRepository)
      if (expected === undefined) failures.push(`${name} uses unregistered external Action ${ownerRepository}@${ref}`)
      else if (ref !== expected) failures.push(`${name} uses ${ownerRepository}@${ref}, expected ${expected}`)
    }
  }
  const readme = readFileSync(join(root, "README.md"), "utf8")
  for (const match of readme.matchAll(/[Bb]un[ @]([0-9]+\.[0-9]+\.[0-9]+)/gu)) {
    sites += 1
    if (match[1] !== pin) {
      failures.push(`README.md names bun ${match[1]}, expected ${pin}`)
    }
  }
  for (const name of ["effect", "@effect/platform-bun", "@effect/platform-node"]) {
    sites += 1
    const peer = manifest.peerDependencies?.[name]
    const dev = manifest.devDependencies?.[name]
    if (peer === undefined || dev === undefined || peer !== dev) {
      failures.push(`${name} peer (${peer ?? "none"}) and dev (${dev ?? "none"}) must use one exact version`)
    }
  }
  sites += 1
  const nodeShared = manifest.dependencies?.["@effect/platform-node-shared"]
  const effect = manifest.devDependencies?.effect
  if (nodeShared === undefined || effect === undefined || nodeShared !== effect) {
    failures.push(
      `@effect/platform-node-shared dependency (${nodeShared ?? "none"}) and Effect (${effect ?? "none"}) must use one exact version`
    )
  }
  const bootstrap = readFileSync(join(root, "apps/release-ts/scripts/bootstrap-self-release-tools.sh"), "utf8")
  for (const [name, expected] of [["Node", releaseNode], ["Bun", pin], ["npm", releaseNpm]] as const) {
    sites += 1
    if (!bootstrap.includes(expected)) failures.push(`native self-release bootstrap does not bind exact ${name} ${expected}`)
  }
  return { failures, sitesChecked: sites }
}
