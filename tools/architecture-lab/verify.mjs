import { createHash } from "node:crypto"
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { resolve, relative, join } from "node:path"
import { fileURLToPath } from "node:url"
import { readEvidence } from "./topology/evidence.mjs"
import { readRecords } from "./records.ts"

// A checksum inventory and direct commands, not a second readiness framework.
// It verifies retained evidence integrity; only actual tests establish behavior.
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const handoff = "docs/refactor/architecture-program/handoff"
const contractPath = `${handoff}/contract.json`
const read = path => readFileSync(join(root, path))
const json = path => JSON.parse(read(path))
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const fail = message => { throw new Error(message) }
const files = directory => readdirSync(join(root, directory), {withFileTypes:true}).flatMap(entry => {
  if (["node_modules", "dist", ".git"].includes(entry.name)) return []
  const path = `${directory}/${entry.name}`
  if (entry.isSymbolicLink()) fail(`Evidence symlink: ${path}`)
  return entry.isDirectory() ? files(path) : [path]
})
const allFiles = () => [...new Set([
  ...files(handoff), ...files("tools/architecture-lab"),
  ...files("docs/refactor/architecture-program/inputs"),
  "docs/refactor/research/launch-scorecard.md"
])].filter(path => path !== contractPath).sort()
const binding = path => ({path, bytes:statSync(join(root,path)).size, sha256:hash(read(path))})
for (const name of ["baseline-inventory", "migration"]) readRecords(join(root,`${handoff}/${name}.json`))

const reconciliation = json(`${handoff}/reconciliation.json`)
const input = json("docs/refactor/architecture-program/inputs/research-traceability.json")
if (reconciliation.rows.length !== 226 || input.propositions.length !== 226) fail("Traceability denominator changed")
for (const original of input.propositions) {
  const row = reconciliation.rows.find(row => row.id === original.id)
  if (!row || row.proposition !== original.proposition || JSON.stringify(row.original.sourceCoordinates) !== JSON.stringify(original.sourceCoordinates)) fail(`Lost original proposition ${original.id}`)
}
const selected = reconciliation.rows.filter(row => row.original.class === "product-outcome")
const waves = json(`${handoff}/waves.json`)
if (selected.length !== 69 || waves.outcomes.length !== 69) fail("Selected scope changed")
const scorecard=read("docs/refactor/research/launch-scorecard.md").toString().split("\n")
for(const outcome of waves.outcomes){
  const row=scorecard.find(line=>line.startsWith(`${outcome.id}|`))?.split("|")
  if(!row||row[4]!==outcome.exactScope||row[5]!==outcome.inputOutput||row[6]!==outcome.requiredPassWitness||row[7]!==outcome.fixtureOrDestination)fail(`Selected native oracle changed ${outcome.id}`)
}
const qualification = json(`${handoff}/qualification.json`)
for (const [key,count] of Object.entries({cases:16,laws:14,gates:25,ownership:9,blockers:6,probes:9})) {
  if (qualification[key].length !== count) fail(`Lost original ${key}`)
}
for (const entry of [...qualification.inputBindings, ...Object.values(qualification.evidence).flatMap(item => item.fileBindings ?? []), ...waves.sourceBindings]) {
  if (hash(read(entry.path)) !== entry.sha256) fail(`Stale obligation binding ${entry.path}`)
}
const forecast = json(`${handoff}/forecast.json`)
const layout=json(`${handoff}/layout.json`)
const assigned=forecast.rows.flatMap(row=>row.modules).sort()
if(JSON.stringify(assigned)!==JSON.stringify(layout.alternatives[0].modules.map(module=>module.id).sort()))fail("Forecast does not own every module exactly once")
for(const recorded of forecast.layoutMetadata){
  const current=layout.alternatives.find(candidate=>candidate.id===recorded.layout)?.metadata
  for(const key of ["publicPackageJsonLines","privatePackageJsonLines","actionYamlLines","tsconfigJsonLines"])if(recorded[key]!==current?.[key])fail(`Stale layout cost ${recorded.layout}/${key}`)
}
for (const key of ["low","expected","high"]) {
  let total = 0
  for (const row of forecast.rows) {
    const count = row.components.reduce((sum, component) => sum + component[key], 0)
    if (count !== row.fullReplacementPhysicalLines[key]) fail(`Forecast component mismatch ${row.owner}/${key}`)
    total += count
  }
  if (total !== forecast.totals[key]) fail(`Forecast total mismatch ${key}`)
}
for (const name of ["results", "extension-results", "publication-results", "metric-results", "graph-results"]) {
  await readEvidence(join(root, `tools/architecture-lab/topology/${name}.json`))
}
const published = json(`${handoff}/upstream/published-consumer.json`)
for (const pkg of published.packages) {
  const path = pkg.retainedTarball ?? `${handoff}/upstream/packs/${pkg.name}-${pkg.version}.tgz`
  const bytes = read(path)
  if (hash(bytes) !== pkg.tarball.sha256 || `sha512-${createHash("sha512").update(bytes).digest("base64")}` !== pkg.metadata.dist.integrity) fail(`Retained public tarball changed: ${pkg.name}`)
}
const historical = json(`${handoff}/public-history.json`)
if (hash(read(`${handoff}/public-history/ts-release-0.3.0.tgz`)) !== historical.archiveSha256) fail("Published0.3.0 archive changed")

