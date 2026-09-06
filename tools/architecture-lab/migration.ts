import { resolve } from "node:path"
import { readRecords, writeRecords } from "./records.js"

// Migration decisions are explicit semantic owners. An unmatched source fails;
// this generator cannot silently classify new code as deleted or out of scope.
const directory = resolve(import.meta.dir, "../../docs/refactor/architecture-program/handoff")
const inventory = readRecords(`${directory}/baseline-inventory.json`)
type Owner = { owner: string; wave: string; disposition: string; successors: string[]; laws: string[] }
const owner = (name: string, wave: string, successors: string[], disposition = "replace", laws = ["one-canon", "native-evidence"]) =>
  ({ owner: name, wave, disposition, successors, laws })

function destination(path: string): Owner {
  if (/^apps\/release-ts\//.test(path) || /^src\/cli\//.test(path)) return owner("cli", "W10", ["app.cli"], "replace", ["thin-host", "ordinary-application-loading"])
  if (/^apps\/ts-release-action\//.test(path)) return owner("action", "W10", ["app.action"], "replace", ["thin-host", "one-journal", "artifacts-are-content-transport"])
  if (/^apps\/ts-release-agents\//.test(path)) return owner("openai", "W09", ["provider.openai"], "replace")
  if (/^src\/(?:api|config|resolve|recipes|capabilities)\//.test(path)) return owner("application", "W01", ["kernel.Plan", "kernel.Release", "app.application"], "delete-central-lifecycle-and-config", ["ordinary-composition", "one-canon"])
  if (/^src\/correction\//.test(path) || /\/correction-intent\.ts$/.test(path)) return owner("correction", "W01", ["kernel.Plan", "kernel.Release"], "delete-separate-workflow", ["ordinary-new-operations", "supersession-preserves-facts"])
  if (/^src\/drivers\//.test(path) || /\/(?:bun-targets|python-distribution)\.ts$/.test(path)) return owner("producer", "W08", ["external.effect-build", "kernel.EffectBuild"], "delegate-existing-native-production", ["producer-release-ownership", "immutable-adoption"])
  if (/^src\/model\/(?:canonical|digest|decode|errors|primitives)\.ts$/.test(path)) return owner("identity", "W01", ["kernel.Identity", "kernel.Bundle", "kernel.Plan"], "replace", ["strict-canonical-identity", "construction-only-validation"])
  if (/^src\/model\/(?:authority|secret-patterns)\.ts$/.test(path)) return owner("transport", "W01", ["kernel.Http", "kernel.Git", "host.Credentials"], "replace", ["captured-transport", "no-secret-journal"])
  if (/^src\/model\/artifact-collection\.ts$/.test(path)) return owner("artifact", "W01", ["kernel.Bundle", "kernel.Content"], "replace", ["immutable-content-plus-logical-map"])
  if (/^src\/model\/(?:catalog|git)\.ts$/.test(path)) return owner("catalog", "W06", ["kernel.Git", "provider.homebrew", "provider.scoop"], "replace")
  if (/^src\/model\/pypi\.ts$/.test(path)) return owner("warehouse", "W03", ["provider.warehouse"], "replace")
  if (/\/(?:npm[^/]*|pypi|warehouse[^/]*)\.ts$/.test(path)) return path.includes("npm")
    ? owner("npm", "W02", ["provider.npm"]) : owner("warehouse", "W03", ["provider.warehouse"])
  if (/\/github[^/]*\.ts$/.test(path)) return owner("github", "W05", ["provider.github"])
  if (/\/mcp-registry[^/]*\.ts$/.test(path)) return owner("mcp", "W09", ["provider.mcp"])
  if (/\/openai[^/]*\.ts$/.test(path)) return owner("openai", "W09", ["provider.openai"])
  if (/\/apple-notary\.ts$/.test(path)) return owner("apple", "W08", ["kernel.Apple", "external.effect-build-apple"], "replace", ["one-physical-journal", "pre-id-inconclusive", "gatekeeper-before-adoption"])
  if (/\/catalog(?:s|-git)?\.ts$/.test(path)) return owner("catalog", "W06", ["kernel.Git", "provider.homebrew", "provider.scoop"])
  if (/^src\/transport\//.test(path) || /\/platform\/(?:core-|git-authorization|credentials)/.test(path)) return owner("transport", "W04", ["kernel.Http", "kernel.Git", "host.Credentials"], "replace", ["exact-request-correspondence", "owned-cas-replay"])
  if (/\/platform\/(?:bun-journal|git-ref-journal|node-file-journal)\.ts$/.test(path) || /^(?:src\/store|src\/release\/journal)\.ts$/.test(path)) return owner("journal", "W01", ["kernel.Journal", "host.Sqlite", "host.GitJournal"], "replace", ["single-global-revision", "durable-cas", "symmetric-byte-bound"])
  if (/\/platform\/(?:file-artifact-store|finalized-producer|source-observer)\.ts$/.test(path)) return owner("artifact", "W08", ["kernel.Content", "kernel.EffectBuild", "host.Content"])
  if (/^src\/(?:host|platform\/(?:bun|node|host-support|release-runtime|services))\.ts$/.test(path)) return owner("host", "W10", ["app.application", "host.Node", "host.Bun"], "replace", ["capture-once", "layers-at-boundaries"])
  if (/^src\/(?:index|provider-sdk|extensions\/provider-adapter)\.ts$/.test(path)) return owner("public-surface", "W01", ["kernel.Provider", "kernel.Release"], "hard-cut-public-api", ["exact-generated-exports", "no-compatibility-peers"])
  if (/^src\/release\/(?:artifact-bundle|checksums|staging|prepared-store|prepared-ref|prepared)\.ts$/.test(path)) return owner("artifact", "W01", ["kernel.Bundle", "kernel.Content", "kernel.Plan"], "delete-prepared-representation", ["immutable-content-plus-logical-map", "one-canon"])
  if (/^src\/release\//.test(path) || /^src\/publication\//.test(path)) return owner("machine", "W01", ["kernel.Plan", "kernel.Journal", "kernel.Release", "kernel.Provider"], "delete-reconstructed-lifecycles", ["one-transition-owner", "one-interpreter", "late-facts-survive"])
  throw new Error(`Unclassified product file: ${path}`)
}

const files = inventory.snapshots.flatMap((snapshot: any) => snapshot.files.map((file: any) => ({
  snapshot: snapshot.id, commit: snapshot.commit, path: file.path, sha256: file.sha256,
  lines: file.lines, ...destination(file.path),
  sourceAction: snapshot.id === "current" ? "delete-at-cutover-after-successor-gates" : "historical-evidence-no-merge-no-additional-deletion-credit",
  oldDeclarations: file.declarations.map((unit: any) => ({ name: unit.name, kind: unit.kind, line: unit.line, sha256: unit.sha256, disposition: "retire-old-declaration", successorOwner: destination(file.path).owner }))
})))
const publicSymbols = inventory.snapshots.flatMap((snapshot: any) => snapshot.surfaces.flatMap((surface: any) => surface.symbols.map((symbol: any) => ({
  snapshot: snapshot.id, module: surface.subpath, name: symbol.name, runtime: symbol.runtime, declaration: symbol.declaration,
  members: symbol.members, disposition: "remove-old-export-no-alias", successorOwner: destination(surface.path).owner,
  successorModules: destination(surface.path).successors, wave: "W10", authorization: "2026-09-05: No known consumers; plan a hard cut"
}))))
const external = new Set(inventory.historicalFormats.externalStandardIdentifiers)
const formats = [...new Set<string>(inventory.snapshots.flatMap((snapshot: any) => snapshot.files.flatMap((file: any) => file.versionLiterals.map((literal: any) => literal.value))))]
  .sort().map(value => ({ value, disposition: external.has(value) ? "retain-external-standard" : "hard-cut-no-reader-writer-or-alias", note: "Version-shaped literal inventory is broader than proven persisted payloads" }))
const result = { format: "ts-release/architecture-migration/1", authorization: "No known consumers; plan a hard cut", files, publicSymbols, formats,
  existingPayloads: inventory.historicalFormats.observedLocalJson ?? [],
  historicalPayloadDisposition: "Keep original bytes as archival evidence; never load them as target plans/journals. No payload migration is requested or inferred.",
  accounting: { currentDeletedLines: files.filter((file: any) => file.snapshot === "current").reduce((n: number, file: any) => n + file.lines, 0), relocationCredit: 0, replacementCostSource: "forecast.json", targetPathsSource: "layout.json" } }
const encoded = JSON.stringify(result, null, 2) + "\n"
const output = `${directory}/migration.json`
writeRecords(output, encoded, {
  authorization: result.authorization, source: "baseline-inventory.json; explicit destination rules in tools/architecture-lab/migration.ts",
  counts: {files: files.length, oldDeclarations: files.reduce((count: number, file: any) => count + file.oldDeclarations.length, 0), publicSymbols: publicSymbols.length, formats: formats.length, existingPayloads: result.existingPayloads.length},
  historicalPayloadDisposition: result.historicalPayloadDisposition, accounting: result.accounting
}, process.argv.includes("--check"))
console.log(JSON.stringify({ files: files.length, publicSymbols: publicSymbols.length, formats: formats.length, currentDeletedLines: result.accounting.currentDeletedLines }))
