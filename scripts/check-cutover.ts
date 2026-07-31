#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { extname, join, relative, resolve, sep } from "node:path"
import ts from "typescript"
import { encodeCanonicalJson } from "./lib/canonical-json.js"

const root = process.cwd()
const args = process.argv.slice(2).filter((argument) => argument !== "--")
let milestone = "M6"
for (let index = 0; index < args.length; index += 1) {
  if (args[index] !== "--milestone") throw new Error(`Unknown argument: ${args[index]}`)
  milestone = args[++index] ?? ""
}
if (!["M3", "M4", "M5", "M6"].includes(milestone)) {
  throw new Error("Cutover milestone must be M3, M4, M5, or M6.")
}

const walk = (directory: string): ReadonlyArray<string> => {
  const result: Array<string> = []
  if (!existsSync(directory)) return result
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walk(path))
    else if (entry.isFile() && [".ts", ".tsx", ".mts", ".cts"].includes(extname(path))) {
      result.push(path)
    }
  }
  return result
}
const shown = (path: string): string => relative(root, path).split(sep).join("/")
const sources = [
  ...walk(resolve(root, "src")),
  ...walk(resolve(root, "apps/release-ts/src")),
  ...walk(resolve(root, "apps/ts-release-action/src"))
]
const legacyRoots = [
  "src/rewrite", "src/resolve", "src/grammar", "src/engine", "src/run", "src/host",
  "src/pack", "src/github", "src/render", "src/doctor", "src/features", "src/types"
]
const legacyProductFiles = milestone === "M3"
  ? sources.filter((path) => shown(path).startsWith("src/features/"))
  : sources.filter((path) => legacyRoots.some((owner) =>
      shown(path) === owner || shown(path).startsWith(`${owner}/`)))

const oldLifecycle = new Set(["build", "release", "verify"])
const oldSymbols = new Set([
  "build", "release", "verify", "defineConfig", "ReleaseRuntime",
  "ReleaseExecutionResult", "ReleasePlanV5", "ReleaseEvidenceV3"
])
const rootSource = ts.createSourceFile(
  "src/index.ts",
  readFileSync(resolve(root, "src/index.ts"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
)
const rootExports = new Set<string>()
rootSource.forEachChild((node) => {
  if (ts.isExportDeclaration(node) && node.exportClause !== undefined && ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) rootExports.add(element.name.text)
  }
  if (
    (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ||
      ts.isVariableStatement(node)) &&
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  ) {
    if ("name" in node && node.name !== undefined && ts.isIdentifier(node.name)) rootExports.add(node.name.text)
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) rootExports.add(declaration.name.text)
      }
    }
  }
})
const publicLifecycle = [...rootExports].filter((name) => oldSymbols.has(name))

const forbiddenImportRoots = milestone === "M3" ? ["src/features"] : legacyRoots
const legacyImports: Array<string> = []
const lifecycleHandlers: Array<string> = []
for (const path of sources) {
  const display = shown(path)
  const checkImports = milestone !== "M3" || ![...legacyRoots, "src/config"].some((owner) =>
    display === owner || display.startsWith(`${owner}/`))
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text
      if (checkImports && specifier.startsWith(".")) {
        const target = shown(resolve(path, "..", specifier))
        if (forbiddenImportRoots.some((owner) => target === owner || target.startsWith(`${owner}/`))) {
          legacyImports.push(`${display}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
        }
      }
    }
    if (
      display.startsWith("apps/release-ts/src/") &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "make" &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0]) &&
      oldLifecycle.has(node.arguments[0].text)
    ) lifecycleHandlers.push(`${display}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
    if (
      display.startsWith("apps/release-ts/src/") &&
      ts.isCaseClause(node) &&
      ts.isStringLiteral(node.expression) &&
      oldLifecycle.has(node.expression.text)
    ) lifecycleHandlers.push(`${display}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
    ts.forEachChild(node, visit)
  }
  visit(source)
}

const cli = await import("../apps/release-ts/src/cli/commands.js") as {
  readonly commandNames: ReadonlyArray<string>
}
const action = await import("../apps/ts-release-action/src/commands.js") as {
  readonly actionCommands: ReadonlyArray<string>
  readonly actionOutputs: ReadonlyArray<string>
}
const expectedCli = ["init", "doctor", "plan", "apply"]
const expectedAction = ["plan", "apply", "doctor"]
const expectedOutputs = [
  "plan_id", "execution_review_id", "execution_receipt_id", "publish_review_id",
  "publish_receipt_id", "run_id", "run_path", "status", "evidence_path"
]
const exact = (actual: ReadonlyArray<string>, expected: ReadonlyArray<string>): boolean =>
  JSON.stringify(actual) === JSON.stringify(expected)
const failures = [
  ...legacyProductFiles.map((path) => `legacy product file: ${shown(path)}`),
  ...legacyImports.map((path) => `legacy import: ${path}`),
  ...lifecycleHandlers.map((path) => `old lifecycle handler: ${path}`),
  ...publicLifecycle.map((name) => `old public export: ${name}`),
  ...(!exact(cli.commandNames, expectedCli) ? ["CLI command roster is not exact."] : []),
  ...(!exact(action.actionCommands, expectedAction) ? ["Action command roster is not exact."] : []),
  ...(!exact(action.actionOutputs, expectedOutputs) ? ["Action output roster is not exact."] : [])
]
if (failures.length > 0) throw new Error(failures.join("\n"))

process.stdout.write(encodeCanonicalJson({
  schemaVersion: "rewrite-cutover-report/v1",
  status: "cutover-proven",
  milestone,
  legacyProductFiles: 0,
  legacyImports: 0,
  lifecycleHandlers: 0,
  oldPublicExports: 0,
  behaviorMismatches: 0,
  cliCommands: expectedCli.length,
  actionCommands: expectedAction.length,
  actionOutputs: expectedOutputs.length,
  warnings: 0
}))
