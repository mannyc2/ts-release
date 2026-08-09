import { existsSync, readFileSync } from "node:fs"
import { dirname, join, normalize } from "node:path"
import * as ts from "typescript"
import { collectTypeScriptFiles, makeDisplayPath, requireDirectory } from "./walk.js"

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

export interface ImportRulesRoots {
  readonly source: string
  readonly bareEffect: ReadonlyArray<string>
  readonly appPlatform: ReadonlyArray<string>
  readonly hardCut: ReadonlyArray<string>
  readonly actionManifest?: string | undefined
}

// apps have no test/ trees today; re-add the roots when they appear.
export const productionRoots: ImportRulesRoots = {
  source: "src",
  bareEffect: [
    "src",
    "test",
    "scripts",
    "apps/release-ts/src",
    "apps/release-ts/scripts",
    "apps/ts-release-action/src"
  ],
  appPlatform: [
    "apps/release-ts/src",
    "apps/ts-release-action/src"
  ],
  hardCut: [
    "src",
    "scripts",
    "apps/release-ts/src",
    "apps/release-ts/scripts",
    "apps/ts-release-action/src"
  ],
  actionManifest: "apps/ts-release-action/action.yml"
}

export interface ImportRulesReport {
  readonly failures: ReadonlyArray<string>
  readonly filesExamined: number
}

const temporaryAllowlist: ReadonlyArray<AllowlistEntry> = []

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

const isEffectImport = (specifier: string): boolean =>
  specifier.startsWith("effect/")

const isNodeImport = (specifier: string): boolean =>
  specifier.startsWith("node:")

const directoryDependencies: Readonly<Record<string, ReadonlyArray<string>>> = {
  model: ["model"],
  recipes: ["recipes", "model"],
  config: ["config", "model", "recipes"],
  plan: ["plan", "model", "config", "recipes"],
  drivers: ["drivers", "model"],
  apply: ["apply", "model", "plan", "drivers"],
  view: ["view", "model", "plan"],
  platform: ["platform", "drivers", "apply", "release"],
  // The resolver is pure authored→canonical semantics: it may read the config
  // vocabulary and the model, and nothing may read IT except the root export
  // and the apps (enforced below).
  resolve: ["resolve", "model", "recipes"],
  api: ["api", "model", "plan", "apply", "view", "drivers", "platform"],
  release: ["release", "model", "recipes", "drivers"],
  publication: ["publication", "model", "release", "drivers"]
}

const sourceDirectory = (file: string): string | undefined => {
  const [rootDirectory, directory] = file.split("/")
  return rootDirectory === "src" && directory?.includes(".") === false ? directory : undefined
}

const targetDirectory = (target: string): string | undefined => {
  const [rootDirectory, directory] = target.split("/")
  return rootDirectory === "src" ? directory : undefined
}

// Plan 186 E1. The platform seam is spawn + HTTP + env; file I/O deliberately
// stays direct node:fs because effect/FileSystem cannot express the
// O_NOFOLLOW/fstat identity discipline these files exist to hold. Both halves
// are mechanical here so new ambient host usage is a deliberate act.
const hostPlatformPackages: Readonly<Record<string, string>> = {
  "@effect/platform-bun": "src/platform/bun.ts",
  "@effect/platform-node": "src/platform/node.ts"
}
const fileSystemFiles: ReadonlySet<string> = new Set([
  "src/api/input.ts",
  "src/apply/store.ts",
  "src/drivers/contain.ts",
  "src/drivers/local.ts",
  "src/drivers/workspace.ts",
  "src/platform/source-observer.ts",
  "src/release/prepare.ts",
  "src/release/prepared-store.ts"
])
const appEntryModules: ReadonlySet<string> = new Set([
  "apps/release-ts/src/cli/main.ts",
  // The published bin's entry: same duties as main.ts on the Node host.
  "apps/release-ts/src/cli/node-main.ts",
  "apps/ts-release-action/src/index.ts"
])
const appPlatformSpecifiers = [
  "@effect/platform-bun",
  "@effect/platform-node",
  "@mannyc1/ts-release/bun",
  "@mannyc1/ts-release/node"
]

const hardCutTerms = [
  ["ReleaseState", "durable ReleaseState is forbidden after the v3 cut"],
  ["ArtifactCatalog", "Artifact is the sole artifact vocabulary"],
  ["ArtifactInventoryItem", "the projected artifact inventory is forbidden"],
  ["ReleasePlanDocument", "ReleasePlan is the sole plan type"],
  ["plan.state", "release-plan/v4 is flat"],
  ["release-plan/v3", "v3 plan readers and encoders are forbidden"], ["release-plan/v2", "v2 plan readers and encoders are forbidden"],
  [["target", "count"].join("_"), "the Action emits surface_count only"]
] as const

// src/resolve resolves authored configuration deterministically; anything the
// clock, the environment, or a random source can change is banned there.
const impureResolverTerms = [
  ["process.env", "the resolver reads no environment; facts are observed by apps and passed in"],
  ["Math.random", "the resolver is deterministic"],
  ["Date.now", "the resolver is deterministic"],
  ["new Date", "the resolver is deterministic"]
] as const

const forbiddenCarrierFiles = [
  "src/grammar/catalog.ts",
  "src/engine/plan-document.ts"
]

