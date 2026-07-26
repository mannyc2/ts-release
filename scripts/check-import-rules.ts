import { existsSync, readFileSync } from "node:fs"
import { dirname, join, normalize } from "node:path"
import { collectTypeScriptFiles, makeDisplayPath } from "./lib/walk.js"
import { cwd, exit } from "node:process"
import * as ts from "typescript"

interface ImportReference {
  readonly file: string
  readonly specifier: string
  readonly typeOnly: boolean
  readonly position: number
}

interface AllowlistEntry {
  readonly file: string
  readonly specifier: string
  readonly typeOnly?: boolean | undefined
  readonly reason: string
}

const root = cwd()
const sourceRoot = join(root, "src")

const bareEffectScanRoots = [
  "src",
  "test",
  "scripts",
  "apps/release-ts/src",
  "apps/release-ts/scripts",
  "apps/release-ts/test",
  "apps/ts-release-action/src",
  "apps/ts-release-action/test"
]

const temporaryAllowlist: ReadonlyArray<AllowlistEntry> = []

const toDisplayPath = makeDisplayPath(root)

const location = (source: ts.SourceFile, position: number): string => {
  const line = source.getLineAndCharacterOfPosition(position)
  return `${toDisplayPath(source.fileName)}:${line.line + 1}:${line.character + 1}`
}

const namedBindingsTypeOnly = (bindings: ts.NamedImportBindings | undefined): boolean => {
  if (bindings === undefined) {
    return false
  }
  if (ts.isNamespaceImport(bindings)) {
    return false
  }
  return bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly)
}

const importDeclarationTypeOnly = (node: ts.ImportDeclaration): boolean => {
  const clause = node.importClause
  if (clause === undefined) {
    return false
  }
  return clause.isTypeOnly || namedBindingsTypeOnly(clause.namedBindings)
}

const collectImports = (file: string): Array<ImportReference> => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const imports: Array<ImportReference> = []

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({
        file,
        specifier: node.moduleSpecifier.text,
        typeOnly: importDeclarationTypeOnly(node),
        position: node.getStart(source)
      })
    }
    if (
      ts.isExportDeclaration(node)
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push({
        file,
        specifier: node.moduleSpecifier.text,
        typeOnly: node.isTypeOnly,
        position: node.getStart(source)
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return imports
}

const relativeTarget = (reference: ImportReference): string | undefined => {
  if (!reference.specifier.startsWith(".")) {
    return undefined
  }
  return toDisplayPath(normalize(join(dirname(reference.file), reference.specifier)))
}

const isEffectImport = (specifier: string): boolean =>
  specifier.startsWith("effect/")

const isNodeImport = (specifier: string): boolean =>
  specifier.startsWith("node:")

const allowlisted = (reference: ImportReference): boolean => {
  const file = toDisplayPath(reference.file)
  return temporaryAllowlist.some((entry) =>
    entry.file === file
    && entry.specifier === reference.specifier
    && (entry.typeOnly !== true || reference.typeOnly)
  )
}

const failure = (
  source: ts.SourceFile,
  reference: ImportReference,
  reason: string
): string =>
  `${location(source, reference.position)} imports ${JSON.stringify(reference.specifier)}: ${reason}`

const directoryDependencies: Readonly<Record<string, ReadonlyArray<string>>> = {
  grammar: ["grammar", "assets"],
  features: ["features", "grammar", "host"],
  config: ["config", "features", "grammar", "assets"],
  resolve: ["resolve", "config", "features", "grammar", "host"],
  pack: ["pack", "grammar", "host", "assets"],
  github: ["github", "grammar", "host"],
  run: ["run", "grammar", "host", "pack", "github"],
  engine: [
    "engine", "config", "resolve", "features", "grammar", "pack", "github",
    "run", "render", "doctor", "host", "assets"
  ],
  render: ["render", "grammar", "run", "pack"],
  doctor: ["doctor", "grammar", "host"],
  host: ["host", "grammar", "assets"],
  api: ["api", "engine", "pack", "github", "host"]
}

// Plan 153 Stage A: within features/, later phases may import earlier ones,
// never the reverse. build -> process -> catalog -> publish.
const featureFamilyRank: Readonly<Record<string, number>> = {
  build: 0,
  process: 1,
  catalog: 2,
  publish: 3
}

const featureFamily = (displayPath: string): string | undefined => {
  const parts = displayPath.split("/")
  return parts[0] === "src" && parts[1] === "features" ? parts[2] : undefined
}

const checkFeaturePhaseImport = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined => {
  const target = relativeTarget(reference)
  if (target === undefined) {
    return undefined
  }
  const from = featureFamily(toDisplayPath(reference.file))
  const to = featureFamily(target)
  if (from === undefined || to === undefined) {
    return undefined
  }
  const fromRank = featureFamilyRank[from]
  const toRank = featureFamilyRank[to]
  if (fromRank === undefined || toRank === undefined || toRank <= fromRank) {
    return undefined
  }
  return failure(
    source,
    reference,
    `features/${from}/ may not import the later phase features/${to}/ (build -> process -> catalog -> publish).`
  )
}

const sourceDirectory = (file: string): string | undefined => {
  const [rootDirectory, directory] = file.split("/")
  return rootDirectory === "src" && directory?.includes(".") === false ? directory : undefined
}

const targetDirectory = (target: string): string | undefined => {
  const [rootDirectory, directory] = target.split("/")
  return rootDirectory === "src" ? directory : undefined
}

const rewriteConcept = (path: string): string | undefined => {
  const parts = path.split("/")
  return parts[0] === "src" && parts[1] === "rewrite" ? parts[2] : undefined
}

const rewriteDependencies: Readonly<Record<string, ReadonlyArray<string>>> = {
  model: ["model"],
  recipes: ["recipes", "model"],
  config: ["config", "model", "recipes"],
  plan: ["plan", "model", "config", "recipes"]
}

const checkRewriteImport = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined => {
  const target = relativeTarget(reference)
  if (target === undefined) return undefined
  const from = rewriteConcept(toDisplayPath(reference.file))
  const to = rewriteConcept(target)
  if (from === undefined && to === undefined) return undefined
  if (from === undefined) {
    return failure(source, reference, "incumbent product code may not import the shadow candidate.")
  }
  if (to === undefined || !rewriteDependencies[from]?.includes(to)) {
    return failure(
      source,
      reference,
      `rewrite/${from}/ may import only ${rewriteDependencies[from]?.join(", ") ?? "its DAG dependencies"}.`
    )
  }
  return undefined
}

const checkConceptImport = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined => {
  if (rewriteConcept(toDisplayPath(reference.file)) !== undefined) return undefined
  if (isEffectImport(reference.specifier) || isNodeImport(reference.specifier) || allowlisted(reference)) {
    return undefined
  }
  const target = relativeTarget(reference)
  if (target === undefined) {
    return undefined
  }
  const directory = sourceDirectory(toDisplayPath(reference.file))
  const dependency = targetDirectory(target)
  if (directory === undefined || dependency === undefined) {
    return undefined
  }
  const allowed = directoryDependencies[directory]
  if (allowed === undefined || !allowed.includes(dependency)) {
    return failure(source, reference, `${directory}/ may import only ${allowed?.join(", ") ?? "its declared concept dependencies"}.`)
  }
  if (directory === "features" && dependency === "host" && !reference.typeOnly) {
    return failure(source, reference, "features/ may import host/ types only.")
  }
  if (directory === "render" && (dependency === "run" || dependency === "pack") && !reference.typeOnly) {
    return failure(source, reference, "render/ may import run/ and pack/ summary types only.")
  }
  return undefined
}

const checkReference = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined =>
  checkRewriteImport(source, reference) ??
  checkConceptImport(source, reference) ??
  checkFeaturePhaseImport(source, reference)

const checkFile = (file: string): Array<string> => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  return collectImports(file).flatMap((reference) => {
    const result = checkReference(source, reference)
    return result === undefined ? [] : [result]
  })
}

const checkBareEffectImports = (file: string): Array<string> => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  return collectImports(file).flatMap((reference) =>
    reference.specifier === "effect"
      ? [`${location(source, reference.position)} imports from broad "effect"; use effect/<Module>`]
      : []
  )
}

