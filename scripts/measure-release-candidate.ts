import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { extname, join, relative } from "node:path"
import * as Schema from "effect/Schema"
import { capabilityModules } from "../src/capabilities/registry.js"
import { CandidateConfig } from "../src/recipes/config.js"
import { AuthoredConfig } from "../src/resolve/authored.js"

type JsonObject = Readonly<Record<string, unknown>>

const root = process.cwd()
const object = (value: unknown): JsonObject | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : undefined
const objects = (value: unknown): ReadonlyArray<JsonObject> =>
  Array.isArray(value)
    ? value.map(object).filter((item): item is JsonObject => item !== undefined)
    : []

const filesBelow = (directory: string, extension?: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) return []
  const files: Array<string> = []
  const visit = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile() && (extension === undefined || extname(entry.name) === extension)) files.push(child)
    }
  }
  visit(directory)
  return files.sort()
}

const lineCount = (path: string): number => {
  const text = readFileSync(path, "utf8")
  if (text.length === 0) return 0
  const newlines = text.match(/\n/gu)?.length ?? 0
  return newlines + (text.endsWith("\n") ? 0 : 1)
}
const lineCountAll = (paths: ReadonlyArray<string>): number =>
  paths.reduce((total, path) => total + lineCount(path), 0)
const digest = (values: ReadonlyArray<string>): string =>
  createHash("sha256").update(`${values.join("\n")}\n`).digest("hex")

const schemaPropertyPaths = (schema: Schema.Top): ReadonlyArray<string> => {
  const document = Schema.toJsonSchemaDocument(schema)
  const definitions = document.definitions as Readonly<Record<string, unknown>>
  const paths = new Set<string>()
  const visit = (value: unknown, path: string, references: ReadonlySet<string>): void => {
    const node = object(value)
    if (node === undefined) return
    if (typeof node.$ref === "string" && node.$ref.startsWith("#/$defs/")) {
      const name = node.$ref.slice("#/$defs/".length)
      if (!references.has(name)) visit(definitions[name], path, new Set([...references, name]))
    }
    const properties = object(node.properties)
    if (properties !== undefined) {
      for (const name of Object.keys(properties).sort()) {
        const child = path.length === 0 ? name : `${path}.${name}`
        paths.add(child)
        visit(properties[name], child, references)
      }
    }
    if (node.items !== undefined) visit(node.items, `${path}[]`, references)
    for (const key of ["anyOf", "oneOf", "allOf"] as const) {
      for (const alternative of objects(node[key])) visit(alternative, path, references)
    }
  }
  visit(document.schema, "", new Set())
  return [...paths].sort()
}

