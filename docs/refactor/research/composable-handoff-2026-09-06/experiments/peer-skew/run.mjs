// Installer behavior under peer/dependency skew. Synthetic packages, loopback registry, no network.
// Usage: bun run.mjs <work-dir>   (writes results.json next to this file)
import { createHash } from "node:crypto"
import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const work = process.argv[2] ?? join(here, "work")
rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true })
const NODE = "/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node"
const NPM = "/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/npm"
const BUN = process.execPath
const sha = (b) => createHash("sha256").update(b).digest("hex")
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "FORCE_COLOR" && k !== "NO_COLOR"))
const run = (argv, cwd, env = {}) => {
  try { return { code: 0, out: execFileSync(argv[0], argv.slice(1), { cwd, encoding: "utf8", env: { ...baseEnv, ...env }, stdio: ["ignore", "pipe", "pipe"] }) } }
  catch (e) { return { code: e.status, out: String(e.stdout ?? ""), err: String(e.stderr ?? "") } }
}

// ---- synthetic packages -------------------------------------------------------
const packs = []
function makePackage(name, version, manifestExtra, indexSource) {
  const dir = join(work, "src", `${name.replace("/", "__")}-${version}`)
  mkdirSync(dir, { recursive: true })
  const manifest = { name, version, type: "module", main: "index.js", exports: { ".": "./index.js" }, ...manifestExtra }
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest, null, 2))
  writeFileSync(join(dir, "index.js"), indexSource)
  const tgz = join(work, "tarballs", `${name.replace("/", "__")}-${version}.tgz`)
  mkdirSync(dirname(tgz), { recursive: true })
  execFileSync("tar", ["-czf", tgz, "-C", dir, "--transform", "s,^\\./,package/,", "--transform", "s,^package\\.json,package/package.json,;s,^index\\.js,package/index.js,", "package.json", "index.js"])
  packs.push({ name, version, path: tgz, sha256: sha(readFileSync(tgz)), manifest })
}
const kernelSource = (version) => `export const version = ${JSON.stringify(version)}\nexport const TOKEN = Symbol("kernel-instance")\nconst key = Symbol.for("skew-lab/kernel-instances")\nglobalThis[key] = (globalThis[key] ?? 0) + 1\nexport const instances = () => globalThis[key]\n`
const providerSource = `import * as k from "kernel"\nexport const kernelToken = k.TOKEN\nexport const kernelVersion = k.version\n`
makePackage("fake-effect", "4.0.0-rc.108", {}, `export const version = "4.0.0-rc.108"\n`)
makePackage("fake-effect", "4.0.0-rc.109", {}, `export const version = "4.0.0-rc.109"\n`)
makePackage("kernel-exactpeer", "1.0.0", { peerDependencies: { "fake-effect": "4.0.0-rc.108" } }, `import * as e from "fake-effect"\nexport const effectVersion = e.version\n`)
makePackage("kernel-rangepeer", "1.0.0", { peerDependencies: { "fake-effect": ">=4.0.0-rc.108 <4.1.0-0" } }, `import * as e from "fake-effect"\nexport const effectVersion = e.version\n`)
makePackage("kernel", "1.0.0", {}, kernelSource("1.0.0"))
makePackage("kernel", "1.5.0", {}, kernelSource("1.5.0"))
makePackage("kernel", "2.0.0", {}, kernelSource("2.0.0"))
makePackage("provider-depexact", "1.0.0", { dependencies: { kernel: "1.0.0" } }, providerSource)
makePackage("provider-peerexact", "1.0.0", { peerDependencies: { kernel: "1.0.0" } }, providerSource)
makePackage("provider-peercaret", "1.0.0", { peerDependencies: { kernel: "^1.0.0" } }, providerSource)
makePackage("provider-peerwide", "1.0.0", { peerDependencies: { kernel: ">=1.0.0 <3.0.0" } }, providerSource)
writeFileSync(join(work, "registry.json"), JSON.stringify(packs))

// ---- loopback registry --------------------------------------------------------
const registry = spawn(NODE, [join(here, "registry.mjs"), join(work, "registry.json")], { stdio: ["ignore", "pipe", "pipe"], env: baseEnv })
const port = await new Promise((resolve, reject) => { registry.stdout.once("data", (d) => resolve(Number(String(d).trim()))); registry.once("exit", (code) => reject(new Error(`registry exited ${code}`))) })
const REGISTRY = `http://127.0.0.1:${port}`