const hardCutScanFiles = [
  ...[
    "src",
    "scripts",
    "apps/release-ts/src",
    "apps/release-ts/scripts",
    "apps/ts-release-action/src"
  ].flatMap((directory) => {
    const path = join(root, directory)
    return existsSync(path) ? collectTypeScriptFiles(path) : []
  }),
  join(root, "apps/ts-release-action/action.yml")
].filter((file) => existsSync(file) && toDisplayPath(file) !== "scripts/check-import-rules.ts")

const hardCutTerms = [
  ["ReleaseState", "durable ReleaseState is forbidden after the v3 cut"],
  ["ArtifactCatalog", "Artifact is the sole artifact vocabulary"],
  ["ArtifactInventoryItem", "the projected artifact inventory is forbidden"],
  ["ReleasePlanDocument", "ReleasePlan is the sole plan type"],
  ["plan.state", "release-plan/v4 is flat"],
  ["release-plan/v3", "v3 plan readers and encoders are forbidden"], ["release-plan/v2", "v2 plan readers and encoders are forbidden"],
  [["target", "count"].join("_"), "the Action emits surface_count only"]
] as const

const hardCutViolations = (file: string): Array<string> => {
  const source = readFileSync(file, "utf8")
  return hardCutTerms.flatMap(([term, reason]) => {
    const position = source.indexOf(term)
    if (position < 0) {
      return []
    }
    const line = source.slice(0, position).split("\n").length
    return [`${toDisplayPath(file)}:${line}: ${reason}; found ${JSON.stringify(term)}`]
  })
}

const forbiddenCarrierFiles = [
  "src/grammar/catalog.ts",
  "src/engine/plan-document.ts"
]

const files = existsSync(sourceRoot) ? collectTypeScriptFiles(sourceRoot) : []
const bareEffectFiles = bareEffectScanRoots.flatMap((directory) => {
  const path = join(root, directory)
  return existsSync(path) ? collectTypeScriptFiles(path) : []
})
const failures = [
  ...files.flatMap(checkFile),
  ...bareEffectFiles.flatMap(checkBareEffectImports),
  ...hardCutScanFiles.flatMap(hardCutViolations),
  ...forbiddenCarrierFiles.flatMap((file) =>
    existsSync(join(root, file)) ? [`${file}: compatibility carrier file must be deleted`] : []
  )
]

if (failures.length > 0) {
  console.error("Import rule checks failed:")
  for (const item of failures) {
    console.error(`- ${item}`)
  }
  exit(1)
}
