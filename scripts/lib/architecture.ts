import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, dirname, extname, join, normalize, relative, resolve, sep } from "node:path"
import ts from "typescript"
import { canonicalJsonHash, type JsonValue } from "./canonical-json.js"
import { expectExactKeys, expectObject, parseStrictJson } from "./strict-json.js"

export interface ArchitectureNode {
  readonly id: string
  readonly paths: ReadonlyArray<string>
  readonly imports: ReadonlyArray<string>
}

export interface ArchitectureContract {
  readonly schemaVersion: "rewrite-architecture/v1"
  readonly permanentDirectories: ReadonlyArray<string>
  readonly concepts: ReadonlyArray<string>
  readonly nodes: ReadonlyArray<ArchitectureNode>
  readonly temporaryNamespace: {
    readonly root: string
    readonly allowedFrom: string
    readonly allowedThrough: string
    readonly mirrorsPermanentNodes: boolean
  }
  readonly legacyExceptions: ReadonlyArray<{
    readonly path: string
    readonly allowedThrough: string
  }>
  readonly deletionConditions: Readonly<
    Record<string, { readonly required: ReadonlyArray<string>; readonly forbidden: ReadonlyArray<string> }>
  >
  readonly providerNames: ReadonlyArray<string>
  readonly forbiddenRuntimePatterns: ReadonlyArray<string>
  readonly boundaryRunPaths: ReadonlyArray<string>
  readonly excludedLaneRoots: ReadonlyArray<string>
}

const CONTRACT_PATH = "contracts/rewrite/architecture.json"
const milestoneOrder = ["contract", "M1", "M2", "PORT", "M3", "M4", "M5", "M6", "PARITY"]

const readContract = (root: string): {
  readonly contract: ArchitectureContract
  readonly hash: string
} => {
  const parsed = expectObject(
    parseStrictJson(readFileSync(resolve(root, CONTRACT_PATH), "utf8")),
    "architecture contract"
  )
  expectExactKeys(parsed, [
    "schemaVersion",
    "permanentDirectories",
    "concepts",
    "nodes",
    "temporaryNamespace",
    "legacyExceptions",
    "deletionConditions",
    "providerNames",
    "forbiddenRuntimePatterns",
    "boundaryRunPaths",
    "excludedLaneRoots"
  ])
  if (parsed.schemaVersion !== "rewrite-architecture/v1") {
    throw new Error("Unknown architecture schemaVersion.")
  }
  return {
    contract: parsed as unknown as ArchitectureContract,
    hash: canonicalJsonHash(parsed)
  }
}

const walkTypeScript = (root: string): ReadonlyArray<string> => {
  const files: Array<string> = []
  const visit = (directory: string): void => {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() && [".ts", ".tsx", ".mts", ".cts"].includes(extname(entry.name))) {
        files.push(path)
      }
    }
  }
  visit(resolve(root, "src"))
  visit(resolve(root, "apps/release-ts/src"))
  visit(resolve(root, "apps/ts-release-action/src"))
  return files.sort()
}

const displayPath = (root: string, path: string): string =>
  relative(root, path).split(sep).join("/")

