import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { resolve, join, relative } from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

const root = resolve(import.meta.dir, "..")
const handoff = join(root, "docs/refactor/architecture-program/handoff")
const layout = await Bun.file(join(handoff, "layout.json")).json()
const surfaces = await Bun.file(join(handoff, "public-surface.json")).json()
const selected = layout.alternatives.find(
  (item: { id: string }) => item.id === layout.selection.topology,
)
const plannedEntries = surfaces.alternatives.find(
  (item: { id: string }) => item.id === selected.id,
).entries
const progress = await Bun.file(join(root, "docs/refactor/execution/progress.json")).json()
const complete = process.argv.includes("--complete") || progress.completedWave === "W10"
const missing: string[] = [],
  entries = [],
  packages = []
const hash = (input: string) => createHash("sha256").update(input).digest("hex")
const source = ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile)
if (source.error) throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, "\n"))
const config = ts.parseJsonConfigFileContent(source.config, ts.sys, root)
const program = ts.createProgram(config.fileNames, config.options),
  checker = program.getTypeChecker()
for (const target of selected.packages) {
  const manifestFile = Bun.file(join(root, target.manifestPath))
  if (!(await manifestFile.exists())) {
    missing.push(target.manifest.name)
    continue
  }
  const manifest = await manifestFile.json()
  for (const field of [
    "name",
    "version",
    "type",
    "dependencies",
    "peerDependencies",
    "peerDependenciesMeta",
    "engines",
    "files",
    "sideEffects",
    "publishConfig",
  ])
    assert.deepEqual(manifest[field], target.manifest[field], `${target.manifestPath}:${field}`)
  packages.push({ path: target.manifestPath, sha256: hash(await manifestFile.text()) })
  for (const subpath of Object.keys(target.manifest.exports))
    if (!manifest.exports[subpath]) missing.push(`${manifest.name}${subpath.slice(1)}`)
  for (const [subpath, conditions] of Object.entries(manifest.exports)) {
    assert.deepEqual(conditions, target.manifest.exports[subpath], `${manifest.name}:${subpath}`)
    const planned = plannedEntries.find(
      (entry: { package: string; subpath: string }) =>
        entry.package === manifest.name && entry.subpath === subpath,
    )
    assert.ok(planned, `Unplanned public entry ${manifest.name}:${subpath}`)
    const file = program.getSourceFile(join(root, planned.source))
    assert.ok(file, `Source absent from strict production program: ${planned.source}`)
    const module = checker.getSymbolAtLocation(file)
    assert.ok(module)
    const symbols = checker.getExportsOfModule(module)
    const names = (space: ts.SymbolFlags) =>
      symbols
        .filter((symbol) => {
          const original =
            symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
          return (original.flags & space) !== 0
        })
        .map((symbol) => symbol.name)
        .sort()
    const types = names(ts.SymbolFlags.Type),
      values = names(ts.SymbolFlags.Value)
    for (const [actual, expected, space] of [
      [types, planned.typeNames, "type"],
      [values, planned.runtimeNames, "value"],
    ] as const) {
      for (const name of actual)
        assert.ok(expected.includes(name), `${planned.specifier} unexpected ${space} ${name}`)
      for (const name of expected)
        if (!actual.includes(name)) missing.push(`${planned.specifier}:${space}:${name}`)
    }
    const runtimePath = join(root, target.directory, planned.conditions.import)
    const declarationsPath = join(root, target.directory, planned.conditions.types)
    const runtime = await import(pathToFileURL(runtimePath).href)
    assert.deepEqual(
      Object.keys(runtime).sort(),
      values,
      `${planned.specifier} emitted runtime surface differs`,
    )
    entries.push({
      specifier: planned.specifier,
      source: planned.source,
      sourceSha256: hash(await readFile(join(root, planned.source), "utf8")),
      runtimePath: relative(root, runtimePath),
      runtimeSha256: hash(await readFile(runtimePath, "utf8")),
      declarationsPath: relative(root, declarationsPath),
      declarationsSha256: hash(await readFile(declarationsPath, "utf8")),
      runtimeNames: values,
      typeNames: types,
    })
  }
  if (target.manifest.bin) {
    if (!manifest.bin) missing.push(`${manifest.name}:bin`)
    else {
      assert.deepEqual(manifest.bin, target.manifest.bin)
      for (const path of Object.values(manifest.bin) as string[])
        assert.ok(await Bun.file(join(root, target.directory, path)).exists(), path)
    }
  }
}
const record = {
  format: "ts-release/production-surface/1",
  projection: selected.id,
  complete: missing.length === 0,
  scope:
    "Actual source/compiler/emitted runtime comparison; packed consumers are a separate witness",
  packages,
  entries,
  missing,
}
await writeFile(
  join(root, "docs/refactor/execution/production-surface.json"),
  JSON.stringify(record, null, 2) + "\n",
)
console.log(
  JSON.stringify({
    implementedPackages: packages.length,
    implementedEntries: entries.length,
    pendingRequirements: missing.length,
    complete: record.complete,
  }),
)
if (complete) assert.deepEqual(missing, [], "Full selected public surface remains incomplete")
