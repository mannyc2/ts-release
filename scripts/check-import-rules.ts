import assert from "node:assert/strict"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { isBuiltin } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import * as Schema from "effect/Schema"
// AST inspection only. The patched TypeScript 7 CLI owns compiler diagnostics.
import ts from "typescript-api"

const root = resolve(import.meta.dir, "..")
type Host = "portable" | "node" | "bun" | "apple"
const Manifest = Schema.Struct({
  name: Schema.String,
  dependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  peerDependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  exports: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.Struct({ types: Schema.String, import: Schema.String })),
  ),
})
type Manifest = typeof Manifest.Type
type Project = {
  directory: string
  config: string
  host: Host
  entries: Record<string, { source: string; host: Host }>
}
// Public entries and source owners are contracts, not discoveries that silently
// admit a new workspace or turn a portable entry into a host entry.
const projects: Project[] = [
  {
    directory: "packages/ts-release",
    config: "tsconfig.build.json",
    host: "bun",
    entries: {
      ".": { source: "index", host: "portable" },
      "./bundle": { source: "Bundle", host: "portable" },
      "./http": { source: "Http", host: "portable" },
      "./effect-build": { source: "EffectBuild", host: "portable" },
      "./git": { source: "Git", host: "portable" },
      "./bun": { source: "Bun", host: "bun" },
      "./node": { source: "Node", host: "node" },
      "./apple": { source: "Apple", host: "apple" },
    },
  },
  ...["github", "mcp", "npm", "pypi", "openai"].map((name): Project => ({
    directory: `packages/${name}`,
    config: "tsconfig.build.json",
    host: name === "openai" ? "portable" : "node",
    entries: { ".": { source: "index", host: name === "openai" ? "portable" : "node" } },
  })),
  {
    directory: "packages/catalog",
    config: "tsconfig.build.json",
    host: "portable",
    entries: {
      "./homebrew": { source: "homebrew/index", host: "portable" },
      "./scoop": { source: "scoop/index", host: "portable" },
    },
  },
  { directory: "apps/action", config: "tsconfig.json", host: "node", entries: {} },
  { directory: "apps/self-release", config: "tsconfig.build.json", host: "node", entries: {} },
]
const owners = new Map(projects.map((project) => [project.directory, project]))
const manifests = new Map<string, Manifest>()
const packages = new Map<string, Project>()
const projectFiles = new Map<string, Set<string>>()
for (const project of projects) {
  const manifest = Schema.decodeSync(Schema.fromJsonString(Manifest))(
    await readFile(join(root, project.directory, "package.json"), "utf8"),
  )
  manifests.set(project.directory, manifest)
  packages.set(manifest.name, project)
  const configPath = join(root, project.directory, project.config)
  const config = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path))
  assert.equal(config.error, undefined, `${configPath}: unreadable compiler project`)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath))
  assert.equal(parsed.errors.length, 0, `${configPath}: invalid compiler project`)
  assert.equal(
    parsed.options.verbatimModuleSyntax,
    true,
    `${configPath}: import analysis requires verbatimModuleSyntax`,
  )
  projectFiles.set(project.directory, new Set(parsed.fileNames.map((path) => relative(root, path))))
  assert.deepEqual(
    Object.keys(manifest.exports ?? {}).sort(),
    Object.keys(project.entries).sort(),
    `${manifest.name}: update the explicit public entry contract`,
  )
  for (const [entry, { source }] of Object.entries(project.entries))
    assert.deepEqual(
      manifest.exports?.[entry],
      { types: `./dist/${source}.d.ts`, import: `./dist/${source}.js` },
      `${manifest.name}:${entry}: changed public targets`,
    )
}

const paths: string[] = []
for (const pattern of ["packages/*/src/**/*", "apps/*/src/**/*"])
  for await (const path of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true })) {
    assert.ok(
      !/\.(?:tsx|jsx?|mts|cts|mjs|cjs)$/.test(path),
      `${path}: register the new production source extension and compiler project`,
    )
    if (path.endsWith(".ts")) paths.push(path)
  }
