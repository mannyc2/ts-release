import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  writeFileSync
} from "node:fs"
import { dirname, join, posix, resolve } from "node:path"
import { exit } from "node:process"
import semver from "semver"
import { sha256Digest } from "../src/model/digest.js"
import { unsupportedExecutionHost } from "../src/platform/host-support.js"
import {
  makeSystemScratchDirectory,
  removeScratchDirectory
} from "./lib/scratch-workspace.js"

interface CommandResult {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

interface PackedFile {
  readonly path: string
  readonly size: number
}

interface PackResult {
  readonly filename: string
  readonly entryCount: number
  readonly size: number
  readonly unpackedSize: number
  readonly files: ReadonlyArray<PackedFile>
}

interface PackageManifest {
  readonly name: string
  readonly version: string
  readonly engines?: { readonly node?: string }
  readonly dependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>
  readonly devDependencies?: Readonly<Record<string, string>>
}

interface BunSmokeResult {
  readonly references: ReadonlyArray<string>
  readonly artifactCounts: ReadonlyArray<number>
  readonly publicationCounts: ReadonlyArray<number>
}

interface NodeSmokeResult {
  readonly artifactCounts: ReadonlyArray<number>
  readonly versions: Readonly<Record<string, string>>
  readonly node: string
}

const root = process.cwd()
const decoder = new TextDecoder()

const selectedNode = (): { readonly node: string, readonly npm: ReadonlyArray<string> } => {
  const node = process.env.TS_RELEASE_NODE_BIN ?? "node"
  const npmCli = process.env.TS_RELEASE_NPM_CLI
  if (npmCli !== undefined && process.env.TS_RELEASE_NODE_BIN === undefined) {
    throw new Error("TS_RELEASE_NPM_CLI requires TS_RELEASE_NODE_BIN so npm and Node use one selected runtime.")
  }
  return { node, npm: npmCli === undefined ? ["npm"] : [node, npmCli] }
}

const run = (
  argv: ReadonlyArray<string>,
  cwd: string,
  environment: Readonly<Record<string, string>> = {}
): CommandResult => {
  const result = Bun.spawnSync([...argv], {
    cwd,
    env: {
      ...process.env,
      CI: "true",
      NPM_CONFIG_UPDATE_NOTIFIER: "false",
      ...environment
    },
    stdout: "pipe",
    stderr: "pipe"
  })
  return {
    status: result.exitCode,
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr)
  }
}

const successful = (
  argv: ReadonlyArray<string>,
  cwd: string,
  environment: Readonly<Record<string, string>> = {}
): CommandResult => {
  const result = run(argv, cwd, environment)
  if (result.status !== 0) {
    throw new Error([
      `${argv.join(" ")} exited ${result.status}.`,
      result.stdout.trim(),
      result.stderr.trim()
    ].filter((line) => line.length > 0).join("\n"))
  }
  return result
}

