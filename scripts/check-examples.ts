#!/usr/bin/env bun

import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { tmpdir } from "node:os"
import { makeReleaseApi } from "../src/api/api.js"
import { SafeRelativePath } from "../src/model/primitives.js"
import { compileReleaseGraph } from "../src/release/compiler.js"
import { makeLocalPreparedReleaseStore } from "../src/release/prepared-store.js"
import { AuthoredConfig } from "../src/resolve/authored.js"
import { ObservedFacts } from "../src/resolve/facts.js"
import { resolveConfig } from "../src/resolve/resolve.js"
import { commandNames } from "../apps/release-ts/src/cli/commands.js"
import {
  deterministicExampleContext,
  makeDefaultReleaseExampleTestLayer
} from "./lib/release-example-test-layer.js"

const root = process.cwd()
const packageVersion = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: unknown }).version
if (typeof packageVersion !== "string" || packageVersion.length === 0) throw new Error("package.json version is required.")
const candidateActionReference = `mannyc2/ts-release/apps/ts-release-action@v${packageVersion}`
const configs: string[] = []
const walk = (directory: string): void => {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.isFile() && /^(?:reviewed-)?release\.config\.json$/u.test(entry.name)) configs.push(path)
  }
}
walk(resolve(root, "examples"))
walk(resolve(root, "templates"))

type GraphSubject = "GraphGitHubPublication" | "GraphNpmPublication"
type PreparedSubject = "PreparedGitHubPublication" | "PreparedNpmPublication"

interface ExpectedPublicConfig {
  readonly graph: ReadonlyArray<GraphSubject>
  readonly prepared: ReadonlyArray<PreparedSubject>
  readonly targets: ReadonlyArray<string>
}

const fourPortableTargets = [
  "cli-darwin-arm64",
  "cli-darwin-x64",
  "cli-linux-arm64",
  "cli-linux-x64"
] as const

const expectedConfigs: Readonly<Record<string, ExpectedPublicConfig>> = {
  "examples/github-release/release.config.json": {
    graph: ["GraphGitHubPublication"],
    prepared: ["PreparedGitHubPublication"],
    targets: []
  },
  "examples/multi-target/release.config.json": {
    graph: ["GraphGitHubPublication", "GraphNpmPublication"],
    prepared: ["PreparedGitHubPublication", "PreparedNpmPublication"],
    targets: []
  },
  "examples/npm-first-publish/release.config.json": {
    graph: ["GraphNpmPublication"],
    prepared: ["PreparedNpmPublication"],
    targets: []
  },
  "examples/npm-only/release.config.json": {
    graph: ["GraphNpmPublication"],
    prepared: ["PreparedNpmPublication"],
    targets: []
  },
  "examples/portable-cli/release.config.json": {
    graph: ["GraphGitHubPublication", "GraphNpmPublication"],
    prepared: ["PreparedGitHubPublication", "PreparedNpmPublication"],
    targets: fourPortableTargets
  },
  "templates/bun-cli-github/release.config.json": {
    graph: ["GraphGitHubPublication", "GraphNpmPublication"],
    prepared: ["PreparedGitHubPublication", "PreparedNpmPublication"],
    targets: fourPortableTargets
  },
  "templates/npm-github/release.config.json": {
    graph: ["GraphGitHubPublication", "GraphNpmPublication"],
    prepared: ["PreparedGitHubPublication", "PreparedNpmPublication"],
    targets: []
  },
  "templates/npm-github/reviewed-release.config.json": {
    graph: ["GraphGitHubPublication", "GraphNpmPublication"],
    prepared: ["PreparedGitHubPublication", "PreparedNpmPublication"],
    targets: []
  },
  "templates/npm-only/release.config.json": {
    graph: ["GraphNpmPublication"],
    prepared: ["PreparedNpmPublication"],
    targets: []
  },
  "templates/portable-cli/release.config.json": {
    graph: ["GraphGitHubPublication", "GraphNpmPublication"],
    prepared: ["PreparedGitHubPublication", "PreparedNpmPublication"],
    targets: fourPortableTargets
  }
}

