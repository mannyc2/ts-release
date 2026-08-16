import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const usage = "usage: bun probe-effect-build-alignment.mjs --effect-build <path> --effect-version <version>"
const argv = process.argv.slice(2)
const valueAfter = (flag) => {
  const index = argv.indexOf(flag)
  if (index < 0 || argv[index + 1] === undefined) throw new Error(usage)
  return argv[index + 1]
}

const effectBuildInput = resolve(valueAfter("--effect-build"))
const effectVersion = valueAfter("--effect-version")
const repository = resolve(fileURLToPath(new URL("../../../../", import.meta.url)))

if (!existsSync(join(effectBuildInput, "packages/effect-build/package.json"))) {
  throw new Error(`effect-build checkout is missing: ${effectBuildInput}`)
}
if (!/^4\.0\.0-(?:beta\.\d+|rc\.\d+)$/u.test(effectVersion)) {
  throw new Error(`unsupported candidate syntax: ${effectVersion}`)
}

const ignoredComponents = new Set([
  ".agent-sources",
  ".cache",
  ".git",
  ".probe",
  ".release",
  ".repos",
  "dist",
  "node_modules"
])
const shouldCopyTsRelease = (source) => {
  const path = relative(repository, source)
  if (path === "") return true
  return !path.split(sep).some((component) => ignoredComponents.has(component))
}
const shouldCopyEffectBuild = (source) => {
  const path = relative(effectBuildInput, source)
  if (path === "") return true
  return !path.split(sep).some((component) =>
    new Set([".agent-sources", ".cache", ".git", "node_modules", "dist", "outputs", "work"]).has(component)
  )
}

const alignedEffectPackages = new Set([
  "effect",
  "@effect/platform-bun",
  "@effect/platform-deno",
  "@effect/platform-node",
  "@effect/platform-node-shared"
])

const isLocalDependency = (value) =>
  typeof value === "string" && /^(?:file|link|portal|workspace):/u.test(value)

const packageFiles = (root) => {
  const found = []
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      if (name === "node_modules" || name === ".git") continue
      const path = join(directory, name)
      const stat = statSync(path)
      if (stat.isDirectory()) visit(path)
      else if (name === "package.json") found.push(path)
    }
  }
  visit(root)
  return found
}

const rewriteEffectFamily = (root, options) => {
  let rewrites = 0
  for (const path of packageFiles(root)) {
    const manifest = JSON.parse(readFileSync(path, "utf8"))
    for (const sectionName of ["dependencies", "devDependencies", "optionalDependencies", ...(options.rewritePeers ? ["peerDependencies"] : [])]) {
      const section = manifest[sectionName]
      if (section === undefined) continue
      for (const dependency of Object.keys(section)) {
        if (alignedEffectPackages.has(dependency) && !isLocalDependency(section[dependency])) {
          section[dependency] = effectVersion
          rewrites += 1
        }
      }
    }
    if (manifest.overrides && typeof manifest.overrides === "object") {
      for (const dependency of Object.keys(manifest.overrides)) {
        if (alignedEffectPackages.has(dependency) && !isLocalDependency(manifest.overrides[dependency])) {
          manifest.overrides[dependency] = effectVersion
          rewrites += 1
        }
      }
    }
    if (options.platformNodeSharedOverride && path === join(root, "package.json")) {
      manifest.overrides = {
        ...(manifest.overrides ?? {}),
        "@effect/platform-node-shared": effectVersion
      }
      rewrites += 1
    }
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  if (rewrites === 0) throw new Error(`no Effect family references found under ${root}`)
  return rewrites
}

const removeLocks = (root) => {
  for (const name of ["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    rmSync(join(root, name), { force: true })
  }
}

const attemptedPhases = []
const completedPhases = []
let failedPhase
const run = (phase, cwd, command, args) => {
  attemptedPhases.push(phase)
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, BUN_INSTALL_CACHE_DIR: join(temporaryRoot, "bun-cache") },
    stdio: "inherit"
  })
  if (result.error) {
    failedPhase = phase
    throw new Error(`${phase}: ${result.error.message}`)
  }
  if (result.status !== 0) {
    failedPhase = phase
    throw new Error(`${phase}: ${command} ${args.join(" ")} exited ${result.status}${result.signal ? ` (${result.signal})` : ""}`)
  }
  completedPhases.push(phase)
}

