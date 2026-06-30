import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, relative, resolve } from "node:path"
import { cwd, exit } from "node:process"
import * as ts from "typescript"
import {
  aggregateSourcePaths,
  bannedExternalPrefixes,
  publicExportPolicies,
  runtimeBearingSourcePaths
} from "./lib/public-api-policy.js"

interface ModuleReference {
  readonly specifier: string
  readonly position: number
}

interface PackageExportTarget {
  readonly subpath: string
  readonly target: string
  readonly sourcePath: string
}

const root = cwd()

const toDisplayPath = (path: string): string =>
  relative(root, path).replaceAll("\\", "/")

const sourcePath = (...segments: ReadonlyArray<string>): string =>
  resolve(root, "src", ...segments)

const rootSourcePath = sourcePath("index.ts")
const cliDirectory = sourcePath("cli")
const appDirectory = resolve(root, "apps", "release-ts")
const appScanRoots = [
  resolve(appDirectory, "src"),
  resolve(appDirectory, "scripts"),
  resolve(appDirectory, "test")
]

const policySourcePath = (path: string): string =>
  sourcePath(...path.split("/"))

const aggregateSourceFiles = new Set(aggregateSourcePaths.map(policySourcePath))

const runtimeBearingFiles = new Set(runtimeBearingSourcePaths.map(policySourcePath))

const emptyAllowedFiles = new Set<string>()
const allowedRuntimeFilesByExport = new Map<string, ReadonlySet<string>>(
  publicExportPolicies.map((policy) => [
    policy.subpath,
    new Set(policy.allowedRuntimeSourcePaths.map(policySourcePath))
  ])
)

const emptyAllowedExternalPrefixes = new Set<string>()
const allowedExternalPrefixesByExport = new Map<string, ReadonlySet<string>>(
  publicExportPolicies.map((policy) => [
    policy.subpath,
    new Set(policy.allowedExternalPrefixes)
  ])
)

const bunGlobalAllowedExports = new Set(
  publicExportPolicies
    .filter((policy) => policy.allowsBunGlobal)
    .map((policy) => policy.subpath)
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isUnderDirectory = (file: string, directory: string): boolean => {
  const path = relative(directory, file)
  return path.length > 0 && !path.startsWith("..") && !path.startsWith("/")
}

const isInsidePath = (file: string, directory: string): boolean => {
  const path = relative(directory, file)
  return path.length === 0 || (!path.startsWith("..") && !path.startsWith("/"))
}

const matchesPrefix = (specifier: string, prefix: string): boolean =>
  specifier === prefix ||
  specifier.startsWith(`${prefix}/`) ||
  (prefix.endsWith(":") && specifier.startsWith(prefix))

const matchedBannedExternalPrefix = (specifier: string): string | undefined =>
  bannedExternalPrefixes.find((prefix) => matchesPrefix(specifier, prefix))

const isAllowedExternal = (specifier: string, allowedPrefixes: ReadonlySet<string>): boolean => {
  for (const prefix of allowedPrefixes) {
    if (matchesPrefix(specifier, prefix)) {
      return true
    }
  }
  return false
}

const resolveRelativeModule = (fromFile: string, specifier: string): string | undefined => {
  const rawPath = resolve(dirname(fromFile), specifier)
  const candidates: Array<string> = []

  if (specifier.endsWith(".js")) {
    candidates.push(`${rawPath.slice(0, -3)}.ts`)
    candidates.push(`${rawPath.slice(0, -3)}.d.ts`)
  } else if (extname(rawPath).length === 0) {
    candidates.push(`${rawPath}.ts`)
    candidates.push(resolve(rawPath, "index.ts"))
  } else {
    candidates.push(rawPath)
  }

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate
    }
  }
  return undefined
}

const location = (source: ts.SourceFile, position: number): string => {
  const line = source.getLineAndCharacterOfPosition(position)
  return `${toDisplayPath(source.fileName)}:${line.line + 1}:${line.character + 1}`
}

const importDeclarationIsRuntime = (node: ts.ImportDeclaration): boolean => {
  const importClause = node.importClause
  if (importClause === undefined) {
    return true
  }
  if (importClause.isTypeOnly) {
    return false
  }
  if (importClause.name !== undefined) {
    return true
  }
  const namedBindings = importClause.namedBindings
  if (namedBindings === undefined || ts.isNamespaceImport(namedBindings)) {
    return true
  }
  return namedBindings.elements.length === 0 || namedBindings.elements.some((element) => !element.isTypeOnly)
}