if (process.argv.includes("--execute")) {
  const commands = [
    ["bun","tools/architecture-lab/inventory.ts","--check"],
    ["bun","tools/architecture-lab/migration.ts","--check"],
    ["bun","tools/architecture-lab/reconcile.ts","--check"],
    ["bun","tools/architecture-lab/project.ts","--check"],
    ["python3","tools/architecture-lab/public-history-inventory.py","--check"],
    ["bun","tools/architecture-lab/machine/unpatched-effect.mjs"],
    ["bun","node_modules/typescript/bin/tsc","-p","tools/architecture-lab/tsconfig.json"],
    ["bun","tools/architecture-lab/proposal/emit.mjs","--check"],
    ["bun","tools/architecture-lab/machine/emit-proposal.mjs","--check"],
    ["bun","test","./tools/architecture-lab/machine/test","./tools/architecture-lab/storage","./tools/architecture-lab/integration","./tools/architecture-lab/git-catalog","./tools/architecture-lab/machine/witnesses"]
  ]
  const receipts = []
  for (const argv of commands) {
    const result = Bun.spawnSync(argv,{cwd:root,stdout:"pipe",stderr:"pipe"})
    const output = result.stdout.toString() + result.stderr.toString()
    receipts.push({argv,exitCode:result.exitCode,output})
    console.log(JSON.stringify({argv,exitCode:result.exitCode}))
    if (result.exitCode !== 0) fail(output)
  }
  writeFileSync(join(root,`${handoff}/verification.json`),JSON.stringify({format:"architecture-local-verification/1",observedAt:new Date().toISOString(),commands:receipts,limits:"Direct local checks. Full packed tournament receipts are separately retained; this command does not rerun them or qualify hosted/native product outcomes."},null,2)+"\n")
}
if (process.argv.includes("--seal")) {
  const contract = {
    format:"ts-release/architecture-handoff/1",
    status:"implementation-authorized-prerequisite-evidence-not-release-certification",
    authority:{design:`${handoff}/design.json`,layout:`${handoff}/layout.json`,surface:`${handoff}/public-surface.json`,vocabulary:`${handoff}/durable-vocabulary.json`,migration:`${handoff}/migration.json`,waves:`${handoff}/waves.json`,qualification:`${handoff}/qualification.json`,forecast:`${handoff}/forecast.json`},
    authorization:{researchAndPrototypes:true,productionRefactor:true,publication:true,source:"Explicit 2026-09-06 user implementation and release instruction; execution status in docs/refactor/execution/GOAL.md",conditions:"Production gates, independent candidate review and real destination authority remain required",compatibility:"Hard cut; user reports no known external consumers."},
    preservation:{selectedOutcomes:69,propositions:226,originalTournament:"No frozen winner or full original gate pass is claimed.",budgetCeiling:11485},
    files:allFiles().map(binding)
  }
  writeFileSync(join(root,contractPath),JSON.stringify(contract,null,2)+"\n")
} else {
  const contract = json(contractPath)
  if (JSON.stringify(contract.files.map(item => item.path)) !== JSON.stringify(allFiles())) fail("Unsealed added/removed evidence file")
  for (const item of contract.files) if (JSON.stringify(item) !== JSON.stringify(binding(item.path))) fail(`Unsealed evidence change ${item.path}`)
}
console.log(JSON.stringify({integrity:"verified",selected:69,propositions:226,obligations:"16/14/25/9/6/9",mode:process.argv.includes("--seal")?"explicit-reseal":"check",files:allFiles().length,productionAcceptance:false}))