const shippedManifest = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"))
const effectBuildManifest = JSON.parse(readFileSync(join(effectBuildInput, "packages/effect-build/package.json"), "utf8"))
const shippedEffect = shippedManifest.peerDependencies?.effect
const effectBuildPeer = effectBuildManifest.peerDependencies?.effect

const temporaryRoot = mkdtempSync(join(tmpdir(), "ts-release-effect-alignment-"))
const tsReleaseCopy = join(temporaryRoot, "ts-release")
const effectBuildCopy = join(temporaryRoot, "effect-build")
let result
try {
  cpSync(repository, tsReleaseCopy, { recursive: true, filter: shouldCopyTsRelease })
  cpSync(effectBuildInput, effectBuildCopy, { recursive: true, filter: shouldCopyEffectBuild })

  const tsReleaseRewrites = rewriteEffectFamily(tsReleaseCopy, {
    rewritePeers: true,
    platformNodeSharedOverride: false
  })
  const effectBuildRewrites = rewriteEffectFamily(effectBuildCopy, {
    rewritePeers: false,
    platformNodeSharedOverride: true
  })
  removeLocks(tsReleaseCopy)
  removeLocks(effectBuildCopy)

  run("effect-build install", effectBuildCopy, "bun", ["install"])
  run("effect-build build", effectBuildCopy, "bun", ["run", "build"])
  run("effect-build check", effectBuildCopy, "bun", ["run", "check"])
  run("effect-build type tests", effectBuildCopy, "bun", ["run", "test:types"])
  run("effect-build unit tests", effectBuildCopy, "bun", ["run", "test:unit"])
  run("effect-build clean consumer", effectBuildCopy, "bun", ["run", "test:consumer:fresh"])

  const tsManifestPath = join(tsReleaseCopy, "package.json")
  const tsManifest = JSON.parse(readFileSync(tsManifestPath, "utf8"))
  tsManifest.devDependencies = {
    ...(tsManifest.devDependencies ?? {}),
    "effect-build": `file:${join(effectBuildCopy, "packages/effect-build")}`
  }
  writeFileSync(tsManifestPath, `${JSON.stringify(tsManifest, null, 2)}\n`)

  run("ts-release aligned install", tsReleaseCopy, "bun", ["install"])
  run("ts-release aligned typecheck", tsReleaseCopy, "bun", ["run", "check"])

  const importProbe = join(tsReleaseCopy, "effect-build-alignment-probe.ts")
  writeFileSync(importProbe, [
    'import { Effect } from "effect"',
    'import * as Provider from "effect-build/Provider"',
    'void Effect.succeed("aligned")',
    'void Provider.define',
    ''
  ].join("\n"))
  run("combined clean import", tsReleaseCopy, "bun", [
    "x", "tsc", "--noEmit", "--strict", "--skipLibCheck",
    "--target", "ESNext", "--module", "NodeNext", "--moduleResolution", "NodeNext",
    basename(importProbe)
  ])

  result = {
    classification: "informational-candidate",
    effectVersion,
    shippedEffect,
    effectBuildPeer,
    shippedManifestsInstallCompatible: false,
    tsReleaseEffectReferencesRewritten: tsReleaseRewrites,
    effectBuildDevelopmentReferencesRewritten: effectBuildRewrites,
    fullGatePassed: true,
    attemptedPhases,
    completedPhases
  }
} catch (error) {
  result = {
    classification: "informational-candidate",
    effectVersion,
    shippedEffect,
    effectBuildPeer,
    shippedManifestsInstallCompatible: false,
    fullGatePassed: false,
    attemptedPhases,
    completedPhases,
    failedPhase,
    error: error instanceof Error ? error.message : String(error)
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

console.log(`EFFECT_ALIGNMENT_RESULT=${JSON.stringify(result)}`)
if (process.env.REQUIRE_EFFECT_ALIGNMENT === "1" && !result.fullGatePassed) {
  process.exitCode = 1
}