const pathMatches = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`) ||
  path === `${prefix}.ts` || path === `${prefix}.tsx`

const withoutTemporaryPrefix = (path: string): string =>
  path.startsWith("src/rewrite/") ? `src/${path.slice("src/rewrite/".length)}` : path

const nodeForPath = (
  path: string,
  nodes: ReadonlyArray<ArchitectureNode>
): ArchitectureNode | undefined => {
  const permanent = withoutTemporaryPrefix(path)
  const matches = nodes
    .flatMap((node) => node.paths.map((prefix) => ({ node, prefix })))
    .filter(({ prefix }) => pathMatches(permanent, prefix))
    .sort((left, right) => right.prefix.length - left.prefix.length)
  if (permanent.startsWith("src/plan/accepted")) {
    return nodes.find((node) => node.id === "plan/accepted")
  }
  return matches.find(({ node }) => node.id !== "plan/accepted")?.node
}

const importsOf = (path: string): ReadonlyArray<{ readonly specifier: string; readonly position: number }> => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const imports: Array<{ readonly specifier: string; readonly position: number }> = []
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push({ specifier: node.moduleSpecifier.text, position: node.getStart(source) })
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]!)
    ) {
      imports.push({ specifier: node.arguments[0]!.text, position: node.getStart(source) })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return imports
}

const importTarget = (root: string, from: string, specifier: string): string | undefined => {
  if (!specifier.startsWith(".")) return undefined
  return displayPath(root, normalize(resolve(dirname(from), specifier)))
}

const legacyAt = (
  path: string,
  contract: ArchitectureContract,
  milestone: string
): boolean => {
  const current = milestoneOrder.indexOf(milestone)
  return contract.legacyExceptions.some((exception) => {
    const through = milestoneOrder.indexOf(exception.allowedThrough)
    return pathMatches(path, exception.path) && current <= through
  })
}

const importFailures = (
  root: string,
  files: ReadonlyArray<string>,
  contract: ArchitectureContract,
  milestone: string
): ReadonlyArray<string> => {
  const failures: Array<string> = []
  for (const file of files) {
    const shown = displayPath(root, file)
    const from = nodeForPath(shown, contract.nodes)
    if (from === undefined || legacyAt(shown, contract, milestone)) continue
    for (const imported of importsOf(file)) {
      if (from.id === "apps") {
        if (
          imported.specifier.startsWith("@mannyc1/ts-release/") ||
          imported.specifier.startsWith("../../src/") ||
          imported.specifier.startsWith("../../../src/")
        ) {
          failures.push(`${shown} imports product subpath ${imported.specifier}`)
        }
        continue
      }
      const targetPath = importTarget(root, file, imported.specifier)
      if (targetPath === undefined) continue
      if (
        contract.excludedLaneRoots.some((prefix) =>
          targetPath === prefix || targetPath.startsWith(`${prefix}/`)
        )
      ) {
        failures.push(`${shown} imports excluded lane ${imported.specifier}`)
        continue
      }
      const target = nodeForPath(targetPath, contract.nodes)
      if (target !== undefined && target.id !== from.id && !from.imports.includes(target.id)) {
        failures.push(`${shown}: ${from.id} may not import ${target.id} via ${imported.specifier}`)
      }
    }
  }
  return failures
}

const patternFailures = (
  root: string,
  files: ReadonlyArray<string>,
  contract: ArchitectureContract,
  milestone: string
): ReadonlyArray<string> => {
  const failures: Array<string> = []
  const patterns = contract.forbiddenRuntimePatterns.map((pattern) => new RegExp(pattern, "u"))
  for (const file of files) {
    const shown = displayPath(root, file)
    if (legacyAt(shown, contract, milestone)) continue
    const text = readFileSync(file, "utf8")
    for (const pattern of patterns) {
      if (
        pattern.test(text) &&
        !contract.boundaryRunPaths.some((prefix) => pathMatches(shown, prefix))
      ) {
        failures.push(`${shown} matches forbidden runtime pattern ${pattern.source}`)
      }
    }
    if (!shown.startsWith("src/drivers/") || /(?:registration|registry|profile)/u.test(basename(file))) {
      continue
    }
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node): void => {
      if (ts.isIfStatement(node) || ts.isSwitchStatement(node) || ts.isConditionalExpression(node)) {
        const branchText = node.getText(source).toLowerCase()
        const provider = contract.providerNames.find((name) =>
          new RegExp(`["']${name}["']`, "u").test(branchText)
        )
        if (provider !== undefined) {
          failures.push(`${shown} contains provider-name conditional for ${provider}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return failures
}

const deletionFailures = (
  root: string,
  contract: ArchitectureContract,
  milestone: string
): ReadonlyArray<string> => {
  const condition = contract.deletionConditions[milestone]
  if (condition === undefined) return []
  return [
    ...condition.required
      .filter((path) => !existsSync(resolve(root, path)))
      .map((path) => `${milestone} requires ${path}`),
    ...condition.forbidden
      .filter((path) => existsSync(resolve(root, path)))
      .map((path) => `${milestone} forbids legacy path ${path}`)
  ]
}

export interface ArchitectureReport {
  readonly schemaVersion: "rewrite-architecture-report/v1"
  readonly contractHash: string
  readonly milestone: string
  readonly concepts: number
  readonly nodes: number
  readonly legacyExceptions: number
  readonly failures: ReadonlyArray<string>
}

export const checkArchitecture = (
  root: string,
  milestone: string = "contract"
): ArchitectureReport => {
  if (!milestoneOrder.includes(milestone)) throw new Error(`Unknown architecture milestone: ${milestone}`)
  const { contract, hash } = readContract(root)
  if (contract.concepts.length !== 8 || new Set(contract.concepts).size !== 8) {
    throw new Error("Architecture contract must freeze exactly eight unique concepts.")
  }
  const ids = contract.nodes.map((node) => node.id)
  if (new Set(ids).size !== ids.length) throw new Error("Architecture node ids must be unique.")
  for (const node of contract.nodes) {
    for (const target of node.imports) {
      if (target !== "root-api" && !ids.includes(target)) {
        throw new Error(`${node.id} names unknown import node ${target}.`)
      }
    }
  }
  const files = walkTypeScript(root)
  const failures = [
    ...importFailures(root, files, contract, milestone),
    ...patternFailures(root, files, contract, milestone),
    ...deletionFailures(root, contract, milestone)
  ].sort()
  return {
    schemaVersion: "rewrite-architecture-report/v1",
    contractHash: hash,
    milestone,
    concepts: contract.concepts.length,
    nodes: contract.nodes.length,
    legacyExceptions: contract.legacyExceptions.length,
    failures
  }
}

export const architectureContractHash = (root: string): string => readContract(root).hash

export const decodeArchitectureContract = (value: JsonValue): ArchitectureContract =>
  expectObject(value, "architecture contract") as unknown as ArchitectureContract
