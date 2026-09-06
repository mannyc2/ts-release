import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
export const dependencies = join(repository, "node_modules")
export const node = process.env.ARCHITECTURE_NODE_BINARY ?? "/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node"
if (execFileSync(node,["--version"],{encoding:"utf8"}).trim()!=="v22.22.2") throw Error("Architecture research requires admitted Node 22.22.2")
export const bun = process.execPath
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`

export function command(argv, cwd, options = {}) {
  return execFileSync(argv[0], argv.slice(1), {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, BUN_CONFIG_NO_CLEAR_TERMINAL: "1", NO_COLOR: "1" },
    ...options
  })
}

export async function files(root, prefix = "") {
  const out = []
  for (const entry of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...await files(root, path))
    else if (entry.isFile()) out.push(path)
    else throw new Error(`Non-regular package entry: ${path}`)
  }
  return out
}

export async function inventory(root) {
  return Promise.all((await files(root)).map(async (path) => {
    const bytes = await readFile(join(root, path))
    return { path, sha256: hash(bytes), bytes: bytes.length }
  }))
}

export async function pack(root, destination) {
  await mkdir(destination, { recursive: true })
  const before = new Set(await readdir(destination))
  command([bun, "pm", "pack", "--ignore-scripts", "--quiet", "--destination", destination], root)
  const created = (await readdir(destination)).filter((name) => !before.has(name) && name.endsWith(".tgz"))
  if (created.length !== 1) throw new Error(`Expected one tarball for ${root}: ${created.join(",")}`)
  const path = join(destination, created[0])
  const bytes = await readFile(path)
  return { path, bytes: bytes.length, sha256: hash(bytes), entries: command(["tar", "-tzf", path], root).trim().split("\n").sort() }
}

/** Package existing installed runtime dependencies; no registry/network access. */
export async function packRuntimeDependencies(destination, roots = ["effect"]) {
  const visited = new Map()
  async function visit(name, requester) {
    const require = createRequire(join(requester, "package.json"))
    let manifestPath
    try { manifestPath = require.resolve(`${name}/package.json`) }
    catch {
      let directory = dirname(require.resolve(name))
      while (true) {
        try {
          const document = JSON.parse(await readFile(join(directory, "package.json"), "utf8"))
          if (document.name === name) { manifestPath = join(directory, "package.json"); break }
        } catch {}
        const parent = dirname(directory)
        if (parent === directory) throw new Error(`Cannot find installed package ${name}`)
        directory = parent
      }
    }
    const root = await realpath(dirname(manifestPath))
    const document = JSON.parse(await readFile(join(root, "package.json"), "utf8"))
    if (visited.has(name)) {
      if (visited.get(name).version !== document.version) throw new Error(`Version skew for ${name}`)
      return
    }
    visited.set(name, { name, version: document.version, root, tarball: null })
    const requiredPeers=Object.keys(document.peerDependencies??{}).filter(name=>!document.peerDependenciesMeta?.[name]?.optional)
    for (const dependency of new Set([...Object.keys(document.dependencies ?? {}),...requiredPeers])) await visit(dependency, root)
    visited.get(name).tarball = await pack(root, destination)
  }
  for (const name of roots) await visit(name, join(repository, "tools/architecture-lab"))
  return [...visited.values()]
}

/** Bun installs actual tarballs into a fresh dependency graph, without symlinks. */
export async function install(root, packageTarballs, runtimePackages, directNames) {
  await mkdir(root, { recursive: true })
  const registry = []
  for (const entry of [...runtimePackages, ...packageTarballs]) {
    const manifest = JSON.parse(command(["tar", "-xOf", entry.tarball.path, "package/package.json"], root))
    registry.push({ name: manifest.name, version: manifest.version, path: entry.tarball.path, sha256: hash(await readFile(entry.tarball.path)), manifest })
  }
  const names = directNames ?? ["effect", ...packageTarballs.map(({ name }) => name)]
  const direct = !Array.isArray(names) ? names : Object.fromEntries(names.map((name) => {
    const found = registry.find((entry) => entry.name === name)
    if (found === undefined) throw new Error(`Missing install root ${name}`)
    return [name, found.version]
  }))
  await writeFile(join(root, "package.json"), json({ private: true, type: "module", dependencies: direct }))
  const registryInput = join(root, ".registry.json")
  await writeFile(registryInput, json(registry))
  const process = Bun.spawn([node, join(repository, "tools/architecture-lab/topology/registry.mjs"), registryInput], { stdout: "pipe", stderr: "pipe" })
  const reader = process.stdout.getReader()
  const first = await reader.read()
  if (first.done) throw new Error(`Local package registry did not start: ${await new Response(process.stderr).text()}`)
  const port = Number(new TextDecoder().decode(first.value).trim())
  if (!Number.isInteger(port) || port <= 0) throw new Error("Invalid registry port")
  const home = join(root, ".install-home")
  await mkdir(home)
  try {
    command([bun, "install", "--ignore-scripts", "--omit", "optional", "--registry", `http://127.0.0.1:${port}`, "--backend", "copyfile"], root, {
      env: { PATH: globalThis.process.env.PATH, HOME: home, TMPDIR: "/tmp", NO_COLOR: "1" }
    })
  } finally { process.kill(); await process.exited }
}
