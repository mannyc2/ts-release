import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import ts from "../../../node_modules/typescript/lib/typescript.js"
import { command, dependencies, files, hash, inventory, json, pack, repository, bun } from "./pack.mjs"

const lab = join(repository, "tools/architecture-lab")
export const layouts = {
  T1: { kernel: "@lab/release", npm: "@lab/release/npm", python: "@lab/release/python", providerPackages: ["@lab/release"] },
  T2: { kernel: "@lab/kernel", npm: "@lab/providers/npm", python: "@lab/providers/python", providerPackages: ["@lab/providers"] },
  T3: { kernel: "@lab/kernel", npm: "@lab/npm", python: "@lab/python", providerPackages: ["@lab/npm", "@lab/python"] }
}

const pkg = (name, sources, exports, dependencies, other = {}) => ({ name, sources, exports, dependencies, ...other })

export async function sourceSet(extra = {}) {
  const machine = Object.fromEntries(await Promise.all((await files(join(lab, "machine/src")))
    .filter((path) => path.endsWith(".ts")).map(async (path) => [path, await readFile(join(lab, "machine/src", path), "utf8")])))
  const own = Object.fromEntries(await Promise.all((await files(join(lab, "topology/src")))
    .filter((path) => path.endsWith(".ts")).map(async (path) => [path, await readFile(join(lab, "topology/src", path), "utf8")])))
  const storage = Object.fromEntries(await Promise.all(["protocol.ts", "sqlite.ts", "git.ts"].map(async (path) =>
    [`storage/${path}`, (await readFile(join(lab, "storage", path), "utf8"))
      .replaceAll("../machine/src/contracts.js", "@lab/kernel").replaceAll("../machine/src/identity.js", "@lab/kernel")])))
  const adoption = Object.fromEntries(await Promise.all(["adoption.ts", "content-owner.ts", "bundle-codec.ts"].map(async (path) =>
    [`adoption/${path}`, await readFile(join(lab, "apple", path), "utf8")])))
  return { machine, own, storage, adoption, ...extra }
}

export function specification(layoutId, source) {
  const layout = layouts[layoutId]
  const core = Object.fromEntries(Object.entries(source.machine).map(([name, text]) => [layoutId === "T1" ? `kernel/${name}` : name, text]))
  const values = []
  if (layoutId === "T1") {
    values.push(pkg(layout.kernel, {
      ...core, "index.ts": 'export * from "./kernel/index.js"\n',
      "providers/npm.ts": source.own["npm.ts"], "providers/python.ts": source.own["python.ts"],
      ...(source.own["http-evidence.ts"] ? {"providers/http-evidence.ts":source.own["http-evidence.ts"]} : {}),
      ...(source.own["npm-owned.ts"] ? {"providers/npm-owned.ts":source.own["npm-owned.ts"]} : {})
    }, { ".": "index", "./npm": "providers/npm", "./npm/owned": "providers/npm-owned", "./python": "providers/python" }, { effect: "4.0.0-rc.108" }))
  } else {
    values.push(pkg(layout.kernel, core, { ".": "index" }, { effect: "4.0.0-rc.108" }))
    if (layoutId === "T2") values.push(pkg("@lab/providers", { "npm.ts": source.own["npm.ts"], "python.ts": source.own["python.ts"],...(source.own["http-evidence.ts"]?{"http-evidence.ts":source.own["http-evidence.ts"]}:{}),...(source.own["npm-owned.ts"]?{"npm-owned.ts":source.own["npm-owned.ts"]}:{}) },
      { "./npm": "npm", "./npm/owned": "npm-owned", "./python": "python" }, { effect: "4.0.0-rc.108", [layout.kernel]: "1.0.0-lab" }))
    else for (const name of ["npm", "python"]) values.push(pkg(`@lab/${name}`, { "index.ts": source.own[`${name}.ts`],...(source.own["http-evidence.ts"]?{"http-evidence.ts":source.own["http-evidence.ts"]}:{}),...(name==="npm"&&source.own["npm-owned.ts"]?{"npm-owned.ts":source.own["npm-owned.ts"].replaceAll('"./npm.js"','"./index.js"')}:{}) },
      { ".": "index",...(name==="npm"?{"./owned":"npm-owned"}:{}) }, { effect: "4.0.0-rc.108", [layout.kernel]: "1.0.0-lab" }))
  }
  values.push(pkg("@lab/host", {
    "host.ts": source.own["host.ts"], "cli.ts": source.own["cli.ts"], "http.ts": source.own["http.ts"],
    ...source.storage, ...source.adoption
  }, { ".": "host", "./http": "http", "./sqlite": "storage/sqlite", "./git": "storage/git", "./adoption": "adoption/adoption", "./content-owner": "adoption/content-owner",...(source.adoption["adoption/bundle-codec.ts"]?{"./bundle-codec":"adoption/bundle-codec"}:{}) },
  { effect: "4.0.0-rc.108", "effect-build": "0.6.0", [layout.kernel]: "1.0.0-lab" }, { private: true, bin: { "release-lab": "./dist/cli.js" } }))
  return values
}

