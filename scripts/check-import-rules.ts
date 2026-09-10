import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import ts from "typescript"

await Bun.$`mkdir -p ${import.meta.dir + "/../.release/checks"}`

const root = resolve(import.meta.dir, "..")
const graph = new Map<string, string[]>()
const externals = new Map<string, string[]>()

const edges: Array<{ file: string; specifier: string; typeOnly: boolean }> = []
const paths: string[] = []
for (const pattern of [
  "packages/*/src/**/*.ts",
  "apps/action/src/**/*.ts",
  "apps/self-release/src/**/*.ts",
])
  for await (const path of new Bun.Glob(pattern).scan({ cwd: root })) paths.push(path)
for (const path of paths) {
  const owner = path.split("/").slice(0, 2).join("/")
  const manifest = await Bun.file(join(root, owner, "package.json")).json()
  const declared = { ...manifest.dependencies, ...manifest.peerDependencies }
  const source = ts.createSourceFile(
    path,
    await readFile(join(root, path), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  )
  const internal: string[] = [],
    outside: string[] = []
  const admit = (specifier: string, typeOnly: boolean) => {
    edges.push({ file: path, specifier, typeOnly })
    if (specifier.startsWith(".")) {
      const target = relative(root, resolve(root, dirname(path), specifier)).replace(/\.js$/, ".ts")
      assert.ok(
        target.startsWith(`${owner}/src/`),
        `${path}: relative import escapes its package: ${specifier}`,
      )
      assert.ok(ts.sys.fileExists(join(root, target)), `${path}: missing source ${target}`)
      if (!typeOnly) internal.push(target)
    } else if (specifier.startsWith("node:") || specifier.startsWith("bun:")) {
      if (!typeOnly) outside.push(specifier)
    } else {
      const name = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0]!
      assert.ok(declared[name], `${path}: undeclared package ${name}`)
      if (name.startsWith("@mannyc1/ts-release")) {
        if (name === "@mannyc1/ts-release") {
          const core = JSON.parse(ts.sys.readFile(join(root, "packages/ts-release/package.json"))!)
          const subpath = specifier.slice(name.length) || "."
          assert.ok(
            core.exports[subpath === "." ? "." : `.${subpath}`],
            `${path}: private or absent public import ${specifier}`,
          )
        }
      }
      if (!typeOnly) outside.push(specifier)
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier
      if (specifier && ts.isStringLiteral(specifier))
        admit(
          specifier.text,
          ts.isImportDeclaration(node) ? Boolean(node.importClause?.isTypeOnly) : node.isTypeOnly,
        )
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      admit(node.argument.literal.text, true)
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === "require")
    ) {
      const specifier = node.arguments[0]
      // Computed imports are resolved by trusted application entrypoints. Static
      // imports still must name declared dependencies and valid package paths.
      if (!specifier || !ts.isStringLiteral(specifier)) return
      admit(specifier.text, false)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  graph.set(path, internal)
  externals.set(path, outside)
}
assert.ok(graph.size > 0)
const core = await Bun.file(join(root, "packages/ts-release/package.json")).json()
const closures: Record<string, string[]> = {}
for (const [entry, conditions] of Object.entries(core.exports) as Array<
  [string, { import: string }]
>) {
  const path = conditions.import
    .replace("./dist/", "packages/ts-release/src/")
    .replace(/\.js$/, ".ts")
  const visited = new Set<string>(),
    imports = new Set<string>()
  const visit = (file: string): void => {
    if (visited.has(file)) return
    visited.add(file)
    for (const dependency of graph.get(file) ?? []) visit(dependency)
    for (const dependency of externals.get(file) ?? []) imports.add(dependency)
  }
  visit(path)
  for (const specifier of imports) {
    if (!["./bun", "./node"].includes(entry))
      assert.ok(
        !/^(?:node:|bun:|@effect\/platform-)/.test(specifier),
        `${entry} eagerly imports host runtime ${specifier}`,
      )
    if (entry === "./node")
      assert.ok(!specifier.startsWith("bun:"), "Node entry imports Bun runtime")
    if (entry === ".")
      assert.ok(!specifier.startsWith("effect-build"), "Root eagerly imports producer code")
    if (entry !== "./apple")
      assert.ok(!specifier.startsWith("effect-build-apple"), `${entry} eagerly imports Apple peer`)
  }
  closures[entry] = [...imports].sort()
}
await writeFile(
  join(root, ".release/checks/production-imports.json"),
  JSON.stringify(
    {
      format: "ts-release/production-imports/1",
      files: graph.size,
      edges,
      runtimeClosures: closures,
    },
    null,
    2,
  ) + "\n",
)
console.log(JSON.stringify({ files: graph.size, edges: edges.length, runtimeClosures: closures }))