paths.sort()
const sourcePaths = new Set(paths)
const edges: Array<{
  file: string
  line: number
  specifier: string
  typeOnly: boolean
  kind: string
  target?: string
}> = []
const graph = new Map<string, string[]>()
const externals = new Map<string, string[]>()
const computedLoads: Array<{ file: string; line: number; expression: string; contract: string }> =
  []
const evaluation: Array<{ file: string; line: number; expression: string }> = []
const computedOwners = new Map([
  [
    "packages/ts-release/src/platform/Application.ts",
    {
      expression: "pathToFileURL(resolve(applicationPath)).href",
      contract:
        "Caller-selected trusted application path; Plan and journal data cannot select code.",
    },
  ],
  [
    "apps/action/src/launcher.ts",
    {
      expression: "pathToFileURL(entry).href",
      contract:
        "Application-installed core instance preserves native transport authority identity.",
    },
  ],
])
const coreArea = (file: string): string => {
  const path = file.replace("packages/ts-release/src/", "")
  if (path.startsWith("bin/") || path === "internal/CommandLine.ts") return "cli"
  if (path === "platform/Application.ts") return "application"
  if (path.startsWith("platform/")) return "native"
  if (path === "Node.ts" || path === "Bun.ts") return "host-entry"
  if (path.startsWith("apple/") || path === "Apple.ts") return "apple"
  return "kernel"
}
const allowedAreas: Record<string, readonly string[]> = {
  kernel: ["kernel"],
  native: ["kernel", "native"],
  application: ["kernel", "native", "application"],
  "host-entry": ["kernel", "native", "application", "host-entry"],
  apple: ["kernel", "apple"],
  cli: ["kernel", "native", "application", "cli"],
}
const exactRelativeTarget = async (file: string, specifier: string): Promise<string> => {
  assert.ok(
    /\.(?:js|json)$/.test(specifier),
    `${file}: relative import must name its emitted extension: ${specifier}`,
  )
  const target = relative(root, resolve(root, dirname(file), specifier)).replace(/\.js$/, ".ts")
  const owner = file.split("/").slice(0, 2).join("/")
  assert.ok(
    target.startsWith(`${owner}/src/`),
    `${file}: relative import escapes its package: ${specifier}`,
  )
  // Directory entries, rather than fileExists alone, also enforce casing on a
  // case-insensitive host. JSON resources participate in resolution, not cycles.
  let directory = root
  for (const component of target.split("/")) {
    assert.ok(
      (await readdir(directory)).includes(component),
      `${file}: missing or case-mismatched source ${target}`,
    )
    directory = join(directory, component)
  }
  assert.ok(
    target.endsWith(".json") || sourcePaths.has(target),
    `${file}: target is outside checked source projects: ${target}`,
  )
  return target
}
for (const path of paths) {
  const owner = path.split("/").slice(0, 2).join("/")
  const project = owners.get(owner)
  const manifest = manifests.get(owner)
  assert.ok(project && manifest, `${path}: register its source owner and compiler project`)
  assert.ok(projectFiles.get(owner)?.has(path), `${path}: omitted from its compiler project`)
  const declared = { ...manifest.dependencies, ...manifest.peerDependencies }
  const source = ts.createSourceFile(
    path,
    await readFile(join(root, path), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  )
  const internal: string[] = [],
    outside: string[] = []
  const imports: Array<{ node: ts.Node; specifier: string; typeOnly: boolean; kind: string }> = []
  const lineOf = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier
      if (specifier && ts.isStringLiteral(specifier))
        imports.push({
          node,
          specifier: specifier.text,
          // With verbatimModuleSyntax, `import { type T }` emits `import {}`.
          // Only declaration-level `import type` / `export type` erases the edge.
          typeOnly: ts.isImportDeclaration(node)
            ? Boolean(node.importClause?.isTypeOnly)
            : node.isTypeOnly,
          kind: "static",
        })
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      imports.push({ node, specifier: node.argument.literal.text, typeOnly: true, kind: "type" })
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const specifier = node.arguments[0]
      if (
        specifier &&
        (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier))
      ) {
        imports.push({
          node,
          specifier: specifier.text,
          typeOnly: false,
          kind: node.expression.kind === ts.SyntaxKind.ImportKeyword ? "dynamic" : "require",
        })
      } else {
        const policy = computedOwners.get(path)
        const expression = specifier?.getText(source)
        assert.ok(
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            policy &&
            expression === policy.expression &&
            node.arguments.length === 1,
          `${path}:${lineOf(node)}: unapproved computed load ${expression ?? "<missing>"}`,
        )
        assert.ok(
          !computedLoads.some((load) => load.file === path),
          `${path}: additional computed load needs an explicit owner decision`,
        )
        computedLoads.push({
          file: path,
          line: lineOf(node),
          expression,
          contract: policy.contract,
        })
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      assert.fail(`${path}:${lineOf(node)}: use explicit ESM imports in production source`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  // Review inventory, not an assertion that arbitrary calls are pure. Do not
  // execute CLI/application modules merely to inspect their initialization.
  const evaluate = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return
    if (ts.isCallExpression(node) || ts.isNewExpression(node))
      evaluation.push({
        file: path,
        line: lineOf(node),
        expression: node.expression.getText(source),
      })
    if (ts.isPropertyAccessExpression(node) && node.getText(source) === "process.env")
      evaluation.push({ file: path, line: lineOf(node), expression: "process.env" })
    ts.forEachChild(node, evaluate)
  }
  evaluate(source)
  for (const { node, specifier, typeOnly, kind } of imports) {
    let target: string | undefined
    assert.ok(
      !/(?:^|\/)testing(?:\/|$)|^(?:vitest|bun:test|node:test)$/.test(specifier),
      `${path}: testing dependency in production source: ${specifier}`,
    )
    if (specifier.startsWith(".")) {
      target = await exactRelativeTarget(path, specifier)
      if (owner === "packages/ts-release")
        assert.ok(
          allowedAreas[coreArea(path)]?.includes(coreArea(target)),
          `${path}:${lineOf(node)}: forbidden ${coreArea(path)} -> ${coreArea(target)} dependency (${specifier})`,
        )
    } else if (isBuiltin(specifier) || specifier === "bun" || specifier.startsWith("bun:")) {
      const area = owner === "packages/ts-release" ? coreArea(path) : undefined
      assert.ok(
        project.host !== "portable" && area !== "kernel" && area !== "apple",
        `${path}: host builtin outside a native owner: ${specifier}`,
      )
      if (specifier === "bun" || specifier.startsWith("bun:"))
        assert.equal(
          path,
          "packages/ts-release/src/platform/SqliteJournal.ts",
          `${path}: Bun dependency outside its SQLite adapter`,
        )
    } else {
      const name = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0]
      assert.ok(name && declared[name], `${path}: undeclared package ${name}`)
      if (name.startsWith("@effect/platform-"))
        assert.ok(
          project.host !== "portable" &&
            (owner !== "packages/ts-release" || !["kernel", "apple"].includes(coreArea(path))),
          `${path}: host platform dependency outside its owner: ${specifier}`,
        )
      if (name === "effect-build-apple")
        assert.ok(
          owner === "packages/ts-release" && coreArea(path) === "apple",
          `${path}: optional Apple peer outside its integration owner`,
        )
      const dependency = packages.get(name)
      if (dependency) {
        assert.ok(
          owner.startsWith("apps/") ||
            (owner !== "packages/ts-release" && dependency.directory === "packages/ts-release"),
          `${path}: upward or sibling workspace dependency ${specifier}`,
        )
        const entry = specifier.slice(name.length)
        const exported = dependency.entries[entry ? `.${entry}` : "."]
        assert.ok(exported, `${path}: private or absent public import ${specifier}`)
        target = `${dependency.directory}/src/${exported.source}.ts`
        assert.ok(sourcePaths.has(target), `${path}: missing public source ${target}`)
      } else {
        // Resolve with the source file as the issuer. Runtime dependency exports
        // and installed subpaths must exist, including native adapter exceptions.
        assert.ok(
          import.meta.resolve(specifier, join(root, path)),
          `${path}: unresolved external ${specifier}`,
        )
      }
    }
    edges.push({
      file: path,
      line: lineOf(node),
      specifier,
      typeOnly,
      kind,
      ...(target === undefined ? {} : { target }),
    })
    if (!typeOnly && kind !== "dynamic") {
      if (target?.endsWith(".ts")) internal.push(target)
      if (!specifier.startsWith(".")) outside.push(specifier)
    }
  }
  graph.set(path, internal)
  externals.set(path, outside)
}
assert.ok(paths.length > 0)
const complete = new Set<string>(),
  active: string[] = []