const parseJson = <A>(value: string, label: string): A => {
  try {
    return JSON.parse(value) as A
  } catch (cause) {
    throw new Error(`${label} emitted invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

const readManifest = (path: string): PackageManifest => {
  const value = parseJson<Partial<PackageManifest>>(readFileSync(path, "utf8"), path)
  if (typeof value.name !== "string" || typeof value.version !== "string") {
    throw new Error(`${path} must name a package and version.`)
  }
  return value as PackageManifest
}

const peerWarning = /\bERESOLVE\b|incorrect peer dependency|could not resolve dependency|peer dependency/iu
const assertNoPeerWarnings = (result: CommandResult, label: string): void => {
  const output = `${result.stdout}\n${result.stderr}`
  if (peerWarning.test(output)) throw new Error(`${label} emitted a peer-resolution warning:\n${output.trim()}`)
}

const installedVersion = (consumer: string, packageName: string): string =>
  readManifest(join(consumer, "node_modules", ...packageName.split("/"), "package.json")).version

const assertAlignedEffect = (
  consumer: string,
  expected: string
): Readonly<Record<string, string>> => {
  const packages = [
    "effect",
    "@effect/platform-bun",
    "@effect/platform-node",
    "@effect/platform-node-shared"
  ] as const
  const versions = Object.fromEntries(packages.map((name) => [name, installedVersion(consumer, name)]))
  for (const [name, version] of Object.entries(versions)) {
    if (version !== expected) throw new Error(`${name} resolved to ${version}; expected ${expected}.`)
  }
  return versions
}

const dependencyDirectory = (from: string, packageName: string): string | undefined => {
  const parts = packageName.split("/")
  let directory = from
  while (true) {
    const candidate = join(directory, "node_modules", ...parts)
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate)
    const parent = dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}

const dependencyClosure = (
  projectRoot: string,
  manifest: PackageManifest
): ReadonlyArray<string> => {
  const found = new Map<string, string>()
  const pending: Array<{ readonly from: string, readonly name: string, readonly optional: boolean }> = []
  const enqueue = (
    from: string,
    dependencies: Readonly<Record<string, string>> | undefined,
    optional: boolean
  ): void => {
    for (const name of Object.keys(dependencies ?? {}).sort()) pending.push({ from, name, optional })
  }
  enqueue(projectRoot, manifest.dependencies, false)
  enqueue(projectRoot, manifest.optionalDependencies, true)
  enqueue(projectRoot, manifest.peerDependencies, false)

  while (pending.length > 0) {
    const current = pending.shift()!
    const directory = dependencyDirectory(current.from, current.name)
    if (directory === undefined) {
      if (current.optional) continue
      throw new Error(`Installed dependency closure omits ${current.name} required from ${current.from}.`)
    }
    if (found.has(directory)) continue
    found.set(directory, current.name)
    const dependency = readManifest(join(directory, "package.json"))
    enqueue(directory, dependency.dependencies, false)
    enqueue(directory, dependency.optionalDependencies, true)
    for (const name of Object.keys(dependency.peerDependencies ?? {}).sort()) {
      pending.push({
        from: directory,
        name,
        optional: dependency.peerDependenciesMeta?.[name]?.optional === true
      })
    }
  }
  return [...found.keys()].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

const auditPackedMarkdown = (
  packageRoot: string,
  files: ReadonlyArray<PackedFile>
): { readonly markdownFiles: number, readonly relativeLinks: number } => {
  const packed = new Set(files.map((file) => file.path))
  const markdown = files.map((file) => file.path).filter((path) => path.endsWith(".md"))
  const failures: Array<string> = []
  let relativeLinks = 0

  for (const file of markdown) {
    const contents = readFileSync(join(packageRoot, file), "utf8")
    for (const match of contents.matchAll(/\]\(([^)]+)\)/gu)) {
      const raw = match[1]?.trim() ?? ""
      const first = raw.startsWith("<")
        ? raw.slice(1, raw.indexOf(">"))
        : raw.split(/\s+/u)[0] ?? ""
      if (first.length === 0 || first.startsWith("#") || /^[A-Za-z][A-Za-z+.-]*:/u.test(first)) continue
      let decoded: string
      try {
        decoded = decodeURIComponent(first.split("#")[0]!.split("?")[0]!)
      } catch {
        failures.push(`${file} contains an invalid encoded link ${first}.`)
        continue
      }
      const target = posix.normalize(posix.join(posix.dirname(file), decoded))
      relativeLinks += 1
      if (target === ".." || target.startsWith("../") || target.startsWith("/")) {
        failures.push(`${file} link ${first} escapes the package.`)
      } else if (!packed.has(target) && !files.some((entry) => entry.path.startsWith(`${target.replace(/\/$/u, "")}/`))) {
        failures.push(`${file} link ${first} targets unpackaged ${target}.`)
      }
    }
  }

  if (failures.length > 0) throw new Error(`Packed Markdown audit failed:\n${failures.join("\n")}`)
  return { markdownFiles: markdown.length, relativeLinks }
}

const createWorkspace = (path: string, artifactCount: number): void => {
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, "package.json"), `${JSON.stringify({
    name: `packed-consumer-${artifactCount}`,
    version: "1.0.0",
    repository: "https://github.com/owner/packed-consumer.git"
  }, null, 2)}\n`)
  for (let index = 1; index <= artifactCount; index += 1) {
    writeFileSync(join(path, `payload-${index}.txt`), `packed consumer payload ${index}\n`)
  }
  successful(["git", "init", "--quiet"], path)
  successful(["git", "add", "--all"], path)
  successful([
    "git",
    "-c", "user.name=Packed Consumer Gate",
    "-c", "user.email=packed-consumer@example.test",
    "commit", "--quiet", "-m", "fixture"
  ], path)
}

const prepackedCandidates = [
  { id: "q-core", packageName: "effect-build" },
  { id: "a-bun", packageName: "effect-build-bun" },
  { id: "z-deno", packageName: "effect-build-deno" },
  { id: "b-esbuild", packageName: "effect-build-esbuild" },
  { id: "y-node-sea", packageName: "effect-build-node-sea" }
] as const

const createPrepackedWorkspace = (
  workspace: string,
  sources: string,
  npm: ReadonlyArray<string>,
  npmCache: string
): void => {
  mkdirSync(workspace, { recursive: true })
  mkdirSync(sources, { recursive: true })
  const destination = join(workspace, ".release", "candidate")
  mkdirSync(destination, { recursive: true })
  const subjects = prepackedCandidates.map(({ id, packageName }) => {
    const source = join(sources, id)
    mkdirSync(source, { recursive: true })
    writeFileSync(join(source, "package.json"), `${JSON.stringify({
      name: packageName,
      version: "0.3.0",
      type: "module",
      files: ["index.js"],
      ...(packageName === "effect-build" ? {} : { dependencies: { "effect-build": "0.3.0" } })
    }, null, 2)}\n`)
    writeFileSync(join(source, "index.js"), `export const packageName = ${JSON.stringify(packageName)}\n`)
    const result = successful([
      ...npm, "pack", source, "--json", "--ignore-scripts",
      "--pack-destination", destination, "--cache", npmCache
    ], workspace)
    const packed = parseJson<ReadonlyArray<PackResult>>(result.stdout, `${packageName} candidate pack`)
    if (packed.length !== 1 || packed[0] === undefined) throw new Error(`${packageName} candidate pack returned no tarball.`)
    const path = `.release/candidate/${packed[0].filename}`
    const bytes = new Uint8Array(readFileSync(join(workspace, path)))
    return {
      id,
      path,
      packageName,
      version: "0.3.0",
      sha256: sha256Digest(bytes).hex,
      registry: "https://registry.npmjs.org/",
      distTag: "latest",
      access: "public",
      authentication: { strategy: "token", credential: "NPM_TOKEN" },
      provenance: "disabled"
    }
  })
  writeFileSync(join(workspace, "package.json"), `${JSON.stringify({
    name: "effect-build",
    version: "0.3.0",
    repository: "https://github.com/owner/packed-consumer.git"
  }, null, 2)}\n`)
  writeFileSync(join(workspace, "release.config.json"), `${JSON.stringify({
    project: {
      name: "effect-build",
      version: "0.3.0",
      tag: "v0.3.0",
      repository: "owner/packed-consumer"
    },
    publish: {
      prepackedNpm: subjects,
      github: {
        repository: "owner/packed-consumer",
        tokenEnv: "GITHUB_TOKEN",
        draft: false,
        prerelease: false,
        ids: subjects.map(({ id }) => `prepacked-npm:${id}`)
      }
    }
  }, null, 2)}\n`)
  successful(["git", "init", "--quiet"], workspace)
  successful(["git", "add", "package.json", "release.config.json"], workspace)
  successful([
    "git",
    "-c", "user.name=Packed Consumer Gate",
    "-c", "user.email=packed-consumer@example.test",
    "commit", "--quiet", "-m", "prepacked fixture"
  ], workspace)
}

const bunSmokeSource = `
import {
  defineRelease,
  encodeCompletePreparedReleaseRef,
  makeReleaseApi
} from "@mannyc1/ts-release"
import { makeBunReleaseLayer } from "@mannyc1/ts-release/bun"
import { sha256Digest } from "@mannyc1/ts-release/host"
import { makeLocalPreparedReleaseStore } from "@mannyc1/ts-release/store"
import { join } from "node:path"

const [storeDirectory, ...workspaces] = Bun.argv.slice(2)
if (storeDirectory === undefined || workspaces.length !== 3) throw new Error("usage: smoke store one two prepacked")
const store = makeLocalPreparedReleaseStore(storeDirectory)
const api = makeReleaseApi(makeBunReleaseLayer(store))
try {
  const references = []
  const artifactCounts = []
  const publicationCounts = []
  for (const [index, workspace] of workspaces.slice(0, 2).entries()) {
    const count = index + 1
    const config = defineRelease({
      project: { repository: "owner/packed-consumer" },
      versionFrom: "manifest",
      artifacts: Array.from({ length: count }, (_, artifact) => ({
        id: \`payload-\${artifact + 1}\`,
        path: \`payload-\${artifact + 1}.txt\`,
        format: "file"
      }))
    })
    const inspection = await api.inspect({ config, workspace })
    if (!Array.isArray(inspection.artifacts) || inspection.artifacts.length !== count) {
      throw new Error(\`Bun inspection expected \${count} artifacts.\`)
    }
    const prepared = await api.prepare({ config, workspace })
    references.push(encodeCompletePreparedReleaseRef(prepared))
    artifactCounts.push(inspection.artifacts.length)
    publicationCounts.push(inspection.publications.length)
  }
  const prepackedWorkspace = workspaces[2]
  const prepackedConfig = await Bun.file(join(prepackedWorkspace, "release.config.json")).json()
  const prepackedInspection = await api.inspect({ config: prepackedConfig, workspace: prepackedWorkspace })
  if (prepackedInspection.artifacts.length !== 5 ||
      prepackedInspection.publications.map((publication) => publication.destination).join(",") !==
        "npm,npm,npm,npm,npm,github") {
    throw new Error("Bun inspection did not preserve five ordered npm subjects followed by GitHub.")
  }
  const prepacked = await api.prepare({ config: prepackedConfig, workspace: prepackedWorkspace })
  references.push(encodeCompletePreparedReleaseRef(prepacked))
  artifactCounts.push(prepackedInspection.artifacts.length)
  publicationCounts.push(prepackedInspection.publications.length)
  console.log(JSON.stringify({
    references,
    artifactCounts,
    publicationCounts,
    digest: sha256Digest(new TextEncoder().encode("packed-consumer")),
    storeMethods: [typeof store.commit, typeof store.load]
  }))
} finally {
  await api.dispose()
}
`

const nodeSmokeSource = `
import {
  decodeCompletePreparedReleaseRef,
  makeReleaseApi
} from "@mannyc1/ts-release"
import { makeNodeReleaseLayer } from "@mannyc1/ts-release/node"
import { sha256Digest } from "@mannyc1/ts-release/host"
import { makeLocalPreparedReleaseStore } from "@mannyc1/ts-release/store"
import * as Effect from "effect/Effect"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const [storeDirectory, expectedVersion, ...encoded] = process.argv.slice(2)
if (storeDirectory === undefined || expectedVersion === undefined || encoded.length !== 3) {
  throw new Error("usage: smoke store effect-version one two prepacked")
}
const root = dirname(fileURLToPath(import.meta.url))
const names = ["effect", "@effect/platform-bun", "@effect/platform-node", "@effect/platform-node-shared"]
const versions = Object.fromEntries(await Promise.all(names.map(async (name) => {
  const manifest = JSON.parse(await readFile(join(root, "node_modules", ...name.split("/"), "package.json"), "utf8"))
  if (manifest.version !== expectedVersion) throw new Error(\`\${name} resolved to \${manifest.version}.\`)
  return [name, manifest.version]
})))
const store = makeLocalPreparedReleaseStore(storeDirectory)
const api = makeReleaseApi(makeNodeReleaseLayer(store))
try {
  const artifactCounts = []
  for (const [index, value] of encoded.entries()) {
    const prepared = await Effect.runPromise(decodeCompletePreparedReleaseRef(value))
    const inspection = await api.inspect({ prepared })
    const expected = [1, 2, 5][index]
    if (!Array.isArray(inspection.artifacts) || inspection.artifacts.length !== expected) {
      throw new Error(\`Node inspection expected \${expected} artifacts.\`)
    }
    if (index === 2) {
      if (inspection.publications.map((publication) => publication.destination).join(",") !==
          "npm,npm,npm,npm,npm,github") {
        throw new Error("Node inspection did not preserve the ordered prepacked publication sequence.")
      }
      const loaded = await Effect.runPromise(store.load(prepared))
      if (loaded.manifest.provenance.execution.npmPack !== "not-used" || loaded.blobs.size !== 5) {
        throw new Error("Packed consumer reloaded a repacked or non-five-blob candidate.")
      }
    }
    artifactCounts.push(inspection.artifacts.length)
  }
  console.log(JSON.stringify({
    artifactCounts,
    versions,
    node: process.version,
    digest: sha256Digest(new TextEncoder().encode("packed-consumer")),
    storeMethods: [typeof store.commit, typeof store.load]
  }))
} finally {
  await api.dispose()
}
`

const main = async (): Promise<void> => {
  const scratch = await Effect.runPromise(
    makeSystemScratchDirectory("ts-release-packed-consumers-").pipe(
      Effect.provide(BunServices.layer)
    )
  )
  try {
    const manifest = readManifest(join(root, "package.json"))
    const selectedRuntime = selectedNode()
    const effectVersion = manifest.devDependencies?.effect
    if (effectVersion === undefined || !/^4\.0\.0-beta\.[0-9]+$/u.test(effectVersion)) {
      throw new Error("Root package must name one exact Effect beta dev dependency.")
    }
    const nodeRange = manifest.engines?.node
    if (nodeRange === undefined || semver.validRange(nodeRange) === null) {
      throw new Error("Root package must declare a valid Node engine range.")
    }

    const packageDirectory = join(scratch, "package")
    const npmCache = join(scratch, "npm-cache")
    const bunInstallDirectory = join(scratch, "bun-install")
    const bunTemporaryDirectory = join(scratch, "bun-tmp")
    const unpacked = join(scratch, "unpacked")
    mkdirSync(packageDirectory, { recursive: true })
    mkdirSync(npmCache, { recursive: true })
    mkdirSync(bunInstallDirectory, { recursive: true })
    mkdirSync(bunTemporaryDirectory, { recursive: true })
    mkdirSync(unpacked, { recursive: true })
    const bunEnvironment = {
      BUN_INSTALL: bunInstallDirectory,
      BUN_TMPDIR: bunTemporaryDirectory,
      TMPDIR: bunTemporaryDirectory
    }
    const packedCommand = successful([
      "npm", "pack", ".", "--json", "--ignore-scripts",
      "--pack-destination", packageDirectory,
      "--cache", npmCache
    ], root)
    const rows = parseJson<ReadonlyArray<PackResult>>(packedCommand.stdout, "npm pack")
    const packed = rows[0]
    if (packed === undefined || rows.length !== 1) throw new Error("npm pack must emit exactly one package result.")
    const tarball = resolve(packageDirectory, packed.filename)
    if (!existsSync(tarball)) throw new Error(`npm pack did not create ${tarball}.`)
    if (packed.entryCount !== packed.files.length) {
      throw new Error(`npm pack reported ${packed.entryCount} entries but listed ${packed.files.length}.`)
    }
    const packedPaths = new Set(packed.files.map((file) => file.path))
    for (const required of ["README.md", "SPEC.md", "ARCHITECTURE.md", "CHANGELOG.md", "LICENSE", "package.json"]) {
      if (!packedPaths.has(required)) throw new Error(`Packed package omits ${required}.`)
    }
    const environmentFiles = packed.files.filter((file) => /(^|\/)\.env(?:$|\.)/u.test(file.path))
    if (environmentFiles.length > 0) {
      throw new Error(`Packed package contains environment files: ${environmentFiles.map((file) => file.path).join(", ")}.`)
    }
    successful(["tar", "-xzf", tarball, "-C", unpacked], root)
    const markdown = auditPackedMarkdown(join(unpacked, "package"), packed.files)

    const dependencyTarballs = join(scratch, "dependency-tarballs")
    mkdirSync(dependencyTarballs, { recursive: true })
    const npmDependencies: Record<string, string> = { [manifest.name]: `file:${tarball}` }
    for (const directory of dependencyClosure(root, manifest)) {
      const dependency = readManifest(join(directory, "package.json"))
      if (dependency.name === manifest.name) continue
      const packedDependency = successful([
        "bun", "pm", "pack", "--ignore-scripts", "--quiet",
        "--destination", dependencyTarballs
      ], directory, bunEnvironment)
      const filename = packedDependency.stdout.trim().split(/\r?\n/u).at(-1)
      if (filename === undefined || !filename.endsWith(".tgz")) {
        throw new Error(
          `Dependency pack for ${dependency.name} returned an invalid filename: ${JSON.stringify(packedDependency.stdout)}.`
        )
      }
      const dependencyTarball = resolve(dependencyTarballs, filename)
      if (!existsSync(dependencyTarball)) throw new Error(`Dependency pack omitted ${dependencyTarball}.`)
      const previous = npmDependencies[dependency.name]
      if (previous !== undefined && previous !== `file:${dependencyTarball}`) {
        throw new Error(`Offline closure resolved more than one version of ${dependency.name}.`)
      }
      npmDependencies[dependency.name] = `file:${dependencyTarball}`
    }

    const bunConsumer = join(scratch, "bun-consumer")
    mkdirSync(bunConsumer, { recursive: true })
    writeFileSync(join(bunConsumer, "package.json"), `${JSON.stringify({
      name: "packed-bun-consumer",
      private: true,
      type: "module",
      dependencies: Object.fromEntries(Object.entries(npmDependencies).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)),
      overrides: Object.fromEntries(Object.entries(npmDependencies).filter(([name]) => name !== manifest.name)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
    }, null, 2)}\n`)
    const bunInstall = successful(
      ["bun", "install", "--offline", "--ignore-scripts", "--backend=copyfile"],
      bunConsumer,
      bunEnvironment
    )
    assertNoPeerWarnings(bunInstall, "Bun packed consumer install")
    const bunVersions = assertAlignedEffect(bunConsumer, effectVersion)

    const npmConsumer = join(scratch, "npm-consumer")
    mkdirSync(npmConsumer, { recursive: true })
    writeFileSync(join(npmConsumer, "package.json"), `${JSON.stringify({
      name: "packed-npm-consumer",
      private: true,
      type: "module",
      dependencies: Object.fromEntries(Object.entries(npmDependencies).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0))
    }, null, 2)}\n`)
    const npmInstall = successful([
      ...selectedRuntime.npm, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund",
      "--package-lock=false", "--cache", npmCache
    ], npmConsumer)
    assertNoPeerWarnings(npmInstall, "npm packed consumer install")
    successful([...selectedRuntime.npm, "ls", "--all", "--json"], npmConsumer, { NPM_CONFIG_CACHE: npmCache })
    const npmVersions = assertAlignedEffect(npmConsumer, effectVersion)

    const workspaceOne = join(scratch, "workspace-one")
    const workspaceTwo = join(scratch, "workspace-two")
    const prepackedWorkspace = join(scratch, "workspace-prepacked")
    createWorkspace(workspaceOne, 1)
    createWorkspace(workspaceTwo, 2)
    createPrepackedWorkspace(
      prepackedWorkspace,
      join(scratch, "prepacked-sources"),
      selectedRuntime.npm,
      npmCache
    )
    const storeDirectory = join(scratch, "prepared-store")
    writeFileSync(join(bunConsumer, "smoke.ts"), bunSmokeSource)
    const bunSmokeCommand = successful([
      "bun", "run", "smoke.ts", storeDirectory, workspaceOne, workspaceTwo, prepackedWorkspace
    ], bunConsumer, bunEnvironment)
    const bunSmoke = parseJson<BunSmokeResult>(bunSmokeCommand.stdout.trim(), "Bun consumer smoke")
    if (bunSmoke.references.length !== 3 || bunSmoke.artifactCounts.join(",") !== "1,2,5" ||
        bunSmoke.publicationCounts.join(",") !== "0,0,6") {
      throw new Error("Bun consumer did not prepare ordinary and five-subject prepacked bundles.")
    }

    writeFileSync(join(npmConsumer, "smoke.mjs"), nodeSmokeSource)
    const nodeSmokeCommand = successful([
      selectedRuntime.node, "smoke.mjs", storeDirectory, effectVersion, ...bunSmoke.references
    ], npmConsumer)
    const nodeSmoke = parseJson<NodeSmokeResult>(nodeSmokeCommand.stdout.trim(), "Node consumer smoke")
    if (nodeSmoke.artifactCounts.join(",") !== "1,2,5") {
      throw new Error("Node consumer did not load ordinary and five-subject prepacked bundles.")
    }

    const cli = join(npmConsumer, "node_modules", ...manifest.name.split("/"), "dist", "bin", "ts-release.js")
    const unsupportedHost = unsupportedExecutionHost(process.platform)
    const expectedArtifactCounts = [1, 2, 5]
    for (const [index, reference] of bunSmoke.references.entries()) {
      const inspected = run([
        selectedRuntime.node, cli, "--store", storeDirectory, "inspect", reference
      ], npmConsumer)
      if (unsupportedHost !== undefined) {
        if (inspected.status === 0 || !inspected.stderr.includes(unsupportedHost)) {
          throw new Error([
            `Packed CLI must refuse unsupported ${process.platform} execution with the canonical diagnostic.`,
            inspected.stdout.trim(),
            inspected.stderr.trim()
          ].filter((line) => line.length > 0).join("\n"))
        }
        continue
      }
      if (inspected.status !== 0) {
        throw new Error([
          `${selectedRuntime.node} ${cli} inspect exited ${inspected.status}.`,
          inspected.stdout.trim(),
          inspected.stderr.trim()
        ].filter((line) => line.length > 0).join("\n"))
      }
      const value = parseJson<{ readonly artifacts?: unknown }>(inspected.stdout.trim(), "packed CLI inspect")
      if (!Array.isArray(value.artifacts) || value.artifacts.length !== expectedArtifactCounts[index]) {
        throw new Error(`Packed CLI must preserve the ${expectedArtifactCounts[index]}-element artifacts array.`)
      }
    }

    if (unsupportedHost === undefined) {
      const sentinelDirectory = join(scratch, "no-repack-bin")
      mkdirSync(sentinelDirectory, { recursive: true })
      const sentinel = join(sentinelDirectory, "npm")
      writeFileSync(sentinel, "#!/bin/sh\necho 'prepacked CLI attempted npm' >&2\nexit 91\n")
      chmodSync(sentinel, 0o755)
      const cliStore = join(scratch, "prepacked-cli-store")
      const prepared = successful([
        selectedRuntime.node, cli,
        "prepare", "--config", "release.config.json", "--root", ".", "--store", cliStore
      ], prepackedWorkspace, {
        PATH: `${sentinelDirectory}:${process.env.PATH ?? ""}`
      }).stdout.trim()
      if (!/^prepared:local:sha256-[a-f0-9]{64}$/u.test(prepared)) {
        throw new Error("Packed CLI did not emit one complete prepacked prepared reference.")
      }
      const inspected = successful([
        selectedRuntime.node, cli, "inspect", prepared, "--store", cliStore
      ], prepackedWorkspace)
      const inspection = parseJson<{
        readonly artifacts?: unknown
        readonly publications?: ReadonlyArray<{ readonly destination?: unknown }>
      }>(inspected.stdout.trim(), "prepacked CLI inspect")
      if (!Array.isArray(inspection.artifacts) || inspection.artifacts.length !== 5 ||
          inspection.publications?.map((publication) => publication.destination).join(",") !==
            "npm,npm,npm,npm,npm,github") {
        throw new Error("Packed CLI did not reload five exact npm subjects followed by GitHub.")
      }
    }

    const nodeRuntimeSupported = semver.satisfies(nodeSmoke.node, nodeRange)
    const npmOutput = `${npmInstall.stdout}\n${npmInstall.stderr}`
    if (!nodeRuntimeSupported) {
      throw new Error(`Packed Node consumer ${nodeSmoke.node} is outside the declared engine ${nodeRange}.`)
    }
    if (/\bEBADENGINE\b/u.test(npmOutput)) {
      throw new Error(`npm emitted EBADENGINE under supported Node ${nodeSmoke.node}.`)
    }
    console.log(JSON.stringify({
      schemaVersion: "packed-consumer-report/v1",
      package: `${manifest.name}@${manifest.version}`,
      files: packed.entryCount,
      compressedBytes: packed.size,
      unpackedBytes: packed.unpackedSize,
      markdownFiles: markdown.markdownFiles,
      relativeLinks: markdown.relativeLinks,
      effectVersions: { bun: bunVersions, npm: npmVersions },
      artifactArrayShapes: [1, 2, 5],
      prepackedPublicationOrder: ["npm", "npm", "npm", "npm", "npm", "github"],
      prepackedNpmPack: "not-used",
      node: nodeSmoke.node,
      nodeRuntimeSupported,
      cliHostSupported: unsupportedHost === undefined,
      status: "current-worktree-only"
    }))
  } finally {
    await Effect.runPromise(
      removeScratchDirectory(scratch, {
        expectedParent: dirname(scratch),
        allowedPrefixes: ["ts-release-packed-consumers-"]
      }).pipe(Effect.provide(BunServices.layer))
    )
  }
}

try {
  await main()
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