const productFiles = filesBelow(join(root, "src"), ".ts")
const appSourceFiles = readdirSync(join(root, "apps"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => filesBelow(join(root, "apps", entry.name, "src"), ".ts"))
  .sort()
const appGateFiles = filesBelow(join(root, "apps", "release-ts", "scripts"), ".ts")
const testFiles = [
  ...filesBelow(join(root, "test"), ".ts"),
  ...readdirSync(join(root, "apps"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => filesBelow(join(root, "apps", entry.name, "test"), ".ts"))
].sort()

const workflowFiles = [
  ...filesBelow(join(root, ".github", "workflows")),
  ...filesBelow(join(root, "templates", "github-actions"))
].filter((path) => /\.ya?ml$/u.test(path)).sort()
const workflowRows = workflowFiles.map((path) => {
  const parsed = object(Bun.YAML.parse(readFileSync(path, "utf8")))
  const jobs = object(parsed?.jobs)
  if (parsed === undefined || jobs === undefined) throw new Error(`${relative(root, path)} has no YAML jobs object.`)
  return { path: relative(root, path), lines: lineCount(path), jobs: Object.keys(jobs).length }
})

const actionPath = join(root, "apps", "ts-release-action", "action.yml")
const action = object(Bun.YAML.parse(readFileSync(actionPath, "utf8")))
const actionInputs = Object.keys(object(action?.inputs) ?? {}).sort()
const actionOutputs = Object.keys(object(action?.outputs) ?? {}).sort()

const authoredPaths = schemaPropertyPaths(AuthoredConfig)
const resolvedPaths = schemaPropertyPaths(CandidateConfig)
const evidence = JSON.parse(readFileSync(join(root, "docs", "capability-evidence.json"), "utf8")) as {
  readonly records: ReadonlyArray<{ readonly evidenceClass: string }>
}
const evidenceClasses = Object.fromEntries(
  [...new Set(evidence.records.map((record) => record.evidenceClass))].sort().map((kind) => [
    kind,
    evidence.records.filter((record) => record.evidenceClass === kind).length
  ])
)

const architecture = readFileSync(join(root, "ARCHITECTURE.md"), "utf8")
const ownershipSection = architecture.split("## Preparation")[0]?.split("## Ownership")[1] ?? ""
const canonicalOwners = [...ownershipSection.matchAll(/^- `([^`]+)` /gmu)].map((match) => match[1]!).sort()
const readme = readFileSync(join(root, "README.md"), "utf8")
const extensionSection = readme.split("## Library API")[0]?.split("## Extension jobs and exclusions")[1] ?? ""
const extensionOwners = extensionSection.split("\n")
  .filter((line) => line.startsWith("|") && line.endsWith("|"))
  .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()))
  .filter((cells) => cells.length === 2 && cells[0] !== "User job" && !/^---/u.test(cells[0]!))
  .map(([job, owner]) => ({ job: job!, owner: owner! }))

const publicCurrentFiles = [
  "README.md", "SPEC.md", "ARCHITECTURE.md", "package.json",
  "apps/release-ts/README.md", "apps/ts-release-action/README.md",
  "examples/README.md", "templates/README.md", "docs/capabilities.md",
  "docs/comparison.md", "docs/preparation.md", "docs/recovery.md",
  "docs/skill-distribution.md"
]
const retiredPatterns = {
  shipCommand: /\bts-release\s+ship\b|\bcommand:\s*ship\b/giu,
  oneShotCommand: /\bself:one-shot\b/giu,
  internalAuthorityIds: /\b(?:planId|reviewId|permitId|receiptId)\b/gu,
  standaloneActionMirror: /mannyc2\/ts-release-action@/gu,
  oldPositioning: /GoReleaser for TypeScript/giu
} as const
const retiredVocabulary = Object.fromEntries(Object.entries(retiredPatterns).map(([name, pattern]) => [
  name,
  publicCurrentFiles.flatMap((path) => {
    const text = readFileSync(join(root, path), "utf8")
    return [...text.matchAll(pattern)].map((match) => `${path}:${text.slice(0, match.index).split("\n").length}`)
  })
]))
const retiredCount = Object.values(retiredVocabulary).reduce((total, rows) => total + rows.length, 0)

const declaredTests = testFiles.reduce((total, path) =>
  total + ([...readFileSync(path, "utf8").matchAll(/\b(?:test|it)\s*\(/gu)].length), 0)
const unsupportedFamilies = [
  "adapter.dynamic-config", "build.pypi-wrapper-wheel", "host.windows",
  "prepare.merge", "prepare.partition"
] as const
const installedIds = capabilityModules.map((module) => module.id).sort()
for (const family of unsupportedFamilies) {
  if ((installedIds as ReadonlyArray<string>).includes(family)) throw new Error(`${family} is both unsupported and installed.`)
}
if (retiredCount > 0) {
  throw new Error(`Current public surfaces retain ${retiredCount} retired-vocabulary occurrence(s): ${JSON.stringify(retiredVocabulary)}`)
}

console.log(JSON.stringify({
  schemaVersion: "release-candidate-source-measurements/v1",
  source: {
    product: { files: productFiles.length, lines: lineCountAll(productFiles) },
    apps: { files: appSourceFiles.length, lines: lineCountAll(appSourceFiles) },
    selfReleaseGates: { files: appGateFiles.length, lines: lineCountAll(appGateFiles) },
    tests: { files: testFiles.length, lines: lineCountAll(testFiles), declaredCases: declaredTests }
  },
  workflows: {
    files: workflowRows.length,
    lines: workflowRows.reduce((total, row) => total + row.lines, 0),
    jobs: workflowRows.reduce((total, row) => total + row.jobs, 0),
    entries: workflowRows
  },
  publicDocs: {
    readmeLines: lineCount(join(root, "README.md")),
    changelogLines: lineCount(join(root, "CHANGELOG.md"))
  },
  action: { inputs: actionInputs, outputs: actionOutputs },
  configPaths: {
    authored: { count: authoredPaths.length, sha256: digest(authoredPaths) },
    resolved: { count: resolvedPaths.length, sha256: digest(resolvedPaths) }
  },
  capabilities: {
    installed: installedIds,
    unsupported: unsupportedFamilies,
    evidenceClasses
  },
  orchestrationOwners: { canonical: canonicalOwners, extensions: extensionOwners },
  retiredVocabulary,
  evidenceBoundary: "source-derived; executable test results are recorded separately"
}, null, 2))
