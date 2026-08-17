import { spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../../../..")
const fixture = join(here, "fixture")

const now = () => Number(process.hrtime.bigint()) / 1_000_000
const rounded = (value) => Math.round(value * 100) / 100
const run = (command, args, options = {}) => {
  const start = now()
  const result = spawnSync(command, args, { cwd: options.cwd ?? repoRoot, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", ...options.env }, maxBuffer: 32 * 1024 * 1024 })
  return { command: [command, ...args].join(" "), milliseconds: rounded(now() - start), status: result.status, signal: result.signal, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
}
const twice = (command, args, options) => ({ cold: run(command, args, options), warm: run(command, args, options) })

const walk = async (root) => {
  const output = []
  const visit = async (path) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (["node_modules", "dist", "build", "coverage", ".git"].includes(entry.name)) continue
      const next = join(path, entry.name)
      if (entry.isDirectory()) await visit(next)
      else if (entry.isFile() && /\.(?:ts|tsx|mts|cts)$/.test(entry.name)) output.push(next)
    }
  }
  await visit(root)
  return output
}
const scopeOf = (path) => {
  const name = relative(repoRoot, path).replaceAll("\\", "/")
  if (name.startsWith("src/")) return "library"
  if (name.startsWith("apps/")) return "application"
  if (name.startsWith("scripts/")) return "script"
  if (name.startsWith("test/") || name.includes("/test/")) return "test"
  return "other"
}
const propertyPath = (node) => {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) { const left = propertyPath(node.expression); return left === undefined ? undefined : `${left}.${node.name.text}` }
  return undefined
}
const inventory = async () => {
  const roots = ["src", "apps", "scripts", "test"].map((path) => join(repoRoot, path))
  const files = (await Promise.all(roots.map(walk))).flat()
  const patterns = new Map(); const examples = new Map()
  const add = (key, scope, file, node) => {
    const record = patterns.get(key) ?? { total: 0, scopes: {} }; record.total += 1; record.scopes[scope] = (record.scopes[scope] ?? 0) + 1; patterns.set(key, record)
    const list = examples.get(key) ?? []
    if (list.length < 5) { const source = node.getSourceFile(); const position = source.getLineAndCharacterOfPosition(node.getStart(source)); list.push(`${relative(repoRoot, file).replaceAll("\\", "/")}:${position.line + 1}`); examples.set(key, list) }
  }
  for (const file of files) {
    const sourceText = await readFile(file, "utf8"); const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true); const scope = scopeOf(file)
    const visit = (node) => {
      if (ts.isFunctionLike(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) add("async-function", scope, file, node)
      if (ts.isTryStatement(node)) add("try-statement", scope, file, node)
      if (ts.isNonNullExpression(node)) add("non-null-assertion", scope, file, node)
      if (ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.AnyKeyword) add("as-any", scope, file, node)
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) { const specifier = node.moduleSpecifier.text; if (specifier === "effect") add("effect-barrel-import", scope, file, node); if (specifier.startsWith("node:fs")) add("node-fs-import", scope, file, node); if (specifier.startsWith("node:child_process")) add("node-child-process-import", scope, file, node) }
      if (ts.isPropertyAccessExpression(node)) { const path = propertyPath(node); if (path?.startsWith("process.env")) add("process-env", scope, file, node); if (path?.startsWith("console.")) add("console", scope, file, node); if (path === "Date.now") add("date-now", scope, file, node) }
      if (ts.isNewExpression(node)) { const path = propertyPath(node.expression); if (path === "Date") add("new-date", scope, file, node); if (path === "Promise") add("new-promise", scope, file, node) }
      if (ts.isCallExpression(node)) { const path = propertyPath(node.expression); if (path === "fetch") add("global-fetch", scope, file, node); if (path === "setTimeout" || path === "setInterval") add("global-timer", scope, file, node); if (path?.startsWith("Effect.run")) add("effect-run", scope, file, node); if (path === "Effect.provide") add("effect-provide", scope, file, node); if (path === "Effect.catchAll") add("effect-catch-all", scope, file, node); if (path === "Effect.orDie") add("effect-or-die", scope, file, node) }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return { files: files.length, patterns: Object.fromEntries([...patterns].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, { ...value, examples: examples.get(key) ?? [] }])) }
}
const compileProgram = async (name, files, options) => {
  const root = await mkdtemp(join(tmpdir(), `ts-release-tsconfig-${name}-`))
  try {
    await writeFile(join(root, "package.json"), '{"type":"module"}\n')
    for (const [path, content] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content) }
    const output = new Map(); const program = ts.createProgram({ rootNames: Object.keys(files).filter((path) => path.endsWith(".ts")).map((path) => join(root, path)), options: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, skipLibCheck: true, outDir: join(root, "dist"), ...options } })
    const emit = program.emit(undefined, (path, content) => output.set(relative(root, path).replaceAll("\\", "/"), content)); const diagnostics = ts.getPreEmitDiagnostics(program).concat(emit.diagnostics)
    return { diagnosticCodes: [...new Set(diagnostics.map((diagnostic) => diagnostic.code))].sort((a, b) => a - b), output: Object.fromEntries(output) }
  } finally { await rm(root, { recursive: true, force: true }) }
}
const tsconfigProbe = async () => {
  const verbatim = await compileProgram("verbatim", { "types.ts": "export interface Shape { readonly value: number }\n", "main.ts": 'import { Shape } from "./types.js"\nexport const value: Shape = { value: 1 }\n' }, { verbatimModuleSyntax: true })
  const rewrite = await compileProgram("rewrite", { "dep.ts": 'export const value = "rewritten"\n', "main.ts": 'import { value } from "./dep.ts"\nconsole.log(value)\n' }, { verbatimModuleSyntax: true, rewriteRelativeImportExtensions: true })
  const erasable = await compileProgram("erasable", { "main.ts": "enum Mode { A, B }\nexport const mode = Mode.A\n" }, { erasableSyntaxOnly: true, noEmit: true })
  const sideEffectOn = await compileProgram("side-effect-on", { "main.ts": 'import "missing-side-effect-package"\nexport {}\n' }, { noUncheckedSideEffectImports: true, noEmit: true })
  const sideEffectOff = await compileProgram("side-effect-off", { "main.ts": 'import "missing-side-effect-package"\nexport {}\n' }, { noUncheckedSideEffectImports: false, noEmit: true })
  const detectionAuto = await compileProgram("module-auto", { "a.ts": "const duplicate = 1\n", "b.ts": "const duplicate = 2\n" }, { moduleDetection: ts.ModuleDetectionKind.Auto, noEmit: true })
  const detectionForce = await compileProgram("module-force", { "a.ts": "const duplicate = 1\n", "b.ts": "const duplicate = 2\n" }, { moduleDetection: ts.ModuleDetectionKind.Force, noEmit: true })
  return { verbatimRequiresTypeOnlyImport: verbatim.diagnosticCodes.includes(1484), rewriteEmittedJsSpecifier: Object.values(rewrite.output).some((content) => content.includes('./dep.js')), erasableRejectedEnum: erasable.diagnosticCodes.length > 0, uncheckedSideEffectImport: { enabledHasMissingModuleError: sideEffectOn.diagnosticCodes.includes(2307), disabledHasMissingModuleError: sideEffectOff.diagnosticCodes.includes(2307) }, moduleDetection: { autoHasDuplicateGlobalError: detectionAuto.diagnosticCodes.some((code) => code === 2451), forceHasDuplicateGlobalError: detectionForce.diagnosticCodes.some((code) => code === 2451) } }
}
const summarizeDiagnostics = (text) => { const lines = text.split(/\r?\n/).filter(Boolean); return { lines: lines.length, mentionsFloatingEffect: /floatingEffect|floating effect/i.test(text), mentionsRunInsideEffect: /runEffectInsideEffect|run.*inside.*effect/i.test(text), mentionsBoundary: /boundary\.ts/i.test(text), sample: lines.slice(0, 12) } }
const countUnixDiagnostics = (text) => text.split(/\r?\n/).filter((line) => /:\d+:\d+:/.test(line)).length
const countDprintFiles = (text) => { const match = text.match(/Found (\d+) file(?:s)? not formatted/); if (match) return Number(match[1]); return text.split(/\r?\n/).filter((line) => /\.(?:ts|tsx|js|jsx|json|md)$/.test(line.trim())).length }