const codepoint = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0
const portable = (path: string): string => relative(root, path).replaceAll("\\", "/")
const same = (actual: ReadonlyArray<string>, expected: ReadonlyArray<string>, label: string): void => {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label}: got [${actual.join(", ")}], expected [${expected.join(", ")}].`)
  }
}
const object = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}
const write = (workspace: string, path: string, contents: string, executable = false): void => {
  const target = join(workspace, path)
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
  writeFileSync(target, contents, { mode: executable ? 0o755 : 0o644 })
  if (executable) chmodSync(target, 0o755)
}

const discovered = configs.map(portable).sort(codepoint)
same(discovered, Object.keys(expectedConfigs).sort(codepoint), "Retained public config inventory")

let resolvedCount = 0
let compiledCount = 0
let preparedCount = 0
const graphSubjects: Record<GraphSubject, number> = {
  GraphGitHubPublication: 0,
  GraphNpmPublication: 0
}
const preparedSubjects: Record<PreparedSubject, number> = {
  PreparedGitHubPublication: 0,
  PreparedNpmPublication: 0
}
let targetArtifactCount = 0

for (const path of configs.sort((left, right) => codepoint(portable(left), portable(right)))) {
  const name = portable(path)
  const expected = expectedConfigs[name]!
  const value: unknown = JSON.parse(readFileSync(path, "utf8"))
  let authored: AuthoredConfig
  try {
    authored = Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })(value)
  } catch (cause) {
    throw new Error(`${path}: authored configuration is invalid: ${String(cause)}`)
  }

  const scratch = mkdtempSync(join(tmpdir(), "ts-release-public-example-"))
  try {
    const workspace = join(scratch, "workspace")
    const store = makeLocalPreparedReleaseStore(join(scratch, "prepared-store"))
    mkdirSync(workspace, { recursive: true, mode: 0o700 })
    const packageDirectory = authored.npmPackage?.path?.toString() ?? "."
    const packageManifestPath = SafeRelativePath.make(packageDirectory === "." ? "package.json" : `${packageDirectory}/package.json`)
    const packageName = authored.project.packageName?.toString() ?? authored.project.name?.toString()
    const packageVersion = authored.project.version?.toString()
    if (packageName === undefined || packageVersion === undefined) throw new Error(`${name}: explicit project name and version are required.`)
    write(workspace, packageManifestPath.toString(), `${JSON.stringify({
      name: packageName,
      version: packageVersion,
      ...(authored.project.repository === undefined ? {} : { repository: authored.project.repository.toString() })
    })}\n`)
    write(workspace, "bun.lock", "# deterministic example lock\n")
    for (const artifact of authored.artifacts ?? []) {
      write(workspace, artifact.path.toString(), `fixture bytes for ${artifact.id}\n`, artifact.format === "executable")
    }
    for (const build of authored.builds ?? []) {
      if (build.builder === "bun") write(workspace, build.entry.toString(), "console.log('fixture')\n")
    }

    const context = deterministicExampleContext(workspace, packageManifestPath)
    const facts = ObservedFacts.make({
      commit: context.source.commit,
      manifestName: context.package.name,
      manifestVersion: context.package.version,
      ...(context.source.repository === undefined ? {} : { repository: context.source.repository })
    })
    const resolved = resolveConfig(value, facts)
    resolvedCount += 1
    const graph = compileReleaseGraph(resolved, context)
    compiledCount += 1
    same(graph.publications.map((publication) => publication._tag), expected.graph, `${name} graph subjects`)
    for (const publication of graph.publications) graphSubjects[publication._tag] += 1
    const targetIds = graph.artifacts.map((artifact) => artifact.id.toString())
      .filter((id) => /^cli-(?:linux|darwin|windows)-/u.test(id)).sort(codepoint)
    same(targetIds, [...expected.targets].sort(codepoint), `${name} target artifacts`)
    targetArtifactCount += targetIds.length

    const api = makeReleaseApi(makeDefaultReleaseExampleTestLayer(store))
    try {
      const inspection = await api.inspect({ config: value, workspace })
      if (!("preparations" in inspection)) throw new Error(`${name}: root inspect did not return the graph projection.`)
      const expectedDestinations = expected.graph.map((subject) =>
        subject === "GraphGitHubPublication" ? "github" : "npm")
      same(inspection.publications.map((publication) => publication.destination), expectedDestinations, `${name} root graph subjects`)

      const prepared = await api.prepare({ config: value, workspace })
      const bundle = await Effect.runPromise(store.load(prepared))
      same(bundle.manifest.publications.map((publication) => publication._tag), expected.prepared, `${name} durable prepared subjects`)
      for (const publication of bundle.manifest.publications) preparedSubjects[publication._tag] += 1
      const preparedInspection = await api.inspect({ prepared })
      if (!("project" in preparedInspection)) throw new Error(`${name}: prepared inspect did not return the durable projection.`)
      same(preparedInspection.publications.map((publication) => publication.destination), expectedDestinations, `${name} root prepared subjects`)
      preparedCount += 1
    } finally {
      await api.dispose()
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

const unsupportedBase = {
  project: { name: "unsupported-fixture", version: "1.0.0", tag: "v1.0.0" }
}
const unsupported = [
  {
    family: "PyPI",
    field: '["publish"]["pypi"]',
    value: { ...unsupportedBase, publish: { pypi: { repository: "https://upload.pypi.org/legacy/" } } },
    notes: [{ path: "examples/pypi-registry/README.md", snippets: ["not a runnable ts-release example", "no PyPI publication destination", "no `release.config.json`"] }],
    directories: ["examples/pypi-registry"]
  },
  {
    family: "Homebrew",
    field: '["publish"]["homebrew"]',
    value: { ...unsupportedBase, publish: { homebrew: { repository: "owner/homebrew-tap" } } },
    notes: [
      { path: "examples/homebrew-tap/README.md", snippets: ["not a runnable ts-release example", "no Homebrew or generic catalog destination"] },
      { path: "templates/multi-target-homebrew/README.md", snippets: ["no runnable Homebrew template", "generic catalog destinations are absent"] }
    ],
    directories: ["examples/homebrew-tap", "templates/multi-target-homebrew"]
  },
  {
    family: "Scoop",
    field: '["publish"]["scoop"]',
    value: { ...unsupportedBase, publish: { scoop: { repository: "owner/scoop-bucket" } } },
    notes: [
      { path: "examples/scoop-bucket/README.md", snippets: ["not a runnable ts-release example", "no Scoop or generic catalog destination"] },
      { path: "templates/multi-target-scoop/README.md", snippets: ["no runnable Scoop template", "generic catalog destinations are absent"] }
    ],
    directories: ["examples/scoop-bucket", "templates/multi-target-scoop"]
  },
  {
    family: "catalog",
    field: '["catalogs"]',
    value: { ...unsupportedBase, catalogs: [{ id: "catalog", repository: "owner/catalog", file: "fixture.json" }] },
    notes: [
      { path: "examples/homebrew-tap/README.md", snippets: ["generic catalog destination", "removed instead of being retained as an accepted no-op"] },
      { path: "templates/multi-target-homebrew/README.md", snippets: ["generic catalog destinations are absent", "provider-owned implementation"] }
    ],
    directories: []
  }
] as const

for (const item of unsupported) {
  try {
    Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })(item.value)
    throw new Error(`${item.family}: unsupported authored form unexpectedly decoded.`)
  } catch (cause) {
    const message = String(cause)
    if (!message.includes(item.field)) throw new Error(`${item.family}: refusal did not name ${item.field}: ${message}`)
  }
  for (const note of item.notes) {
    const text = readFileSync(join(root, note.path), "utf8")
    for (const snippet of note.snippets) if (!text.toLocaleLowerCase("en-US").includes(snippet.toLocaleLowerCase("en-US"))) {
      throw new Error(`${item.family}: migration note ${note.path} is missing ${JSON.stringify(snippet)}.`)
    }
  }
  for (const directory of item.directories) if (existsSync(join(root, directory, "release.config.json"))) {
    throw new Error(`${item.family}: migration-only directory ${directory} contains a runnable release.config.json.`)
  }
}

const workflowRoot = resolve(root, "templates", "github-actions")
const workflows = existsSync(workflowRoot)
  ? readdirSync(workflowRoot).filter((name) => /\.ya?ml$/u.test(name))
  : []
for (const name of workflows) {
  const text = readFileSync(join(workflowRoot, name), "utf8")
  if (/\bcommand:\s*(?:plan|apply|doctor|build|verify)\b/u.test(text)) {
    throw new Error(`${name}: workflow uses a removed lifecycle command.`)
  }
  if (text.includes("mannyc2/ts-release/apps/ts-release-action@") && !text.includes(candidateActionReference)) {
    throw new Error(`${name}: Action reference must use the candidate-bound ${candidateActionReference}.`)
  }
  if (text.includes("__TS_RELEASE_ACTION_REF__")) throw new Error(`${name}: Action reference retains the candidate placeholder.`)
  if (/mannyc2\/ts-release-action@/u.test(text)) {
    throw new Error(`${name}: Action reference uses the retired standalone mirror.`)
  }
}

console.log(JSON.stringify({
  schemaVersion: "release-examples-report/v2",
  examples: configs.filter((path) => path.includes("/examples/")).length,
  templates: configs.filter((path) => path.includes("/templates/")).length,
  resolved: resolvedCount,
  compiled: compiledCount,
  prepared: preparedCount,
  graphSubjects,
  preparedSubjects,
  targetArtifacts: targetArtifactCount,
  unsupportedMigrations: unsupported.length,
  workflows: workflows.length,
  commands: commandNames,
  status: "public-verticals-verified"
}))