const checkCycle = (file: string): void => {
  const cycle = active.indexOf(file)
  assert.ok(cycle < 0, `runtime import cycle: ${[...active.slice(cycle), file].join(" -> ")}`)
  if (complete.has(file)) return
  active.push(file)
  for (const target of graph.get(file) ?? []) checkCycle(target)
  active.pop()
  complete.add(file)
}
for (const file of paths) checkCycle(file)

const runtimeClosures: Record<
  string,
  { host: Host; files: string[]; imports: string[]; evaluation: typeof evaluation }
> = {}
for (const project of projects) {
  const manifest = manifests.get(project.directory)
  assert.ok(manifest)
  for (const [entry, { source, host }] of Object.entries(project.entries)) {
    const path = `${project.directory}/src/${source}.ts`
    assert.ok(sourcePaths.has(path), `${manifest.name}:${entry}: missing public source ${path}`)
    const visited = new Set<string>(),
      imports = new Set<string>()
    const visit = (file: string): void => {
      if (visited.has(file)) return
      visited.add(file)
      for (const dependency of graph.get(file) ?? []) visit(dependency)
      for (const dependency of externals.get(file) ?? []) imports.add(dependency)
    }
    visit(path)
    const name = entry === "." ? manifest.name : `${manifest.name}${entry.slice(1)}`
    for (const specifier of imports) {
      if (host === "portable")
        assert.ok(
          !isBuiltin(specifier) &&
            !/^(?:bun:|@effect\/platform-)/.test(specifier) &&
            specifier !== "bun",
          `${name} eagerly imports host runtime ${specifier}`,
        )
      if (host !== "bun")
        assert.ok(
          specifier !== "bun" && !specifier.startsWith("bun:"),
          `${name} imports Bun runtime`,
        )
      if (host !== "apple")
        assert.ok(
          !specifier.startsWith("effect-build-apple"),
          `${name} eagerly imports optional Apple peer`,
        )
      if (project.directory === "packages/ts-release" && entry === ".")
        assert.ok(!specifier.startsWith("effect-build"), "Root eagerly imports producer code")
      assert.ok(
        !/(?:^|\/)testing(?:\/|$)|^(?:vitest|bun:test)$/.test(specifier),
        `${name} eagerly imports testing code: ${specifier}`,
      )
    }
    runtimeClosures[name] = {
      host,
      files: [...visited].sort(),
      imports: [...imports].sort(),
      evaluation: evaluation.filter((item) => visited.has(item.file)),
    }
  }
}
await mkdir(join(root, ".release/checks"), { recursive: true })
await writeFile(
  join(root, ".release/checks/production-imports.json"),
  JSON.stringify(
    {
      format: "ts-release/production-imports/2",
      files: paths.length,
      projects,
      edges,
      computedLoads,
      // External package internals remain the installed-consumer checks' authority.
      runtimeClosures,
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify({
    files: paths.length,
    edges: edges.length,
    entries: Object.keys(runtimeClosures).length,
    computedLoads: computedLoads.length,
  }),
)
