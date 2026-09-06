import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import ts from "typescript"
import { writeRecords } from "./records.js"

// Read-only immutable-source census. Counts declarations, not a certification
// that an old package's emitted declarations compiled against today's Effect.
const root = resolve(import.meta.dir, "../..")
const output = join(root, "docs/refactor/architecture-program/handoff/baseline-inventory.json")
const git = (args: string[]) => execFileSync("git", args, { cwd: root, maxBuffer: 64 * 1024 * 1024 })
const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const lines = (bytes: Buffer) => bytes.length === 0 ? 0 : bytes.filter((byte) => byte === 10).length + (bytes.at(-1) === 10 ? 0 : 1)
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
const coordinates = [
  ["pr21", "887a9fe2b35590f3088ffeee84f32722796e03ab"],
  ["pr22", "c2ac4ee4e7f02d74a7a1ff435bdfeaca6890b720"],
  ["overlay", "2ef7a9a61fe40608d053569cbcd71e40fca5c181"],
  ["current", "9b14c6c14aec5c5a41b2cb0f98d6f1c63bca4d3d"]
] as const

function declarations(source: ts.SourceFile) {
  const output: Array<{ name: string; kind: string; line: number; sha256: string }> = []
  for (const statement of source.statements) {
    const name = "name" in statement && statement.name && ts.isIdentifier(statement.name as ts.Node)
      ? (statement.name as ts.Identifier).text : undefined
    if (name) output.push({ name, kind: ts.SyntaxKind[statement.kind]!, line: source.getLineAndCharacterOfPosition(statement.getStart()).line + 1, sha256: sha256(statement.getText()) })
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) output.push({ name: declaration.name.text, kind: "VariableDeclaration", line: source.getLineAndCharacterOfPosition(declaration.getStart()).line + 1, sha256: sha256(declaration.getText()) })
    }
  }
  return output
}

const snapshots = coordinates.map(([id, commit]) => {
  const tree = git(["rev-parse", `${commit}^{tree}`]).toString().trim()
  const paths = git(["ls-tree", "-r", "--name-only", commit]).toString().trim().split("\n")
  const product = paths.filter((path) => /\.(ts|tsx|js|mjs|cjs)$/.test(path) &&
    (path.startsWith("src/") || /^apps\/[^/]+\/src\//.test(path)))
  const files = product.map((path) => {
    const bytes = git(["show", `${commit}:${path}`])
    const source = ts.createSourceFile(path, bytes.toString(), ts.ScriptTarget.Latest, true)
    const formats: Array<{ value: string; line: number }> = []
    const visit = (node: ts.Node) => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /\/(?:v)?\d+$/.test(node.text)) {
        formats.push({ value: node.text, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 })
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    return { path, bytes: bytes.length, lines: lines(bytes), printerNormalizedLines: printer.printFile(source).trimEnd().split("\n").length, sha256: sha256(bytes), declarations: declarations(source), versionLiterals: formats }
  })
  const directory = mkdtempSync(join(tmpdir(), "ts-release-inventory-"))
  try {
    execFileSync("tar", ["-x", "-C", directory], { input: git(["archive", commit, "src", "apps", "package.json"]), maxBuffer: 64 * 1024 * 1024 })
    symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), "dir")
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"))
    const entries: Array<{ subpath: string; path: string }> = []
    const target = (value: unknown): string | undefined => typeof value === "string" ? value :
      value && typeof value === "object" ? target((value as any).types ?? (value as any).default ?? Object.values(value)[0]) : undefined
    for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
      const emitted = target(value)
      if (!emitted) throw new Error(`No export target ${id}:${subpath}`)
      const candidate = emitted.replace(/^\.\/dist\//, "src/").replace(/\.d\.ts$/, ".ts").replace(/\.(?:m?js)$/, ".ts")
      if (!existsSync(join(directory, candidate))) throw new Error(`No source for export ${id}:${subpath}:${candidate}`)
      entries.push({ subpath, path: candidate })
    }
    const program = ts.createProgram(entries.map((entry) => join(directory, entry.path)), {
      module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022, skipLibCheck: true, noEmit: true
    })
    const checker = program.getTypeChecker()
    const surfaces = entries.map((entry) => {
      const source = program.getSourceFile(join(directory, entry.path))!
      const module = checker.getSymbolAtLocation(source)
      if (!module) throw new Error(`No module ${id}:${entry.path}`)
      const symbols = checker.getExportsOfModule(module).map((symbol) => {
        const original = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
        const declarations = (original.declarations ?? []).map((declaration) => {
          const file = declaration.getSourceFile()
          return { path: file.fileName.startsWith(directory + "/") ? file.fileName.slice(directory.length + 1) : "external-dependency",
            line: file.getLineAndCharacterOfPosition(declaration.getStart()).line + 1,
            sha256: sha256(declaration.getText()) }
        })
        const members = original.flags & ts.SymbolFlags.Namespace ? checker.getExportsOfModule(original).map((member) => member.getName()).sort() : []
        return { name: symbol.getName(), runtime: Boolean(original.flags & ts.SymbolFlags.Value), declaration: true, members, declarations }
      }).sort((a, b) => a.name.localeCompare(b.name))
      return { ...entry, symbols }
    })
    return { id, commit, tree, files, surfaces, bin: manifest.bin ?? {},
      physicalProductLines: files.reduce((total, file) => total + file.lines, 0),
      printerNormalizedProductLines: files.reduce((total, file) => total + file.printerNormalizedLines, 0),
      symbolEntries: surfaces.reduce((total, surface) => total + surface.symbols.length, 0) }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
const reference = JSON.parse(readFileSync(join(root, "advisor-plans/evidence/v1-reference-manifest.json"), "utf8"))
const result = {
  format: "ts-release/architecture-source-inventory/1",
  method: "Immutable Git blobs; physical UTF-8 newline count including comments/blanks; top-level source declarations and resolved public source exports; generated delivery excluded",
  normalization: { typescript: ts.version, method: "TypeScript printer, LF, comments retained; separate diagnostic, not a replacement for physical budgets" },
  snapshots,
  historicalFormats: reference.durableFormats,
  baselineDenominator: { productSource: 22916, generatedProductPolicy: 55, total: 22971, halfFloor: 11485 }
}
mkdirSync(dirname(output), { recursive: true })
const encoded = JSON.stringify(result, null, 2) + "\n"
writeRecords(output, encoded, {
  method: result.method, normalization: result.normalization, baselineDenominator: result.baselineDenominator,
  snapshots: snapshots.map(({id, commit, tree, files, surfaces, bin, physicalProductLines, printerNormalizedProductLines, symbolEntries}) => ({id, commit, tree, files: files.length, surfaces: surfaces.length, bin, physicalProductLines, printerNormalizedProductLines, symbolEntries}))
}, process.argv.includes("--check"))
console.log(JSON.stringify(snapshots.map(({ id, files, physicalProductLines, symbolEntries }) => ({ id, files: files.length, physicalProductLines, symbolEntries }))))
