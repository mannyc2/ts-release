import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const handoff = resolve(root, "docs/refactor/architecture-program/handoff")
const forecast = await Bun.file(resolve(handoff, "forecast.json")).json()
const waves = await Bun.file(resolve(handoff, "waves.json")).json()
const progress = await Bun.file(resolve(root, "docs/refactor/execution/progress.json")).json()
const listed = Bun.spawnSync(
  ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root },
)
if (listed.exitCode !== 0) throw new Error("Cannot enumerate maintained source")
const paths = [...new Set(listed.stdout.toString().split("\0").filter(Boolean))]
const legacy = new Map<string, string>(
  waves.migrationExecutionMapping.currentSourceRows.map((row: { path: string; sha256: string }) => [
    row.path,
    row.sha256,
  ]),
)
for (const input of forecast.legacyGeneratedInputs) legacy.set(input.path, input.sha256)
const counts = {
  product: 0,
  unchangedLegacy: 0,
  replacement: 0,
  metadata: 0,
  productData: 0,
  productDataBytes: 0,
  tests: 0,
  fixtureText: 0,
  fixtureBinaryBytes: 0,
  generatedDelivery: 0,
  tooling: 0,
}
const files: Array<{ path: string; lines: number; lane: string; sha256: string }> = []
for (const path of paths) {
  if (path.startsWith("docs/") || path.startsWith("advisor-plans/")) continue
  const file = Bun.file(resolve(root, path))
  if (!(await file.exists())) continue
  const source = /\.(?:ts|tsx|js|mjs|cjs)$/.test(path)
  const product =
    (source && (path.startsWith("src/") || /^(?:apps|packages)\/[^/]+\/src\//.test(path))) ||
    /^apps\/[^/]+\/action\.yml$/.test(path)
  const lane = product
    ? "product"
    : /(?:^|\/)(?:fixtures|golden)\//.test(path) || /\.(?:tgz|tar\.gz|zip|whl|png|jpg|wasm)$/.test(path)
      ? /\.(?:tgz|tar\.gz|zip|whl|png|jpg|wasm)$/.test(path)
        ? "fixtureBinaryBytes"
        : "fixtureText"
      : /(?:^|\/)test(?:s)?\//.test(path)
        ? "tests"
        : /(?:^|\/)dist\//.test(path)
          ? "generatedDelivery"
          : source && /^(?:tools|scripts|prototypes)\//.test(path)
            ? "tooling"
            : /^(?:apps|packages)\/[^/]+\/src\/.*\.json$/.test(path)
              ? "productData"
              : /(?:package|tsconfig[^/]*)\.json$/.test(path)
                ? "metadata"
                : undefined
  if (!lane) continue
  const bytes = readFileSync(resolve(root, path))
  const lines =
    lane === "fixtureBinaryBytes" || bytes.length === 0
      ? 0
      : bytes.filter((byte) => byte === 10).length + (bytes.at(-1) === 10 ? 0 : 1)
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  counts[lane] += lane === "fixtureBinaryBytes" ? bytes.length : lines
  if (lane === "productData") counts.productDataBytes += bytes.length
  if (product) counts[legacy.get(path) === sha256 ? "unchangedLegacy" : "replacement"] += lines
  files.push({ path, lines, lane, sha256 })
}
const wave = progress.activeWave ?? progress.completedWave
const limit = forecast.perWaveBudget[wave]
if (typeof limit !== "number") throw new Error(`No reviewed budget tripwire for ${wave}`)
const replacementBindings = files
  .filter((file) => file.lane === "product" && legacy.get(file.path) !== file.sha256)
  .map(({ path, lines, sha256 }) => ({ path, lines, sha256 }))
  .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
const replacementSha256 = createHash("sha256")
  .update(JSON.stringify(replacementBindings))
  .digest("hex")
const planningTripwirePassed = counts.replacement <= limit
let planningVarianceAccepted = false
if (
  !planningTripwirePassed &&
  wave !== "W10" &&
  process.argv.includes("--accept-recorded-planning-variance")
) {
  const path = resolve(root, `docs/refactor/execution/${wave}-source-variance.json`)
  if (await Bun.file(path).exists()) {
    const variance = await Bun.file(path).json()
    planningVarianceAccepted =
      variance.wave === wave &&
      variance.originalTripwire === limit &&
      variance.replacementLines === counts.replacement &&
      variance.replacementSha256 === replacementSha256 &&
      variance.completeProductCeiling === 11485 &&
      variance.completeProductWaiver === false
  }
}
console.log(
  JSON.stringify(
    {
      baseline: 22971,
      ceiling: 11485,
      wave,
      replacementTripwire: limit,
      counts,
      planningTripwirePassed,
      planningVarianceAccepted,
      replacementSha256,
      achievedReduction: wave === "W10" && counts.product <= 11485,
      productAndDataLines: counts.product + counts.productData,
    },
    null,
    2,
  ),
)
if (process.argv.includes("--write"))
  await Bun.write(
    resolve(root, "docs/refactor/execution/source-measurement.json"),
    JSON.stringify({ wave, counts, files }, null, 2) + "\n",
  )
if (
  (!planningTripwirePassed && !planningVarianceAccepted) ||
  (wave === "W10" && counts.product > 11485)
) {
  throw new Error(
    "Source tripwire exceeded: simplify implementation or record a concrete tradeoff; the ceiling is unchanged",
  )
}
