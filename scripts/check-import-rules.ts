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
  const target = relativeTarget(reference)
  if (target !== undefined && isUnder(target, "src/pipeline")) {
    return undefined
  }
  if (toDisplayPath(reference.file) === "src/pipeline/pipeline.ts" && target !== undefined && isUnder(target, "src/pipes")) {
    return undefined
  }
  if (
    reference.typeOnly
    && (toDisplayPath(reference.file) === "src/pipeline/pipe.ts" || toDisplayPath(reference.file) === "src/pipeline/runner.ts")
    && reference.specifier === "../config/schema.js"
  ) {
    return undefined
  }
  return failure(source, reference, "pipeline/ may import only effect/*, pipeline-local modules, and the static pipe registry.")
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
  if (
    target !== undefined &&
    (
      isUnder(target, "src/engine") ||
      isUnder(target, "src/pipeline") ||
      isUnder(target, "src/host") ||
      isUnder(target, "src/config") ||
      isUnder(target, "src/internal")
    )
  ) {
    return undefined
  }
  return failure(
    source,
    reference,
    "engine/ may import only effect/*, node:*, engine-local modules, pipeline/, host/, config/, and internal/."
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

const files = existsSync(sourceRoot) ? collectTypeScriptFiles(sourceRoot) : []
const failures = files.flatMap(checkFile)

if (failures.length > 0) {
  console.error("Import rule checks failed:")
  for (const item of failures) {
    console.error(`- ${item}`)
  }
  exit(1)
}