const exportDeclarationIsRuntime = (node: ts.ExportDeclaration): boolean => {
  if (node.isTypeOnly) {
    return false
  }
  const exportClause = node.exportClause
  if (exportClause === undefined || !ts.isNamedExports(exportClause)) {
    return true
  }
  return exportClause.elements.length === 0 || exportClause.elements.some((element) => !element.isTypeOnly)
}

const moduleReferences = (source: ts.SourceFile): Array<ModuleReference> => {
  const references: Array<ModuleReference> = []

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && importDeclarationIsRuntime(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({
        specifier: node.moduleSpecifier.text,
        position: node.moduleSpecifier.getStart(source)
      })
    }
    if (
      ts.isExportDeclaration(node) &&
      exportDeclarationIsRuntime(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      references.push({
        specifier: node.moduleSpecifier.text,
        position: node.moduleSpecifier.getStart(source)
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return references
}

const allModuleReferences = (source: ts.SourceFile): Array<ModuleReference> => {
  const references: Array<ModuleReference> = []

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({
        specifier: node.moduleSpecifier.text,
        position: node.moduleSpecifier.getStart(source)
      })
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      references.push({
        specifier: node.moduleSpecifier.text,
        position: node.moduleSpecifier.getStart(source)
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return references
}

const collectTypeScriptFiles = (directory: string): Array<string> => {
  if (!existsSync(directory)) {
    return []
  }

  const files: Array<string> = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "dist" && entry.name !== "node_modules") {
        files.push(...collectTypeScriptFiles(path))
      }
      continue
    }
    if (entry.isFile() && path.endsWith(".ts")) {
      files.push(path)
    }
  }
  return files
}

const sourceFiles = (): Array<string> =>
  collectTypeScriptFiles(resolve(root, "src"))

const appFiles = (): Array<string> =>
  appScanRoots.flatMap(collectTypeScriptFiles)

const bunGlobalLocations = (source: ts.SourceFile): Array<string> => {
  const failures: Array<string> = []

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === "Bun") {
      failures.push(`${location(source, node.getStart(source))} references Bun global`)
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return failures
}

const readManifest = (failures: Array<string>): Record<string, unknown> | undefined => {
  const parsed: unknown = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
  if (!isRecord(parsed)) {
    failures.push("package.json did not parse to an object")
    return undefined
  }
  return parsed
}

const sourceEntrypointForPackageTarget = (
  subpath: string,
  target: string,
  failures: Array<string>
): string | undefined => {
  const distPrefix = "./dist/"
  const jsSuffix = ".js"
  if (!target.startsWith(distPrefix) || !target.endsWith(jsSuffix)) {
    failures.push(`package export ${subpath} target ${target} must point at a ./dist/*.js file`)
    return undefined
  }

  const sourceRelativePath = `${target.slice(distPrefix.length, -jsSuffix.length)}.ts`
  const path = sourcePath(sourceRelativePath)
  if (!existsSync(path)) {
    failures.push(`package export ${subpath} target ${target} has no source counterpart ${toDisplayPath(path)}`)
    return undefined
  }
  if (aggregateSourceFiles.has(path)) {
    failures.push(`package export ${subpath} must not point at aggregate source file ${toDisplayPath(path)}`)
  }
  return path
}

const packageExportTargets = (failures: Array<string>): Array<PackageExportTarget> => {
  const manifest = readManifest(failures)
  if (manifest === undefined) {
    return []
  }
  const exportsField = manifest.exports
  if (!isRecord(exportsField)) {
    failures.push("package.json exports must be an object")
    return []
  }

  const targets: Array<PackageExportTarget> = []
  for (const [subpath, value] of Object.entries(exportsField)) {
    if (subpath.includes("*")) {
      failures.push(`package export ${subpath} must be explicit; wildcard exports are not allowed`)
    }

    let defaultTarget: string | undefined
    if (typeof value === "string") {
      defaultTarget = value
    } else if (isRecord(value)) {
      if (typeof value.default === "string") {
        defaultTarget = value.default
      } else {
        failures.push(`package export ${subpath} must provide a default JavaScript target`)
      }
    } else {
      failures.push(`package export ${subpath} must be a string or condition object`)
    }

    if (defaultTarget !== undefined) {
      const entrypoint = sourceEntrypointForPackageTarget(subpath, defaultTarget, failures)
      if (entrypoint !== undefined) {
        targets.push({ subpath, target: defaultTarget, sourcePath: entrypoint })
      }
    }
  }
  return targets
}

const assertRootEntrypoint = (rootEntrypoint: PackageExportTarget | undefined, failures: Array<string>): void => {
  if (rootEntrypoint === undefined) {
    failures.push("package.json exports must include the package root")
    return
  }
  if (rootEntrypoint.sourcePath !== rootSourcePath) {
    failures.push(`package root must resolve to ${toDisplayPath(rootSourcePath)}, got ${toDisplayPath(rootEntrypoint.sourcePath)}`)
  }
}

const checkExportGraph = (target: PackageExportTarget, failures: Array<string>): void => {
  const allowedRuntimeFiles = allowedRuntimeFilesByExport.get(target.subpath) ?? emptyAllowedFiles
  const allowedExternalPrefixes = allowedExternalPrefixesByExport.get(target.subpath) ?? emptyAllowedExternalPrefixes
  const allowsBunGlobal = bunGlobalAllowedExports.has(target.subpath)
  const visited = new Set<string>()
  const pending = [target.sourcePath]

  while (pending.length > 0) {
    const next = pending.pop()
    if (next === undefined || visited.has(next)) {
      continue
    }
    visited.add(next)

    const displayPath = toDisplayPath(next)
    if (isInsidePath(next, appDirectory)) {
      failures.push(`package export ${target.subpath} reaches app-only module ${displayPath}`)
      continue
    }
    if (runtimeBearingFiles.has(next) && !allowedRuntimeFiles.has(next)) {
      failures.push(`package export ${target.subpath} reaches runtime-bearing module ${displayPath}`)
      continue
    }
    if (isUnderDirectory(next, cliDirectory) && !allowedRuntimeFiles.has(next)) {
      failures.push(`package export ${target.subpath} reaches CLI module ${displayPath}`)
      continue
    }

    const source = ts.createSourceFile(
      next,
      readFileSync(next, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )

    if (!allowsBunGlobal) {
      for (const failure of bunGlobalLocations(source)) {
        failures.push(`package export ${target.subpath} ${failure}`)
      }
    }

    for (const reference of moduleReferences(source)) {
      const bannedPrefix = matchedBannedExternalPrefix(reference.specifier)
      if (bannedPrefix !== undefined && !isAllowedExternal(reference.specifier, allowedExternalPrefixes)) {
        failures.push(`${location(source, reference.position)} in export ${target.subpath} imports banned package ${reference.specifier}`)
        continue
      }
      if (!reference.specifier.startsWith(".")) {
        continue
      }

      const resolved = resolveRelativeModule(next, reference.specifier)
      if (resolved === undefined) {
        failures.push(`${location(source, reference.position)} could not resolve ${reference.specifier}`)
        continue
      }
      pending.push(resolved)
    }
  }
}

const checkRootDoesNotImportApp = (failures: Array<string>): void => {
  for (const file of sourceFiles()) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )

    for (const reference of allModuleReferences(source)) {
      if (reference.specifier.startsWith(".")) {
        const resolved = resolveRelativeModule(file, reference.specifier)
        if (resolved !== undefined && isInsidePath(resolved, appDirectory)) {
          failures.push(`${location(source, reference.position)} root src must not import app module ${toDisplayPath(resolved)}`)
        }
        continue
      }
      if (reference.specifier === "apps" || reference.specifier.startsWith("apps/")) {
        failures.push(`${location(source, reference.position)} root src must not import app module ${reference.specifier}`)
      }
    }
  }
}

const checkAppDoesNotImportPackageSubpaths = (failures: Array<string>): void => {
  const packageName = "@mannyc1/ts-release"
  for (const file of appFiles()) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )

    for (const reference of allModuleReferences(source)) {
      if (reference.specifier.startsWith(`${packageName}/`)) {
        failures.push(`${location(source, reference.position)} app code must not import unpublished package subpath ${reference.specifier}`)
      }
    }
  }
}

const failures: Array<string> = []
const targets = packageExportTargets(failures)
assertRootEntrypoint(targets.find((target) => target.subpath === "."), failures)

for (const target of targets) {
  checkExportGraph(target, failures)
}
checkRootDoesNotImportApp(failures)
checkAppDoesNotImportPackageSubpaths(failures)

if (failures.length > 0) {
  console.error("Tree-shaking boundary checks failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  exit(1)
}