export async function runDevelopmentToolingProbe() {
  const scanColdStart = now(); const scanCold = await inventory(); const scanColdMs = rounded(now() - scanColdStart)
  const scanWarmStart = now(); const scanWarm = await inventory(); const scanWarmMs = rounded(now() - scanWarmStart); const config = await tsconfigProbe()
  const tsc = twice("bun", ["x", "tsc", "--project", join(fixture, "tsconfig.json"), "--noEmit"], { cwd: join(here, "..") })
  const languageServiceRoot = await mkdtemp(join(tmpdir(), "ts-release-effect-language-service-")); await writeFile(join(languageServiceRoot, "package.json"), '{"private":true}\n')
  const languageServiceSetup = run("bun", ["add", "--no-save", "@effect/language-service@0.87.0", "typescript@6.0.3"], { cwd: languageServiceRoot })
  const languageServiceBinary = join(languageServiceRoot, "node_modules", ".bin", "effect-language-service")
  const languageServiceArguments = ["diagnostics", "--project", join(fixture, "tsconfig.json"), "--lspconfig", JSON.stringify({ diagnosticSeverity: { floatingEffect: "error", runEffectInsideEffect: "error", tryCatchInEffectGen: "warning", asyncFunction: "warning" } })]
  const languageService = twice(languageServiceBinary, languageServiceArguments, { cwd: join(here, "..") }); await rm(languageServiceRoot, { recursive: true, force: true })
  const oxlint = twice("bun", ["x", "--bun", "oxlint@1.76.0", "--config", join(here, "oxlint.json"), "-f", "unix", "src", "apps", "scripts", "test"], { cwd: repoRoot })
  const dprint = twice("bun", ["x", "--bun", "dprint@0.55.2", "check", "--config", join(here, "dprint.json"), "src", "apps", "scripts", "test", "package.json", "tsconfig.json", "tsconfig.build.json"], { cwd: repoRoot })
  const lsText = `${languageService.warm.stdout}\n${languageService.warm.stderr}`; const oxlintText = `${oxlint.warm.stdout}\n${oxlint.warm.stderr}`; const dprintText = `${dprint.warm.stdout}\n${dprint.warm.stderr}`
  const result = { status: "observed", versions: { typescript: ts.version, effectFixture: "4.0.0-rc.109", languageService: "0.87.0", oxlint: "1.76.0", dprint: "0.55.2" }, inventory: { coldMilliseconds: scanColdMs, warmMilliseconds: scanWarmMs, ...scanWarm }, typescriptConfiguration: config, ordinaryTypeScript: { coldMilliseconds: tsc.cold.milliseconds, warmMilliseconds: tsc.warm.milliseconds, coldStatus: tsc.cold.status, warmStatus: tsc.warm.status }, effectLanguageService: { setupMilliseconds: languageServiceSetup.milliseconds, setupStatus: languageServiceSetup.status, coldMilliseconds: languageService.cold.milliseconds, warmMilliseconds: languageService.warm.milliseconds, coldStatus: languageService.cold.status, warmStatus: languageService.warm.status, diagnostics: summarizeDiagnostics(lsText), compatibilityClaim: "observed against rc.109 fixture; published 0.87.0 harness was beta.94" }, oxlint: { coldMilliseconds: oxlint.cold.milliseconds, warmMilliseconds: oxlint.warm.milliseconds, coldStatus: oxlint.cold.status, warmStatus: oxlint.warm.status, diagnostics: countUnixDiagnostics(oxlintText), sample: oxlintText.split(/\r?\n/).filter(Boolean).slice(0, 12) }, dprint: { coldMilliseconds: dprint.cold.milliseconds, warmMilliseconds: dprint.warm.milliseconds, coldStatus: dprint.cold.status, warmStatus: dprint.warm.status, filesNotFormatted: countDprintFiles(dprintText), sample: dprintText.split(/\r?\n/).filter(Boolean).slice(0, 12) }, limitations: ["candidate inventory counts AST occurrences, not adjudicated violations", "language-service 0.87.0 was source-tested by upstream against Effect beta.94, not rc.109; the CLI probe installs an isolated TypeScript 6.0.3 tool environment explicitly", "bun x cold timings include package and plugin download/cache effects", "Oxlint uses only public standard rules; Effect's @effect/oxc rules are repository-private", "dprint check measures migration shape without changing files", "the fixture does not prove editor integrations beyond the shared language-service diagnostic engine", "the programmatic noUncheckedSideEffectImports fixture did not reproduce the documented CLI distinction and is reported without enforcement", "moduleDetection auto and force did not discriminate because the fixture package is explicitly ESM; the result is reported without enforcement"] }
  if (tsc.warm.status !== 0) throw new Error(`ordinary TypeScript fixture failed: ${tsc.warm.stderr}`)
  if (!result.typescriptConfiguration.verbatimRequiresTypeOnlyImport) throw new Error("verbatimModuleSyntax probe did not reject value import used only as type")
  if (!result.typescriptConfiguration.rewriteEmittedJsSpecifier) throw new Error("rewriteRelativeImportExtensions probe did not emit .js")
  if (!result.typescriptConfiguration.erasableRejectedEnum) throw new Error("erasableSyntaxOnly probe did not reject enum")
  console.log(`DEVELOPMENT_TOOLING_PROBE_RESULT=${JSON.stringify(result)}`); return result
}
