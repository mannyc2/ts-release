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

const isUnder = (path: string, directory: string): boolean =>
  path === directory || path.startsWith(`${directory}/`)

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

const isIdentityCommandCapabilityImport = (reference: ImportReference): boolean => {
  const file = toDisplayPath(reference.file)
  const target = relativeTarget(reference)
  return isUnder(file, "src/pipeline/identity") && target === "src/host/host.js"
}

const checkPipelineImport = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined => {
  if (isEffectImport(reference.specifier)) {
    return undefined
  }
  if (allowlisted(reference)) {
    return undefined
  }
  if (isIdentityCommandCapabilityImport(reference)) {
    return undefined
  }
  const target = relativeTarget(reference)
  if (target !== undefined && (isUnder(target, "src/pipeline") || isUnder(target, "src/assets"))) {
    return undefined
  }
  return failure(source, reference, "pipeline/ may import only effect/*, pipeline-local modules, and data assets.")
}

const checkPipeImport = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined => {
  const target = relativeTarget(reference)
  if (target !== undefined && (isUnder(target, "src/engine") || isUnder(target, "src/host"))) {
    return failure(source, reference, "pipes/ must never import engine/ or host/.")
  }
  if (isEffectImport(reference.specifier)) {
    return undefined
  }
  if (allowlisted(reference)) {
    return undefined
  }
  if (target !== undefined && isUnder(target, "src/pipeline")) {
    return undefined
  }
  if (target !== undefined && isUnder(target, "src/pipes")) {
    return undefined
  }
  if (
    toDisplayPath(reference.file) === "src/pipes/build.ts" &&
    target !== undefined &&
    isUnder(target, "src/builders")
  ) {
    return undefined
  }
  return failure(source, reference, "pipes/ may import only effect/*, pipeline modules, pipe-local modules, and the build pipe's builder registry.")
}

const checkBuilderImport = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined => {
  const target = relativeTarget(reference)
  if (target !== undefined && (isUnder(target, "src/engine") || isUnder(target, "src/host"))) {
    return failure(source, reference, "builders/ must never import engine/ or host/.")
  }
  if (isEffectImport(reference.specifier)) {
    return undefined
  }
  if (allowlisted(reference)) {
    return undefined
  }
  if (target !== undefined && (isUnder(target, "src/pipeline") || isUnder(target, "src/builders"))) {
    return undefined
  }
  return failure(source, reference, "builders/ may import only effect/*, pipeline modules, and builder-local modules outside documented allowlist entries.")
}

const checkEngineImport = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined => {
  if (isEffectImport(reference.specifier) || isNodeImport(reference.specifier)) {
    return undefined
  }
  const target = relativeTarget(reference)
  const file = toDisplayPath(reference.file)
  if (
    target !== undefined
    && isUnder(target, "src/pipes")
    && (file === "src/engine/resolved-release.ts" || file === "src/engine/engine.ts")
  ) {
    return undefined
  }
  if (
    target !== undefined &&
    (
      isUnder(target, "src/engine") ||
      isUnder(target, "src/pipeline") ||
      isUnder(target, "src/host") ||
      isUnder(target, "src/config") ||
      isUnder(target, "src/internal") || isUnder(target, "src/assets")
    )
  ) {
    return undefined
  }
  return failure(
    source,
    reference,
    "engine/ may import only effect/*, node:*, engine-local modules, pipeline/, host/, config/, internal/, and data assets."
  )
}

const checkReference = (
  source: ts.SourceFile,
  reference: ImportReference
): string | undefined => {
  const file = toDisplayPath(reference.file)
  if (isUnder(file, "src/pipeline")) {
    return checkPipelineImport(source, reference)
  }
  if (isUnder(file, "src/pipes")) {
    return checkPipeImport(source, reference)
  }
  if (isUnder(file, "src/builders")) {
    return checkBuilderImport(source, reference)
  }
  if (isUnder(file, "src/engine")) {
    return checkEngineImport(source, reference)
  }
  return undefined
}

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
  ["plan.state", "release-plan/v3 is flat"],
  ["release-plan/v2", "v2 plan readers and encoders are forbidden"],
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
  "src/pipeline/catalog.ts",
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
