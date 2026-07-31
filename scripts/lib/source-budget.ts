import { existsSync, readFileSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path"
import ts from "typescript"
import {
  canonicalJsonHash,
  encodeCanonicalJson,
  sha256Hex,
  type JsonValue
} from "./canonical-json.js"
import { expectObject, parseStrictJson } from "./strict-json.js"

export type SourceLane = "examples" | "oracle" | "product" | "tooling"
export type ProductRole =
  | "contract-model"
  | "orchestration-projection"
  | "public-boundaries"
  | "recipes-data-templates"
  | "runtime-drivers"

interface SourceBudgetContract {
  readonly policyVersion: string
  readonly opening: {
    readonly product: number
    readonly oracle: number
    readonly roles: Readonly<Record<ProductRole, number>>
  }
  readonly milestones: Readonly<
    Record<string, { readonly product: number; readonly productMode: string; readonly oracle: number }>
  >
  readonly m6RoleCeilings: Readonly<Record<ProductRole, number>>
  readonly temporarySliceCeilings: Readonly<Record<string, Readonly<Record<string, number>>>>
  readonly familyBanks: Readonly<Record<string, number>>
  readonly oracleFamilyBanks: Readonly<Record<string, number>>
  readonly waves: ReadonlyArray<{
    readonly name: string
    readonly product: number
    readonly oracle: number
  }>
  readonly marginalKeyCeilings: {
    readonly median: number
    readonly p90: number
    readonly maximum: number
  }
  readonly marginalFamilyCeilings?: Readonly<Record<string, {
    readonly median: number
    readonly p90: number
    readonly maximum: number
  }>>
  readonly antiGolf: {
    readonly lineLength: number
    readonly functionSemanticLines: number
    readonly branchCount: number
    readonly nesting: number
    readonly fileSemanticLines: number
    readonly forbidden: ReadonlyArray<string>
    readonly scopeBeforeM6: ReadonlyArray<string>
    readonly scopeAtM6: ReadonlyArray<string>
  }
  readonly generatedWitnesses: ReadonlyArray<{
    readonly output: string
    readonly generator: string
    readonly generatedMarker: string
    readonly checkCommand: string
  }>
  readonly shippedRoots: ReadonlyArray<string>
  readonly excludedImportRoots: ReadonlyArray<string>
}

export interface CountedSourceFile {
  readonly path: string
  readonly lane: SourceLane
  readonly kind: string
  readonly lines: number
  readonly module: string
  readonly role?: ProductRole | undefined
}

export interface SourceBudgetReport {
  readonly schemaVersion: "semantic-source-report/v2"
  readonly policyVersion: string
  readonly policyHash: string
  readonly milestone: string
  readonly families: ReadonlyArray<string>
  readonly openingOracle: number
  readonly totals: Readonly<Record<SourceLane, number>>
  readonly byKind: Readonly<Record<string, number>>
  readonly byRole: Readonly<Record<string, number>>
  readonly byModule: Readonly<Record<string, number>>
  readonly temporarySlices: Readonly<Record<string, number>>
  readonly familySummary: Readonly<Record<string, {
    readonly productDelta: number
    readonly productBank: number
    readonly marginal: {
      readonly count: number
      readonly median: number
      readonly p90: number
      readonly maximum: number
      readonly ceilings: {
        readonly median: number
        readonly p90: number
        readonly maximum: number
      }
    }
  }>>
  readonly waveSummary?: {
    readonly name: string
    readonly productCeiling: number
    readonly oracleDelta: number
    readonly oracleBank: number
    readonly oracleCeiling: number
  } | undefined
  readonly publicBridges: ReadonlyArray<string>
  readonly files: ReadonlyArray<CountedSourceFile>
  readonly exclusions: ReadonlyArray<{ readonly path: string; readonly reason: string }>
  readonly warnings: ReadonlyArray<string>
}

const CONTRACT_PATH = "contracts/rewrite/source-budget.json"
const HISTORY_ROOT = "contracts/rewrite/source-history"
const MANIFEST_PATH = "parity/goreleaser-v2.17.0/manifest.json"
const PROFILE_LOCK_PATH_BY_FAMILY: Readonly<Record<string, string>> = {
  packages: "contracts/rewrite/profile-locks/packages.json",
  "supply-chain": "contracts/rewrite/profile-locks/supply-chain.json",
  providers: "contracts/rewrite/profile-locks/providers.json"
}
const M6_REPORT_PATH = "contracts/rewrite/reports/plan-177.json"
const textDecoder = new TextDecoder("utf-8", { fatal: true })

const familyOrder = [
  "distributed",
  "shared",
  "packages",
  "supply-chain",
  "providers",
  "changelog",
  "announce"
] as const

const predecessorReportByFamily: Readonly<Record<string, string>> = {
  distributed: M6_REPORT_PATH,
  shared: "contracts/rewrite/reports/plan-183.json",
  packages: "contracts/rewrite/reports/plan-178.json",
  "supply-chain": "contracts/rewrite/reports/plan-179.json",
  providers: "contracts/rewrite/reports/plan-180.json",
  "announce-changelog": "contracts/rewrite/reports/plan-181.json"
}
const completionReportByFamily: Readonly<Record<string, string>> = {
  distributed: "contracts/rewrite/reports/plan-183.json",
  shared: "contracts/rewrite/reports/plan-178.json",
  packages: "contracts/rewrite/reports/plan-179.json",
  "supply-chain": "contracts/rewrite/reports/plan-180.json",
  providers: "contracts/rewrite/reports/plan-181.json",
  "announce-changelog": "contracts/rewrite/reports/plan-182.json"
}

const run = (
  root: string,
  args: ReadonlyArray<string>
): { readonly exitCode: number; readonly stdout: string; readonly stderr: string } => {
  const result = Bun.spawnSync([...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString()
  }
}

const git = (root: string, args: ReadonlyArray<string>): string => {
  const result = run(root, ["git", ...args])
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`)
  }
  return result.stdout
}

const toPosix = (path: string): string => path.split(sep).join("/")

const trackedPaths = (root: string): ReadonlyArray<string> =>
  git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter((path) => path.length > 0)
    .sort()

const isGeneratedArtifactExample = (path: string): boolean =>
  path.startsWith("examples/") &&
  path.includes("/artifacts/") &&
  ![".json", ".md", ".ts", ".js"].includes(extname(path).toLowerCase())

const isProduct = (path: string): boolean => {
  if (path === "apps/ts-release-action/action.yml") return true
  if (path === "apps/release-ts/release.config.json") return true
  if (path.startsWith("src/")) return true
  if (path.startsWith("apps/release-ts/src/")) return true
  if (path.startsWith("apps/ts-release-action/src/")) return true
  if (path.startsWith("templates/") && basename(path).toLowerCase() !== "readme.md") return true
  return false
}

const oracleContract = (path: string): boolean =>
  [
    "contracts/rewrite/config-boundary.json",
    "contracts/rewrite/oracle.json",
    "contracts/rewrite/superiority.json"
  ].includes(path)

const laneFor = (path: string): SourceLane => {
  if (isProduct(path)) return "product"
  if (path.startsWith("test/") || path.endsWith(".test-d.ts")) return "oracle"
  if (path === MANIFEST_PATH || oracleContract(path)) return "oracle"
  if (path.startsWith("parity/") && path.endsWith(".json")) return "oracle"
  if (path.startsWith("examples/")) return "examples"
  return "tooling"
}

const roleFor = (path: string): ProductRole => {
  if (
    path.startsWith("src/config/") ||
    path.startsWith("src/resolve/") ||
    path.startsWith("src/grammar/") ||
    path === "src/run/evidence.ts" ||
    path === "src/run/workflow.ts" ||
    path.startsWith("src/model/") ||
    path.startsWith("src/plan/")
  ) {
    return "contract-model"
  }
  if (
    path.startsWith("src/features/") ||
    path.startsWith("src/recipes/") ||
    path.startsWith("templates/") ||
    path.startsWith("src/assets/") && path !== "src/assets/launcher.py" ||
    path === "apps/release-ts/release.config.json"
  ) {
    return "recipes-data-templates"
  }
  if (
    path.startsWith("src/run/") ||
    path.startsWith("src/github/") ||
    path.startsWith("src/host/") ||
    path.startsWith("src/pack/") ||
    path.startsWith("src/drivers/") ||
    path.startsWith("src/apply/")
  ) {
    return "runtime-drivers"
  }
  if (
    path.startsWith("src/engine/") ||
    path.startsWith("src/render/") ||
    path.startsWith("src/doctor/") ||
    path.startsWith("src/view/")
  ) {
    return "orchestration-projection"
  }
  return "public-boundaries"
}

const moduleFor = (path: string): string => {
  const pieces = path.split("/")
  if (pieces[0] === "src") return pieces.length > 2 ? `src/${pieces[1]}` : "src"
  if (pieces[0] === "apps") return pieces.slice(0, 2).join("/")
  if (pieces[0] === "test") {
    if (pieces[1] === "fixtures") return pieces.slice(0, 3).join("/")
    return "test"
  }
  return pieces[0] ?? "."
}

const kindFor = (path: string): string => {
  const extension = extname(path).toLowerCase()
  if ([".ts", ".tsx", ".mts", ".cts"].includes(extension)) return "typescript"
  if ([".js", ".mjs", ".cjs"].includes(extension)) return "javascript"
  if ([".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".csv", ".tsv"].includes(extension)) {
    return "semantic-data"
  }
  if ([".py", ".rb", ".go", ".rs", ".sh", ".bash"].includes(extension)) return "runtime-code"
  if ([".md", ".txt", ".html", ".xml"].includes(extension)) return "content"
  if ([".lock", ".npmrc", ".gitignore", ".gitattributes", ".example"].includes(extension)) {
    return "metadata"
  }
  if (extension === "") return "metadata"
  return `text:${extension}`
}

const normalizedLines = (text: string): ReadonlyArray<string> => {
  const lines = text.replace(/\r\n?/gu, "\n").split("\n")
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines
}

const countHashLanguage = (lines: ReadonlyArray<string>): number =>
  lines.reduce((total, line) => {
    const trimmed = line.trim()
    return total + (trimmed !== "" && (!trimmed.startsWith("#") || trimmed.startsWith("#!")) ? 1 : 0)
  }, 0)

const countHtmlLanguage = (lines: ReadonlyArray<string>): number => {
  let comment = false
  let total = 0
  for (const line of lines) {
    let rest = line.trim()
    let content = false
    while (rest.length > 0) {
      if (comment) {
        const end = rest.indexOf("-->")
        if (end === -1) {
          rest = ""
        } else {
          comment = false
          rest = rest.slice(end + 3).trimStart()
        }
        continue
      }
      const start = rest.indexOf("<!--")
      if (start === -1) {
        content = true
        break
      }
      if (rest.slice(0, start).trim() !== "") content = true
      rest = rest.slice(start + 4)
      comment = true
    }
    if (content) total += 1
  }
  return total
}

const countSlashLanguage = (lines: ReadonlyArray<string>): number => {
  let block = false
  let template = false
  let total = 0
  for (const line of lines) {
    let code = false
    let quote: "'" | '"' | undefined
    let escaped = false
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]!
      const next = line[index + 1]
      if (block) {
        if (character === "*" && next === "/") {
          block = false
          index += 1
        }
        continue
      }
      if (template) {
        if (!/\s/u.test(character)) code = true
        if (escaped) escaped = false
        else if (character === "\\") escaped = true
        else if (character === "`") template = false
        continue
      }
      if (quote !== undefined) {
        if (!/\s/u.test(character)) code = true
        if (escaped) escaped = false
        else if (character === "\\") escaped = true
        else if (character === quote) quote = undefined
        continue
      }
      if (character === "/" && next === "/") break
      if (character === "/" && next === "*") {
        block = true
        index += 1
        continue
      }
      if (character === "`") {
        template = true
        code = true
        continue
      }
      if (character === "'" || character === '"') {
        quote = character
        code = true
        continue
      }
      if (!/\s/u.test(character)) code = true
    }
    if (code) total += 1
  }
  return total
}