function moduleImports(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const found = []
  const add = (specifier, kind) => found.push({ specifier, kind })
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const isType = node.isTypeOnly || node.importClause?.isTypeOnly
        add(node.moduleSpecifier.text, isType ? "type" : "static")
      }
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) add(node.argument.literal.text, "import-type")
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : "<application-selected>", "dynamic")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

export async function buildPackage(spec, layout, work, built, upstreamRoot) {
  const root = join(work, "packages", spec.name.replaceAll("@", "").replaceAll("/", "-"))
  await mkdir(join(root, "src"), { recursive: true })
  await mkdir(join(root, "node_modules"), { recursive: true })
  for (const [name, directory] of [["effect", join(dependencies, "effect")], ["effect-build", upstreamRoot], ...built.map((item) => [item.name, item.root])]) {
    const target = join(root, "node_modules", ...name.split("/"))
    await mkdir(dirname(target), { recursive: true })
    await symlink(directory, target)
  }
  const sourceInventory = []
  const imports = []
  for (const [path, raw] of Object.entries(spec.sources)) {
    const text = raw.replaceAll('"@lab/kernel"', JSON.stringify(layout.kernel))
    await mkdir(dirname(join(root, "src", path)), { recursive: true })
    await writeFile(join(root, "src", path), text)
    const normalized=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true))
    sourceInventory.push({ path, sha256: hash(text), bytes: Buffer.byteLength(text), lines: text.split("\n").length - Number(text.endsWith("\n")),normalizedLines:normalized.trimEnd().split("\n").length })
    imports.push(...moduleImports(text, path).map((edge) => ({ from: path, ...edge })))
  }
  const exports = Object.fromEntries(Object.entries(spec.exports).map(([key, entry]) => [key, { types: `./dist/${entry}.d.ts`, import: `./dist/${entry}.js` }]))
  const manifest = { name: spec.name, version: "1.0.0-lab", type: "module", sideEffects: false, files: ["dist"], exports, dependencies: spec.dependencies, ...(spec.bin ? { bin: spec.bin } : {}), ...(spec.private ? { private: true } : {}) }
  await writeFile(join(root, "package.json"), json(manifest))
  const config = {
    compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, skipLibCheck: false,
      lib: ["ES2022", "DOM", "DOM.Iterable", "ESNext.Disposable"], declaration: true, sourceMap: false, declarationMap: false,
      rootDir: "src", outDir: "dist", types: ["bun"],
      typeRoots: [join(repository, "node_modules/@types")] },
    include: ["src/**/*.ts"]
  }
  await writeFile(join(root, "tsconfig.json"), json(config))
  command([bun, join(repository, "node_modules/typescript/bin/tsc"), "-p", join(root, "tsconfig.json")], root)
  const packed = await pack(root, join(work, "tarballs"))
  const emitted = await inventory(join(root, "dist"))
  const declarationProgram = ts.createProgram(Object.values(spec.exports).map((entry) => join(root, `dist/${entry}.d.ts`)), { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext })
  const checker = declarationProgram.getTypeChecker()
  const surfaces = Object.fromEntries(Object.entries(spec.exports).map(([subpath, entry]) => {
    const path = join(root, `dist/${entry}.d.ts`)
    const file = declarationProgram.getSourceFile(path)
    const symbol = checker.getSymbolAtLocation(file)
    return [subpath, { declarationSha256: emitted.find((item) => item.path === `${entry}.d.ts`).sha256, symbols: checker.getExportsOfModule(symbol).map((symbol) => symbol.name).sort() }]
  }))
  return { name: spec.name, root, manifest, tarball: packed, sourceInventory, imports, emitted, surfaces }
}

export async function buildLayout(layoutId, work, source, upstreamRoot) {
  const built = []
  for (const spec of specification(layoutId, source)) built.push(await buildPackage(spec, layouts[layoutId], work, built, upstreamRoot))
  // Deliberately compile the external provider after the core AND CLI package.
  const cliHashBeforeExternal = built.find((item) => item.name === "@lab/host").tarball.sha256
  const external = await buildPackage(pkg("@lab/external", { "index.ts": source.own["external.ts"],...(source.own["http-evidence.ts"]?{"http-evidence.ts":source.own["http-evidence.ts"]}:{}) }, { ".": "index" },
    { effect: "4.0.0-rc.108", [layouts[layoutId].kernel]: "1.0.0-lab" }), layouts[layoutId], work, built, upstreamRoot)
  built.push(external)
  return { layoutId, built, cliHashBeforeExternal }
}

export async function compileConsumer(root, sourceText, filename = "application.ts") {
  await writeFile(join(root, filename), sourceText)
  const config = { compilerOptions: {
    target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, skipLibCheck: false,
    lib: ["ES2022", "DOM", "DOM.Iterable", "ESNext.Disposable"], types: ["bun"], declaration: true,
    typeRoots: [join(repository, "node_modules/@types")]
  }, files: [filename] }
  await writeFile(join(root, "tsconfig.json"), json(config))
  command([bun, join(repository, "node_modules/typescript/bin/tsc"), "-p", join(root, "tsconfig.json")], root)
}
