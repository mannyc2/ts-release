import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export interface VersionsReport {
  readonly failures: ReadonlyArray<string>
  readonly sitesChecked: number
}

// One authoritative pin — package.json packageManager — asserted everywhere
// the version is written down. Future single-source pins (node for the
// Action, TypeScript) belong here too: one census, not eleven greps.
export const checkVersions = (root: string): VersionsReport => {
  const failures: Array<string> = []
  let sites = 0
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    readonly packageManager?: string
    readonly engines?: { readonly bun?: string }
    readonly dependencies?: Readonly<Record<string, string>>
    readonly peerDependencies?: Readonly<Record<string, string>>
    readonly devDependencies?: Readonly<Record<string, string>>
  }
  const pin = manifest.packageManager?.match(/^bun@([0-9]+\.[0-9]+\.[0-9]+)$/u)?.[1]
  if (pin === undefined) {
    return { failures: ["package.json packageManager must pin bun@X.Y.Z"], sitesChecked: 0 }
  }
  sites += 1
  sites += 1
  if (manifest.engines?.bun !== `>=${pin}`) {
    failures.push(`package.json engines.bun must be >=${pin}, got ${manifest.engines?.bun ?? "none"}`)
  }
  const workflows = join(root, ".github/workflows")
  for (const name of readdirSync(workflows).filter((entry) => entry.endsWith(".yml")).sort()) {
    const text = readFileSync(join(workflows, name), "utf8")
    for (const match of text.matchAll(/bun-version:\s*([0-9]+\.[0-9]+\.[0-9]+)/gu)) {
      sites += 1
      if (match[1] !== pin) {
        failures.push(`.github/workflows/${name} pins bun-version ${match[1]}, expected ${pin}`)
      }
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
  return { failures, sitesChecked: sites }
}