export const countSemanticLines = (path: string, text: string): number => {
  const lines = normalizedLines(text)
  const extension = extname(path).toLowerCase()
  if ([".bash", ".py", ".rb", ".sh", ".toml", ".yaml", ".yml"].includes(extension)) {
    return countHashLanguage(lines)
  }
  if ([".cjs", ".cts", ".go", ".js", ".jsonc", ".mjs", ".mts", ".rs", ".ts", ".tsx"].includes(extension)) {
    return countSlashLanguage(lines)
  }
  if ([".html", ".md", ".xml"].includes(extension)) return countHtmlLanguage(lines)
  return lines.reduce((total, line) => total + (line.trim() === "" ? 0 : 1), 0)
}

const aggregate = (
  files: ReadonlyArray<CountedSourceFile>,
  select: (file: CountedSourceFile) => string | undefined
): Readonly<Record<string, number>> => {
  const totals = new Map<string, number>()
  for (const file of files) {
    const key = select(file)
    if (key !== undefined) totals.set(key, (totals.get(key) ?? 0) + file.lines)
  }
  return Object.fromEntries([...totals.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

const isInside = (parent: string, child: string): boolean => {
  const path = relative(parent, child)
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
}

const importWarnings = (
  root: string,
  files: ReadonlyArray<CountedSourceFile>,
  excludedRoots: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const warnings: Array<string> = []
  const product = files.filter((file) => file.lane === "product")
  const patterns = [
    /\b(?:from|import)\s*\(?\s*["']([^"']+)["']/gu,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu
  ]
  for (const file of product) {
    if (!["typescript", "javascript"].includes(file.kind)) continue
    const text = readFileSync(resolve(root, file.path), "utf8")
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      for (const match of text.matchAll(pattern)) {
        const specifier = match[1]
        if (specifier === undefined || !specifier.startsWith(".")) continue
        const target = toPosix(relative(root, resolve(root, file.path, "..", specifier)))
        if (excludedRoots.some((excluded) => target === excluded || target.startsWith(`${excluded}/`))) {
          warnings.push(`${file.path} imports excluded lane path ${specifier}`)
        }
      }
    }
  }
  return warnings
}

const rewritePublicBridges = (
  root: string,
  files: ReadonlyArray<CountedSourceFile>
): ReadonlyArray<string> => files.filter((file) =>
  file.lane === "product" && !file.path.startsWith("src/rewrite/") &&
  ["typescript", "javascript"].includes(file.kind)
).filter((file) => {
  const text = readFileSync(resolve(root, file.path), "utf8")
  return [...text.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/gu)]
    .some((match) => {
      const specifier = match[1]
      if (specifier === undefined || !specifier.startsWith(".")) return false
      const target = toPosix(relative(root, resolve(root, file.path, "..", specifier)))
      return target === "src/rewrite" || target.startsWith("src/rewrite/")
    })
}).map((file) => file.path)

const temporarySlices = (
  files: ReadonlyArray<CountedSourceFile>,
  milestone: string
): Readonly<Record<string, number>> => {
  const selected = (include: (path: string) => boolean): number => files
    .filter((file) => file.lane === "product" && include(file.path))
    .reduce((total, file) => total + file.lines, 0)
  if (milestone === "M1") return {
    "candidate-model-config-recipes-plan": selected((path) =>
      ["model", "config", "recipes", "plan"].some((name) => path.startsWith(`src/rewrite/${name}/`)))
  }
  if (milestone === "M2") return {
    "candidate-executor-drivers": selected((path) =>
      ["src/rewrite/apply/apply.ts", "src/rewrite/apply/store.ts"].includes(path) ||
      path.startsWith("src/rewrite/drivers/"))
  }
  if (milestone === "PORT") return {
    "candidate-current-surface": selected((path) => path.startsWith("src/rewrite/current/"))
  }
  return {}
}

const antiGolfWarnings = (
  root: string,
  files: ReadonlyArray<CountedSourceFile>,
  contract: SourceBudgetContract,
  milestone: string
): ReadonlyArray<string> => {
  const prefixes = milestone === "M6" || milestone === "PARITY"
    ? contract.antiGolf.scopeAtM6
    : contract.antiGolf.scopeBeforeM6
  const warnings: Array<string> = []
  for (const file of files) {
    if (
      file.lane !== "product" ||
      !prefixes.some((prefix) => file.path === prefix || file.path.startsWith(`${prefix}/`))
    ) {
      continue
    }
    const text = readFileSync(resolve(root, file.path), "utf8")
    if (file.lines > contract.antiGolf.fileSemanticLines) {
      warnings.push(`${file.path} has ${file.lines} semantic lines; max ${contract.antiGolf.fileSemanticLines}`)
    }
    for (const [index, line] of normalizedLines(text).entries()) {
      if (
        line.length > contract.antiGolf.lineLength &&
        !/^\s*(?:https?:\/\/\S+|[a-f0-9]{40,})\s*$/u.test(line)
      ) {
        warnings.push(`${file.path}:${index + 1} exceeds ${contract.antiGolf.lineLength} characters`)
      }
      if ((line.match(/;/gu)?.length ?? 0) > 1) {
        warnings.push(`${file.path}:${index + 1} contains multiple statements`)
      }
    }
    if (!["typescript", "javascript"].includes(file.kind)) continue
    const source = ts.createSourceFile(
      file.path,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    const visit = (node: ts.Node, nesting: number): void => {
      const branch = ts.isIfStatement(node) || ts.isSwitchStatement(node) ||
        ts.isConditionalExpression(node) || ts.isForStatement(node) ||
        ts.isForInStatement(node) || ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isCatchClause(node)
      const nextNesting = nesting + (branch ? 1 : 0)
      if (nextNesting > contract.antiGolf.nesting) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
        warnings.push(`${file.path}:${line} exceeds branch nesting ${contract.antiGolf.nesting}`)
      }
      if (
        ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
      ) {
        const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line
        const end = source.getLineAndCharacterOfPosition(node.getEnd()).line
        if (end - start + 1 > contract.antiGolf.functionSemanticLines) {
          warnings.push(`${file.path}:${start + 1} function exceeds ${contract.antiGolf.functionSemanticLines} lines`)
        }
        let branches = 0
        const countBranches = (child: ts.Node): void => {
          if (
            ts.isIfStatement(child) || ts.isSwitchStatement(child) ||
            ts.isConditionalExpression(child) || ts.isForStatement(child) ||
            ts.isForInStatement(child) || ts.isForOfStatement(child) ||
            ts.isWhileStatement(child) || ts.isDoStatement(child) || ts.isCatchClause(child)
          ) {
            branches += 1
          }
          ts.forEachChild(child, countBranches)
        }
        countBranches(node)
        if (branches > contract.antiGolf.branchCount) {
          warnings.push(`${file.path}:${start + 1} function has ${branches} branches`)
        }
      }
      ts.forEachChild(node, (child) => visit(child, nextNesting))
    }
    visit(source, 0)
    if (/\bany\b/u.test(text)) warnings.push(`${file.path} contains forbidden any`)
    if (/@ts-ignore/u.test(text)) warnings.push(`${file.path} contains forbidden @ts-ignore`)
    if (/\bas\s+unknown\s+as\b/u.test(text)) {
      warnings.push(`${file.path} contains forbidden as unknown as`)
    }
  }
  return warnings
}

const decodeContract = async (root: string): Promise<{
  readonly contract: SourceBudgetContract
  readonly hash: string
}> => {
  const parsed = parseStrictJson(await readFile(resolve(root, CONTRACT_PATH), "utf8"))
  const value = expectObject(parsed, "source budget contract")
  return {
    contract: value as unknown as SourceBudgetContract,
    hash: canonicalJsonHash(value)
  }
}

const familyList = (values: ReadonlyArray<string>): ReadonlyArray<string> => {
  const families = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  const unique = new Set(families)
  if (unique.size !== families.length) throw new Error("Duplicate --family value.")
  return [...unique].sort()
}

export const countSourceTree = async (
  root: string,
  milestone: string,
  requestedFamilies: ReadonlyArray<string> = []
): Promise<SourceBudgetReport> => {
  const { contract, hash } = await decodeContract(root)
  const budget = contract.milestones[milestone]
  if (budget === undefined) throw new Error(`Unknown source milestone: ${milestone}`)
  const families = familyList(requestedFamilies)
  for (const family of families) {
    if (!(family in contract.familyBanks) && family !== "baseline" && family !== "changelog") {
      throw new Error(`Unknown source family: ${family}`)
    }
  }
  const warnings: Array<string> = []
  const exclusions: Array<{ readonly path: string; readonly reason: string }> = []
  const files: Array<CountedSourceFile> = []
  const generated = new Map(contract.generatedWitnesses.map((witness) => [witness.output, witness]))
  for (const path of trackedPaths(root)) {
    if (
      path.startsWith("node_modules/") || path.startsWith("vendor/") ||
      path.startsWith(".agent-sources/") || path.startsWith(".repos/")
    ) {
      exclusions.push({ path, reason: "dependency or local research checkout" })
      continue
    }
    if (isGeneratedArtifactExample(path)) {
      exclusions.push({ path, reason: "generated example output" })
      continue
    }
    const witness = generated.get(path)
    if (witness !== undefined) {
      const [outputText, generatorExists] = await Promise.all([
        readFile(resolve(root, path), "utf8"),
        Bun.file(resolve(root, witness.generator)).exists()
      ])
      if (!generatorExists || !outputText.includes(witness.generatedMarker)) {
        warnings.push(`${path}: invalid generated-output witness`)
      }
      exclusions.push({
        path,
        reason: `generated by ${witness.generator}; checked by ${witness.checkCommand}`
      })
      continue
    }
    let bytes: Uint8Array
    try {
      bytes = await readFile(resolve(root, path))
    } catch (error) {
      warnings.push(`${path}: cannot read maintained file: ${String(error)}`)
      continue
    }
    if (bytes.includes(0)) {
      exclusions.push({ path, reason: "binary maintained file" })
      continue
    }
    let text: string
    try {
      text = textDecoder.decode(bytes)
    } catch {
      exclusions.push({ path, reason: "non-UTF-8 maintained file" })
      continue
    }
    const lane = laneFor(path)
    const kind = kindFor(path)
    if (lane === "product" && kind.startsWith("text:")) {
      warnings.push(`${path}: unknown extension under shipped roots`)
    }
    files.push({
      path,
      lane,
      kind,
      lines: countSemanticLines(path, text),
      module: moduleFor(path),
      ...(lane === "product" ? { role: roleFor(path) } : {})
    })
  }
  warnings.push(...importWarnings(root, files, contract.excludedImportRoots))
  warnings.push(...antiGolfWarnings(root, files, contract, milestone))
  const totals = aggregate(files, (file) => file.lane) as Readonly<Record<SourceLane, number>>
  const product = totals.product ?? 0
  const oracle = totals.oracle ?? 0
  if (budget.productMode === "exact" && product !== budget.product) {
    warnings.push(`Product is ${product}; ${milestone} requires exactly ${budget.product}`)
  }
  if (budget.productMode === "ceiling" && product > budget.product) {
    warnings.push(`Product is ${product}; ${milestone} ceiling is ${budget.product}`)
  }
  if (oracle > budget.oracle) warnings.push(`Oracle is ${oracle}; ${milestone} ceiling is ${budget.oracle}`)
  const byRole = aggregate(files, (file) => file.role)
  const familyBudget = await familyBudgetSummary(
    root,
    families,
    product,
    oracle,
    contract,
    warnings
  )
  const slices = temporarySlices(files, milestone)
  for (const [name, ceiling] of Object.entries(contract.temporarySliceCeilings[milestone] ?? {})) {
    if ((slices[name] ?? 0) > ceiling) warnings.push(`${milestone} slice ${name} exceeds ${ceiling}`)
  }
  const publicBridges = rewritePublicBridges(root, files)
  if (milestone === "M2" && publicBridges.length > 0) {
    warnings.push(`M2 requires zero public bridges; found ${publicBridges.length}`)
  }
  if (milestone === "M0") {
    for (const [role, expected] of Object.entries(contract.opening.roles)) {
      if (byRole[role] !== expected) {
        warnings.push(`M0 role ${role} is ${byRole[role] ?? 0}; expected ${expected}`)
      }
    }
  }
  if (milestone === "M6") {
    for (const [role, ceiling] of Object.entries(contract.m6RoleCeilings)) {
      if ((byRole[role] ?? 0) > ceiling) {
        warnings.push(`${milestone} role ${role} exceeds ${ceiling}`)
      }
    }
  }
  return {
    schemaVersion: "semantic-source-report/v2",
    policyVersion: contract.policyVersion,
    policyHash: hash,
    milestone,
    families,
    openingOracle: contract.opening.oracle,
    totals: {
      examples: totals.examples ?? 0,
      oracle,
      product,
      tooling: totals.tooling ?? 0
    },
    byKind: aggregate(files, (file) => `${file.lane}/${file.kind}`),
    byRole,
    byModule: aggregate(files, (file) => `${file.lane}/${file.module}`),
    temporarySlices: slices,
    familySummary: familyBudget.families,
    ...(familyBudget.wave === undefined ? {} : { waveSummary: familyBudget.wave }),
    publicBridges,
    files,
    exclusions: exclusions.sort((left, right) => left.path.localeCompare(right.path)),
    warnings: [...new Set(warnings)].sort()
  }
}

interface HistoryEntry {
  readonly schemaVersion: string
  readonly kind: "implementation-key" | "milestone"
  readonly reportHash: string
  readonly priorReportHash: string | null
  readonly commit: string
  readonly tree: string
  readonly manifestHash: string
  readonly policyHash: string
  readonly profileLockHash?: string | undefined
  readonly family: string | null
  readonly implementationKey: string | null
  readonly ownerRowId: string | null
  readonly product: number
  readonly roles: Readonly<Record<string, number>>
  readonly files: Readonly<Record<string, number>>
  readonly grossAdded: number
  readonly grossDeleted: number
  readonly moves: ReadonlyArray<{ readonly from: string; readonly to: string; readonly lines: number }>
  readonly net: number
}

const profileLockHash = async (root: string, family: string): Promise<string> => {
  const lockPath = PROFILE_LOCK_PATH_BY_FAMILY[family]
  if (lockPath === undefined) throw new Error(`${family}: no profile lock is registered.`)
  const lock = expectObject(parseStrictJson(await readFile(
    resolve(root, lockPath),
    "utf8"
  )), `${family} profile lock`)
  if (
    typeof lock.fixture !== "string" || typeof lock.fixtureHash !== "string" ||
    typeof lock.configFixture !== "string" || typeof lock.configFixtureHash !== "string"
  ) {
    throw new Error(`${family} profile lock is incomplete.`)
  }
  const fixture = parseStrictJson(await readFile(resolve(root, lock.fixture), "utf8"))
  if (canonicalJsonHash(fixture) !== lock.fixtureHash) {
    throw new Error(`${family} contract fixture changed after its profile lock.`)
  }
  const configFixture = parseStrictJson(await readFile(resolve(root, lock.configFixture), "utf8"))
  if (canonicalJsonHash(configFixture) !== lock.configFixtureHash) {
    throw new Error(`${family} config fixture changed after its profile lock.`)
  }
  return canonicalJsonHash(lock)
}

interface MarginalCeilings {
  readonly median: number
  readonly p90: number
  readonly maximum: number
}

const percentile = (values: ReadonlyArray<number>, percentage: number): number =>
  values.length === 0 ? 0 : values[Math.ceil(values.length * percentage) - 1]!

const marginalStats = (
  entries: ReadonlyArray<HistoryEntry>,
  ceilings: MarginalCeilings
): SourceBudgetReport["familySummary"][string]["marginal"] => {
  const values = entries.map((entry) => entry.grossAdded).sort((left, right) => left - right)
  const middle = Math.floor(values.length / 2)
  const median = values.length === 0
    ? 0
    : values.length % 2 === 0
    ? Math.ceil((values[middle - 1]! + values[middle]!) / 2)
    : values[middle]!
  return {
    count: values.length,
    median,
    p90: percentile(values, 0.9),
    maximum: values.at(-1) ?? 0,
    ceilings
  }
}

const reportSource = async (root: string, path: string): Promise<{
  readonly product: number
  readonly oracle: number
}> => {
  const report = expectObject(parseStrictJson(await readFile(resolve(root, path), "utf8")), path)
  const summary = expectObject(report.sourceSummary ?? null, `${path} sourceSummary`)
  if (typeof summary.product !== "number" || typeof summary.oracle !== "number") {
    throw new Error(`${path}: source summary is incomplete.`)
  }
  return { product: summary.product, oracle: summary.oracle }
}

const familyBudgetSummary = async (
  root: string,
  families: ReadonlyArray<string>,
  product: number,
  oracle: number,
  contract: SourceBudgetContract,
  warnings: Array<string>
): Promise<{
  readonly families: SourceBudgetReport["familySummary"]
  readonly wave?: SourceBudgetReport["waveSummary"]
}> => {
  if (families.length === 0) return { families: {} }
  const history = await verifySourceHistory(root)
  const latest = history.at(-1)
  const highest = families.reduce((selected, family) =>
    familyOrder.indexOf(family as typeof familyOrder[number]) >
      familyOrder.indexOf(selected as typeof familyOrder[number]) ? family : selected
  )
  const waveName = highest === "changelog" || highest === "announce" ? "announce-changelog" : highest
  const predecessorPath = predecessorReportByFamily[waveName]!
  const predecessor = await reportSource(root, predecessorPath)
  const completedPath = completionReportByFamily[waveName]!
  const measured = latest?.family !== highest && existsSync(resolve(root, completedPath))
    ? await reportSource(root, completedPath)
    : { product, oracle }
  if (latest === undefined || latest.product < product) {
    warnings.push(`Product ${product} exceeds source-history head ${latest?.product ?? "missing"}`)
  }
  const summaries: Record<string, SourceBudgetReport["familySummary"][string]> = {}
  for (const family of families) {
    const entries = history.filter((entry) => entry.family === family)
    const ceilings = contract.marginalFamilyCeilings?.[family] ?? contract.marginalKeyCeilings
    const marginal = marginalStats(entries, ceilings)
    const productBank = contract.familyBanks[family]!
    const productDelta = families.length === 1
      ? measured.product - predecessor.product
      : entries.reduce((total, entry) => total + entry.net, 0)
    summaries[family] = { productDelta, productBank, marginal }
    if (entries.length === 0) warnings.push(`${family} has no source-history implementation keys`)
    if (productDelta > productBank) {
      warnings.push(`${family} Product delta is ${productDelta}; bank is ${productBank}`)
    }
    if (marginal.median > ceilings.median) {
      warnings.push(`${family} marginal median is ${marginal.median}; ceiling is ${ceilings.median}`)
    }
    if (marginal.p90 > ceilings.p90) {
      warnings.push(`${family} marginal p90 is ${marginal.p90}; ceiling is ${ceilings.p90}`)
    }
    if (marginal.maximum > ceilings.maximum) {
      warnings.push(`${family} marginal maximum is ${marginal.maximum}; ceiling is ${ceilings.maximum}`)
    }
  }
  const wave = contract.waves.find((candidate) => candidate.name === waveName)
  if (wave === undefined) throw new Error(`Missing source wave: ${waveName}`)
  const oracleBank = contract.oracleFamilyBanks[waveName]!
  const oracleDelta = measured.oracle - predecessor.oracle
  if (measured.product > wave.product) {
    warnings.push(`${waveName} Product is ${measured.product}; ceiling is ${wave.product}`)
  }
  if (oracleDelta > oracleBank) {
    warnings.push(`${waveName} Oracle delta is ${oracleDelta}; bank is ${oracleBank}`)
  }
  if (measured.oracle > wave.oracle) {
    warnings.push(`${waveName} Oracle is ${measured.oracle}; ceiling is ${wave.oracle}`)
  }
  return {
    families: summaries,
    wave: {
      name: waveName,
      productCeiling: wave.product,
      oracleDelta,
      oracleBank,
      oracleCeiling: wave.oracle
    }
  }
}

const historyFiles = (root: string): ReadonlyArray<string> => {
  const result = run(root, ["git", "ls-files", "-z", `${HISTORY_ROOT}/*.json`])
  if (result.exitCode !== 0) return []
  const rank = (path: string): number =>
    path.endsWith("/m0.json") ? 0 : path.endsWith("/m6.json") ? 1 : 2
  return result.stdout.split("\0").filter((path) => path.length > 0).sort((left, right) =>
    rank(left) - rank(right) || left.localeCompare(right))
}

const withoutReportHash = (entry: HistoryEntry): Omit<HistoryEntry, "reportHash"> => {
  const { reportHash: _reportHash, ...rest } = entry
  return rest
}

export const verifySourceHistory = async (
  root: string
): Promise<ReadonlyArray<HistoryEntry>> => {
  const entries: Array<HistoryEntry> = []
  let prior: string | null = null
  const seenKeys = new Set<string>()
  for (const path of historyFiles(root)) {
    const value = expectObject(parseStrictJson(await readFile(resolve(root, path), "utf8")), path)
    const entry = value as unknown as HistoryEntry
    const calculated = canonicalJsonHash(withoutReportHash(entry))
    if (entry.reportHash !== calculated) throw new Error(`${path}: report hash mismatch.`)
    if (entry.priorReportHash !== prior) throw new Error(`${path}: history link mismatch.`)
    if (entry.implementationKey !== null) {
      if (seenKeys.has(entry.implementationKey)) throw new Error(`${path}: reused implementation key.`)
      seenKeys.add(entry.implementationKey)
    }
    const lockPath = entry.family === null ? undefined : PROFILE_LOCK_PATH_BY_FAMILY[entry.family]
    if (entry.family !== null && lockPath !== undefined) {
      const currentLockHash = await profileLockHash(root, entry.family)
      if (entry.profileLockHash !== currentLockHash) {
        throw new Error(`${path}: ${entry.family} profile lock changed after product implementation.`)
      }
      const committedLock = run(root, [
        "git", "show", `${entry.commit}:${lockPath}`
      ])
      if (committedLock.exitCode !== 0) {
        throw new Error(`${path}: ${entry.family} profile lock does not predate implementation.`)
      }
      if (canonicalJsonHash(parseStrictJson(committedLock.stdout)) !== entry.profileLockHash) {
        throw new Error(`${path}: ${entry.family} profile lock was not frozen at the implementation commit.`)
      }
    }
    prior = entry.reportHash
    entries.push(entry)
  }
  return entries
}

const manifestOwnership = async (
  root: string,
  key: string
): Promise<{ readonly family: string; readonly ownerRowId: string }> => {
  const parsed = expectObject(
    parseStrictJson(await readFile(resolve(root, MANIFEST_PATH), "utf8")),
    "parity manifest"
  )
  const rows = parsed.rows
  if (!Array.isArray(rows)) throw new Error("Parity manifest rows are absent.")
  const owners: Array<{ readonly family: string; readonly ownerRowId: string }> = []
  for (const item of rows) {
    const row = expectObject(item, "parity row")
    if (!Array.isArray(row.implementationKeys)) continue
    for (const keyValue of row.implementationKeys) {
      const declared = expectObject(keyValue, "implementation key")
      if (declared.key === key && declared.role === "owner" && typeof row.family === "string") {
        owners.push({ family: row.family, ownerRowId: String(row.id) })
      }
    }
  }
  if (owners.length !== 1) throw new Error(`${key}: expected exactly one manifest owner.`)
  return owners[0]!
}

const productAtTree = async (
  root: string,
  revision: string
): Promise<ReadonlyMap<string, { readonly text: string; readonly lines: number }>> => {
  const paths = git(root, ["ls-tree", "-rz", "--name-only", revision])
    .split("\0")
    .filter((path) => path.length > 0 && isProduct(path))
  const files = new Map<string, { readonly text: string; readonly lines: number }>()
  for (const path of paths) {
    const result = run(root, ["git", "show", `${revision}:${path}`])
    if (result.exitCode !== 0 || result.stdout.includes("\0")) continue
    files.set(path, { text: result.stdout, lines: countSemanticLines(path, result.stdout) })
  }
  return files
}

const sourceDelta = async (
  root: string,
  priorCommit: string,
  currentCommit: string
): Promise<{
  readonly added: number
  readonly deleted: number
  readonly moves: ReadonlyArray<{ readonly from: string; readonly to: string; readonly lines: number }>
}> => {
  const [before, after] = await Promise.all([
    productAtTree(root, priorCommit),
    productAtTree(root, currentCommit)
  ])
  const deleted = [...before.keys()].filter((path) => !after.has(path))
  const added = [...after.keys()].filter((path) => !before.has(path))
  const moves: Array<{ readonly from: string; readonly to: string; readonly lines: number }> = []
  const movedFrom = new Set<string>()
  const movedTo = new Set<string>()
  for (const from of deleted) {
    const old = before.get(from)!
    const to = added.find((candidate) => !movedTo.has(candidate) && after.get(candidate)!.text === old.text)
    if (to !== undefined) {
      moves.push({ from, to, lines: old.lines })
      movedFrom.add(from)
      movedTo.add(to)
    }
  }
  let grossAdded = 0
  let grossDeleted = 0
  const paths = new Set([...before.keys(), ...after.keys()])
  for (const path of paths) {
    if (movedFrom.has(path) || movedTo.has(path)) continue
    const oldLines = before.get(path)?.lines ?? 0
    const newLines = after.get(path)?.lines ?? 0
    if (newLines >= oldLines) grossAdded += newLines - oldLines
    else grossDeleted += oldLines - newLines
  }
  return { added: grossAdded, deleted: grossDeleted, moves }
}

export const recordImplementationKey = async (
  root: string,
  key: string
): Promise<string> => {
  const dirty = git(root, ["status", "--porcelain", "--untracked-files=all"]).trim()
  if (dirty !== "") throw new Error("--record-key refuses a dirty worktree.")
  const history = await verifySourceHistory(root)
  const prior = history.at(-1)
  if (prior === undefined) throw new Error("--record-key requires a prior source-history report.")
  const isM6 = key === "M6"
  if (!isM6 && history.some((entry) => entry.implementationKey === key)) {
    throw new Error(`Implementation key already recorded: ${key}`)
  }
  const owner = isM6 ? undefined : await manifestOwnership(root, key)
  const currentCommit = git(root, ["rev-parse", "HEAD"]).trim()
  const currentTree = git(root, ["rev-parse", "HEAD^{tree}"]).trim()
  if (currentCommit === prior.commit) throw new Error("--record-key requires a new clean commit.")
  const manifest = parseStrictJson(await readFile(resolve(root, MANIFEST_PATH), "utf8"))
  const report = await countSourceTree(
    root,
    isM6 ? "M6" : "PARITY",
    owner === undefined ? [] : [owner.family]
  )
  const delta = await sourceDelta(root, prior.commit, currentCommit)
  const lockedFamily = owner?.family === undefined
    ? undefined
    : PROFILE_LOCK_PATH_BY_FAMILY[owner.family]
  const lockedProfileHash = lockedFamily === undefined || owner === undefined
    ? undefined
    : await profileLockHash(root, owner.family)
  const entryWithoutHash = {
    schemaVersion: "semantic-source-history/v1",
    kind: isM6 ? "milestone" as const : "implementation-key" as const,
    priorReportHash: prior.reportHash,
    commit: currentCommit,
    tree: currentTree,
    manifestHash: canonicalJsonHash(manifest),
    policyHash: report.policyHash,
    ...(lockedProfileHash === undefined ? {} : { profileLockHash: lockedProfileHash }),
    family: owner?.family ?? null,
    implementationKey: isM6 ? null : key,
    ownerRowId: owner?.ownerRowId ?? null,
    product: report.totals.product,
    roles: report.byRole,
    files: Object.fromEntries(
      report.files.filter((file) => file.lane === "product").map((file) => [file.path, file.lines])
    ),
    grossAdded: delta.added,
    grossDeleted: delta.deleted,
    moves: delta.moves,
    net: delta.added - delta.deleted
  }
  const entry: HistoryEntry = {
    ...entryWithoutHash,
    reportHash: canonicalJsonHash(entryWithoutHash)
  }
  const name = key.replaceAll("/", "__")
  const target = resolve(root, HISTORY_ROOT,
    isM6 ? "m6.json" : `${String(history.length).padStart(3, "0")}-${name}.json`)
  if (existsSync(target)) throw new Error(`Source-history target already exists: ${target}`)
  await writeFile(target, encodeCanonicalJson(entry))
  return toPosix(relative(root, target))
}

export const sourceBudgetContractHash = async (root: string): Promise<string> =>
  (await decodeContract(root)).hash

export const sourceHistoryHeadHash = async (root: string): Promise<string | null> =>
  (await verifySourceHistory(root)).at(-1)?.reportHash ?? null