export const checkImportRules = (
  root: string,
  roots: ImportRulesRoots = productionRoots
): ImportRulesReport => {
  const sourceRoot = join(root, roots.source)
  const toDisplayPath = makeDisplayPath(root)

  const location = (source: ts.SourceFile, position: number): string => {
    const line = source.getLineAndCharacterOfPosition(position)
    return `${toDisplayPath(source.fileName)}:${line.line + 1}:${line.character + 1}`
  }

  const relativeTarget = (reference: ImportReference): string | undefined => {
    if (!reference.specifier.startsWith(".")) {
      return undefined
    }
    return toDisplayPath(normalize(join(dirname(reference.file), reference.specifier)))
  }

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

  const checkConceptImport = (
    source: ts.SourceFile,
    reference: ImportReference
  ): string | undefined => {
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
    return undefined
  }

  const checkHostPlatformImport = (
    source: ts.SourceFile,
    reference: ImportReference
  ): string | undefined => {
    const owner = Object.entries(hostPlatformPackages).find(([prefix]) =>
      reference.specifier === prefix || reference.specifier.startsWith(`${prefix}/`))
    if (owner === undefined || toDisplayPath(reference.file) === owner[1]) {
      return undefined
    }
    return failure(source, reference, `only ${owner[1]} may import ${owner[0]}.`)
  }

  const checkFileSystemImport = (
    source: ts.SourceFile,
    reference: ImportReference
  ): string | undefined => {
    if (reference.specifier !== "node:fs" && !reference.specifier.startsWith("node:fs/")) {
      return undefined
    }
    return fileSystemFiles.has(toDisplayPath(reference.file))
      ? undefined
      : failure(source, reference, "direct node:fs is confined to the secure-open file list.")
  }

  const checkReference = (
    source: ts.SourceFile,
    reference: ImportReference
  ): string | undefined =>
    checkHostPlatformImport(source, reference) ??
    checkFileSystemImport(source, reference) ??
    checkConceptImport(source, reference)

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

  const ambientHostUsage = (source: ts.SourceFile): Array<string> => {
    const failures: Array<string> = []
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === "Bun" && !ts.isPropertyAccessExpression(node.parent)) {
        failures.push(`${location(source, node.getStart(source))} names the Bun global; spawn, glob, and compression are host capabilities.`)
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Bun"
      ) {
        failures.push(`${location(source, node.getStart(source))} reaches Bun.${node.name.text}; spawn, glob, and compression are host capabilities.`)
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "fetch") {
        failures.push(`${location(source, node.getStart(source))} calls global fetch; use the injected HttpClient.`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    return failures
  }

  const checkAmbientHostUsage = (file: string): Array<string> =>
    ambientHostUsage(ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    ))

  const checkAppPlatformImports = (file: string): Array<string> => {
    const displayPath = toDisplayPath(file)
    if (appEntryModules.has(displayPath)) {
      return []
    }
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    return collectImports(file).flatMap((reference) =>
      appPlatformSpecifiers.some((prefix) =>
          reference.specifier === prefix || reference.specifier.startsWith(`${prefix}/`))
        ? [failure(source, reference, "an app composes its platform layer in its entry module only.")]
        : [])
  }

  // The resolver's whole value is that (authored, facts) determines the output.
  // Ambient reads are what would quietly break that, and they are the one class
  // of impurity a type cannot forbid.
  const impureResolverUsage = (file: string): Array<string> => {
    if (!toDisplayPath(file).startsWith("src/resolve/")) return []
    const source = readFileSync(file, "utf8")
    return impureResolverTerms.flatMap(([term, reason]) => {
      const position = source.indexOf(term)
      if (position < 0) return []
      const line = source.slice(0, position).split("\n").length
      return [`${toDisplayPath(file)}:${line}: ${reason}; found ${JSON.stringify(term)}`]
    })
  }

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

  const actionManifestPath = roots.actionManifest === undefined
    ? undefined
    : join(root, roots.actionManifest)
  const hardCutScanFiles = [
    ...roots.hardCut.flatMap((directory) =>
      collectTypeScriptFiles(requireDirectory(join(root, directory), "check-import-rules"))
    ),
    ...(actionManifestPath !== undefined && existsSync(actionManifestPath) ? [actionManifestPath] : [])
  ].filter((file) => toDisplayPath(file) !== "scripts/lib/import-rules.ts")

  const files = collectTypeScriptFiles(requireDirectory(sourceRoot, "check-import-rules"))
  const bareEffectFiles = roots.bareEffect.flatMap((directory) =>
    collectTypeScriptFiles(requireDirectory(join(root, directory), "check-import-rules"))
  )
  // Shipped app source only: apps/*/scripts are in-repo check harnesses that
  // drive the CLI runtime directly and are never published.
  const appPlatformFiles = roots.appPlatform.flatMap((directory) =>
    collectTypeScriptFiles(requireDirectory(join(root, directory), "check-import-rules"))
  )
  const examinedFiles = new Set([
    ...files,
    ...bareEffectFiles,
    ...appPlatformFiles,
    ...hardCutScanFiles
  ])
  const failures = [
    ...files.flatMap(checkFile),
    ...files.flatMap(checkAmbientHostUsage),
    ...files.flatMap(impureResolverUsage),
    ...appPlatformFiles.flatMap(checkAppPlatformImports),
    ...bareEffectFiles.flatMap(checkBareEffectImports),
    ...hardCutScanFiles.flatMap(hardCutViolations),
    ...forbiddenCarrierFiles.flatMap((file) =>
      existsSync(join(root, file)) ? [`${file}: compatibility carrier file must be deleted`] : []
    ),
    ...(actionManifestPath !== undefined && !existsSync(actionManifestPath)
      ? [`${roots.actionManifest}: declared scan file does not exist; a rename must update the gate in the same change`]
      : []),
    ...(examinedFiles.size === 0 ? ["no files examined; every declared scan root resolved to nothing"] : [])
  ]

  return { failures, filesExamined: examinedFiles.size }
}