// ---- scenarios -----------------------------------------------------------------
const scenarios = [
  { id: "S1-effect-exact-peer-consumer-rc109", deps: { "fake-effect": "4.0.0-rc.109", "kernel-exactpeer": "1.0.0" }, question: "kernel pins effect as an EXACT peer; consumer resolves effect rc.109 (what effect-build 0.6.3's range allows)" },
  { id: "S2-effect-range-peer-consumer-rc109", deps: { "fake-effect": "4.0.0-rc.109", "kernel-rangepeer": "1.0.0" }, question: "kernel declares effect as a RANGE peer (tracked law scripts/lib/versions.ts:49); consumer resolves rc.109" },
  { id: "S3-provider-dependencies-exact-kernel-skew", deps: { kernel: "2.0.0", "provider-depexact": "1.0.0" }, probe: "provider-depexact", question: "provider lists kernel@1.0.0 in dependencies (as layout.json projects); consumer installs kernel@2.0.0" },
  { id: "S4-provider-peer-exact-kernel-skew", deps: { kernel: "2.0.0", "provider-peerexact": "1.0.0" }, probe: "provider-peerexact", question: "provider lists kernel@1.0.0 as an EXACT peer (audit D4); consumer installs kernel@2.0.0" },
  { id: "S5-provider-peer-caret-kernel-1.5", deps: { kernel: "1.5.0", "provider-peercaret": "1.0.0" }, probe: "provider-peercaret", question: "provider peer ^1.0.0; consumer installs kernel@1.5.0 (in range)" },
  { id: "S6-provider-peer-caret-kernel-2.0", deps: { kernel: "2.0.0", "provider-peercaret": "1.0.0" }, probe: "provider-peercaret", question: "provider peer ^1.0.0; consumer installs kernel@2.0.0 (out of range)" },
  { id: "S7-provider-peer-exact-kernel-match", deps: { kernel: "1.0.0", "provider-peerexact": "1.0.0" }, probe: "provider-peerexact", question: "control: exact peer satisfied" },
  { id: "S8-provider-dependencies-exact-with-consumer-override", deps: { kernel: "2.0.0", "provider-depexact": "1.0.0" }, probe: "provider-depexact", overrides: { kernel: "2.0.0" }, question: "S3 plus a consumer-side override forcing one kernel (npm overrides / bun overrides)" },
  { id: "S9-provider-peer-exact-consumer-omits-kernel", deps: { "provider-peerexact": "1.0.0" }, probe: "provider-peerexact", question: "consumer installs only the provider; does the installer auto-install the exact kernel peer?" }
]
function tree(root) {
  const found = []
  const walk = (dir, depth) => {
    if (depth > 6 || !existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (entry.startsWith("@")) { walk(full, depth); continue }
      const manifest = join(full, "package.json")
      if (existsSync(manifest)) {
        const m = JSON.parse(readFileSync(manifest, "utf8"))
        if (/^(kernel|fake-effect|provider-)/.test(m.name ?? "")) found.push({ name: m.name, version: m.version, path: full.slice(root.length + 1) })
        walk(join(full, "node_modules"), depth + 1)
      }
    }
  }
  walk(join(root, "node_modules"), 0)
  return found.sort((a, b) => a.path.localeCompare(b.path))
}
const results = { format: "installer-skew-experiment/1", registry: "loopback, synthetic packages (no Effect code)", node: run([NODE, "--version"], work).out.trim(), npm: run([NPM, "--version"], work).out.trim(), bun: run([BUN, "--version"], work).out.trim(), scenarios: [] }
for (const scenario of scenarios) for (const installer of ["npm", "bun"]) {
  const root = join(work, "consumers", `${scenario.id}-${installer}`)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module", dependencies: scenario.deps, ...(scenario.overrides ? { overrides: scenario.overrides } : {}) }, null, 2))
  const home = join(root, ".home"); mkdirSync(home)
  const install = installer === "npm"
    ? run([NPM, "install", "--registry", REGISTRY, "--no-audit", "--no-fund", "--ignore-scripts", "--loglevel=warn", "--cache", join(root, ".npm-cache")], root, { HOME: home })
    : run([BUN, "install", "--registry", REGISTRY, "--ignore-scripts", "--backend", "copyfile", "--linker", "hoisted"], root, { HOME: home, BUN_INSTALL_CACHE_DIR: join(root, ".bun-cache"), XDG_CACHE_HOME: join(root, ".cache") })
  const installed = tree(root)
  let runtime = null
  if (install.code === 0 && scenario.probe) {
    const probe = run([NODE, "--input-type=module", "-e", `import * as k from "kernel"; import * as p from ${JSON.stringify(scenario.probe)}; console.log(JSON.stringify({ rootKernel: k.version, providerKernel: p.kernelVersion, sameInstance: k.TOKEN === p.kernelToken, kernelInstancesLoaded: k.instances() }))`], root)
    runtime = probe.code === 0 ? JSON.parse(probe.out.trim()) : { error: (probe.err ?? "").split("\n").slice(0, 3).join(" | ") }
  }
  if (install.code === 0 && !scenario.probe) {
    const name = Object.keys(scenario.deps).find((n) => n.startsWith("kernel-"))
    const probe = run([NODE, "--input-type=module", "-e", `import * as k from ${JSON.stringify(name)}; console.log(JSON.stringify({ kernelSeesEffect: k.effectVersion }))`], root)
    runtime = probe.code === 0 ? JSON.parse(probe.out.trim()) : { error: (probe.err ?? "").split("\n").slice(0, 3).join(" | ") }
  }
  const diagnostics = `${install.out}\n${install.err ?? ""}`.split("\n").filter((l) => /ERESOLVE|peer|warn|error|incorrect|Could not resolve|conflicting/i.test(l)).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 8)
  results.scenarios.push({ id: scenario.id, installer, question: scenario.question, dependencies: scenario.deps, overrides: scenario.overrides ?? null, installExit: install.code, diagnostics, installed, runtime })
  console.log(scenario.id, installer, "exit", install.code, "| installed:", installed.map((p) => `${p.name}@${p.version}${p.path.includes("/node_modules/") ? " (nested)" : ""}`).join(", "), "| runtime:", JSON.stringify(runtime))
}
registry.kill()
writeFileSync(join(here, "results.json"), JSON.stringify(results, null, 2) + "\n")
console.log("wrote", join(here, "results.json"))
