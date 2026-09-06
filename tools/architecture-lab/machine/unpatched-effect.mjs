/** Isolated unpatched peer verification. Public GETs only; no product edits. */
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { command, install, node, packRuntimeDependencies } from "../topology/pack.mjs"
const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)))
const handoff = join(root, "docs/refactor/architecture-program/handoff")
const sha = (value, algorithm = "sha256", encoding = "hex") => createHash(algorithm).update(value).digest(encoding)
const input = JSON.parse(readFileSync(join(handoff, "upstream/unpatched-effect-input.json"), "utf8"))
const receiptPath = join(handoff, "upstream/unpatched-effect-consumer.json")
if (!process.argv.includes("--execute")) {
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"))
  for (const binding of receipt.sources) if (sha(readFileSync(join(root, binding.path))) !== binding.sha256) throw Error(`Source changed: ${binding.path}`)
  if (receipt.officialEffect.archive.sha256 !== input.archive.sha256 || !receipt.strictSelectedDeclarations || !receipt.officialEffect.privateDeclarationAbsent || receipt.bunAdoption.passed !== 34 || receipt.nodeAdoption.passed !== 34) throw Error("Invalid unpatched compatibility receipt")
  console.log(JSON.stringify({ mode: "offline-receipt-and-source-check", sources: receipt.sources.length, strictSelectedDeclarations: true, nativeAcceptance: false }))
  process.exit(0)
}
const directory = mkdtempSync("/tmp/ts-release-unpatched-effect-")
const officialPath = join(directory, "effect-4.0.0-rc.108.tgz")
const response = await fetch(input.metadata.dist.tarball)
if (!response.ok) throw Error(`Official archive GET ${response.status}`)
const official = Buffer.from(await response.arrayBuffer())
writeFileSync(officialPath, official)
if (sha(official) !== input.archive.sha256 || `sha512-${sha(official, "sha512", "base64")}` !== input.metadata.dist.integrity || sha(official, "sha1") !== input.metadata.dist.shasum) throw Error("Official Effect archive integrity mismatch")
const dependencies = await packRuntimeDependencies(join(directory, "dependency-packs"), ["effect", "@effect/platform-node", "@effect/platform-bun", "ioredis", "bun-types"])
const effect = dependencies.find(item => item.name === "effect")
if (!effect || effect.version !== "4.0.0-rc.108") throw Error("Unexpected Effect coordinate")
effect.tarball = { path: officialPath, sha256: sha(official), bytes: official.length }
const published = JSON.parse(readFileSync(join(handoff, "upstream/published-consumer.json"), "utf8"))
const packages = ["effect-build", "effect-build-apple"].map(name => {
  const packagePath = join(handoff, "upstream/packs", `${name}-0.6.3.tgz`)
  const bytes = readFileSync(packagePath)
  const expected = published.packages.find(item => item.name === name)
  if (!expected || sha(bytes) !== expected.tarball.sha256 || `sha512-${sha(bytes, "sha512", "base64")}` !== expected.metadata.dist.integrity) throw Error(`Published ${name} archive changed`)
  return { name, version: "0.6.3", tarball: { path: packagePath, bytes: bytes.length, sha256: sha(bytes) } }
})
const consumer = join(directory, "consumer")
await install(consumer, packages, dependencies, ["effect", "@effect/platform-node", "@effect/platform-bun", "bun-types", "effect-build", "effect-build-apple"])
const param = "dist/unstable/cli/Param.d.ts"
const installedParam = readFileSync(join(consumer, "node_modules/effect", param))
const officialParam = command(["tar", "-xOf", officialPath, `package/${param}`], consumer)
if (!installedParam.equals(Buffer.from(officialParam)) || installedParam.includes("getParamMetadata")) throw Error("Installed Effect contains the private declaration patch")
const source = join(consumer, "src")
mkdirSync(join(source, "proposal/adoption-api"), { recursive: true })
mkdirSync(join(source, "apple"), { recursive: true })
const bindings = []
function copy(relative, destination) {
  const bytes = readFileSync(join(root, relative))
  writeFileSync(destination, bytes)
  bindings.push({ path: relative, sha256: sha(bytes) })
}
for (const name of readdirSync(handoff).filter(name => name.endsWith(".d.ts") || name.endsWith(".typecheck.ts"))) copy(`docs/refactor/architecture-program/handoff/${name}`, join(source, "proposal", name))
for (const name of readdirSync(join(handoff, "adoption-api")).filter(name => name.endsWith(".d.ts"))) copy(`docs/refactor/architecture-program/handoff/adoption-api/${name}`, join(source, "proposal/adoption-api", name))
for (const name of ["adoption.ts", "content-owner.ts", "bundle-codec.ts", "adoption-fixture.ts"]) copy(`tools/architecture-lab/apple/${name}`, join(source, "apple", name))
const options = { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ES2022", "DOM", "ESNext.Disposable"], strict: true, skipLibCheck: false, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, types: ["bun-types"], declaration: true, rootDir: "src", outDir: "dist" }
writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({ compilerOptions: options, include: ["src/**/*.ts"] }))
const tsc = [process.execPath, join(root, "node_modules/typescript/bin/tsc")]
command([...tsc, "-p", "tsconfig.json"], consumer)
const bunAdoption = JSON.parse(command([process.execPath, "dist/apple/adoption-fixture.js"], consumer))
const nodeAdoption = JSON.parse(command([node, "--input-type=module", "-e", "import('./dist/apple/adoption-fixture.js').then(m=>m.runAdoptionFixture()).then(r=>console.log(JSON.stringify(r)))"], consumer))
if (bunAdoption.passed !== 34 || nodeAdoption.passed !== 34 || bunAdoption.skippedChecks.length || nodeAdoption.skippedChecks.length) throw Error("Incomplete real adoption fixture")
// Positive selected-surface proof above; a separate negative control proves the
// patch is absent rather than silently loaded from the root peer installation.
const negative = join(consumer, "private-param.ts")
writeFileSync(negative, 'import * as Param from "effect/unstable/cli/Param";\nvoid Param.getParamMetadata;\n')
writeFileSync(join(consumer, "negative.json"), JSON.stringify({ compilerOptions: { ...options, rootDir: ".", noEmit: true }, files: ["private-param.ts"] }))
const child = Bun.spawnSync([...tsc, "-p", "negative.json"], { cwd: consumer, stdout: "pipe", stderr: "pipe" })
const diagnostic = child.stdout.toString() + child.stderr.toString()
if (child.exitCode === 0 || !diagnostic.includes("TS2339") || !diagnostic.includes("getParamMetadata")) throw Error(`Negative control did not reject absent private API: ${diagnostic}`)
const result = {
  format: "unpatched-effect-consumer/1", verifiedAt: new Date().toISOString(), directory, consumer,
  command: "bun tools/architecture-lab/machine/unpatched-effect.mjs --execute",
  officialEffect: { version: effect.version, metadataUrl: input.metadataUrl, archive: input.archive, paramDeclarationSha256: sha(installedParam), privateDeclarationAbsent: true },
  upstream: packages.map(({ name, version, tarball }) => ({ name, version, sha256: tarball.sha256 })),
  dependencies: dependencies.map(({ name, version, tarball }) => ({ name, version, sha256: tarball.sha256 })),
  sources: bindings, compiler: JSON.parse(readFileSync(join(root, "node_modules/typescript/package.json"))).version,
  compilerOptions: options, strictSelectedDeclarations: true, negativeControl: { exitCode: child.exitCode, expectedCode: "TS2339", missingSymbol: "getParamMetadata", diagnostic },
  bunAdoption, nodeAdoption,
  qualifications: "Official unpatched Effect archive plus actual published0.6.3 JS/declarations. Complete proposed kernel/provider/host/adoption/Apple/checksum declarations and compile witnesses pass;34 actual adoption checks pass under Node/Bun. Other installed transitive dependencies are repacked existing coordinates. Proposed public declarations have no production implementation; no native Apple/AWS or full future CLI acceptance. Current root patch/dependencies and .repos/effect are unchanged."
}
writeFileSync(receiptPath, JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ directory, strictSelectedDeclarations: true, bunAdoption: bunAdoption.passed, nodeAdoption: nodeAdoption.passed, privateDeclarationAbsent: true, negativeControl: child.exitCode, boundSources: bindings.length }))
