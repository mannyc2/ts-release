import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { createHash } from "node:crypto"

const root = resolve(import.meta.dir, "../../..")
const upstream = "/mnt/models/dev/effect-build"
const revision = "dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc"
const stage = mkdtempSync(join(tmpdir(), "ts-release-pr24-adoption-"))
const run = (cmd: string[], cwd = stage) => {
  const result = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== 0) throw new Error(`${cmd.join(" ")}\n${result.stdout}\n${result.stderr}`)
  return result.stdout.toString().trim()
}
const archive = Bun.spawnSync(["git", "archive", revision, "packages/effect-build", "packages/effect-build-apple", "tsconfig.build.json", "LICENSE"], { cwd: upstream, stdout: "pipe", stderr: "pipe" })
if (archive.exitCode !== 0) throw new Error(archive.stderr.toString())
const unpack = Bun.spawnSync(["tar", "-x", "-C", stage], { stdin: archive.stdout, stdout: "pipe", stderr: "pipe" })
if (unpack.exitCode !== 0) throw new Error(unpack.stderr.toString())
mkdirSync(join(stage, "node_modules"))
symlinkSync(join(root, "node_modules/effect"), join(stage, "node_modules/effect"))
writeFileSync(join(stage, "package.json"), JSON.stringify({name:"pr24-research-build",private:true,type:"module",workspaces:["packages/*"]}))
for (const name of ["effect-build", "effect-build-apple"]) {
  const config = join(stage, "packages", name, "tsconfig.json")
  const value = JSON.parse(readFileSync(config, "utf8"))
  value.compilerOptions.tsBuildInfoFile = join(stage, `${name}.tsbuildinfo`)
  // Exact upstream source; stricter declaration checking than upstream build.
  value.compilerOptions.skipLibCheck = false
  value.compilerOptions.lib = ["ES2022", "DOM", "ESNext.Disposable"]
  writeFileSync(config, JSON.stringify(value))
}
run([process.execPath, join(root, "node_modules/typescript/bin/tsc"), "-b", "packages/effect-build", "packages/effect-build-apple"])
const artifacts = join(stage, "artifacts")
mkdirSync(artifacts)
const packages = []
for (const name of ["effect-build", "effect-build-apple"]) {
  const manifestPath = join(stage,"packages",name,"package.json")
  const manifest = JSON.parse(readFileSync(manifestPath,"utf8"))
  if (manifest.dependencies?.["effect-build"] === "workspace:^") {
    manifest.dependencies["effect-build"] = "^0.6.0"
    writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n")
  }
  const packed = run([process.execPath, "pm", "pack", "--ignore-scripts", "--destination", artifacts, "--quiet"], join(stage, "packages", name))
  const path = join(artifacts, `${name}-0.6.0.tgz`)
  const bytes = readFileSync(path)
  packages.push({name, version:"0.6.0", path, sha256:createHash("sha256").update(bytes).digest("hex"), bytes:bytes.length, packed})
}
const receipt = {schema:"apple-research-upstream-build/1", revision, stage, effectVersion:JSON.parse(readFileSync(join(root,"node_modules/effect/package.json"),"utf8")).version, declarationPatch:"patches/effect@4.0.0-rc.108.patch", compiler:run([process.execPath,join(root,"node_modules/typescript/bin/tsc"),"--version"]), strictDeclarations:true, configOverrides:{lib:["ES2022","DOM","ESNext.Disposable"],tsBuildInfoFile:"temporary tree"}, packingNormalization:{"effect-build-apple.dependencies.effect-build":"workspace:^ -> ^0.6.0"}, packages}
writeFileSync(join(import.meta.dir,"upstream-build.json"),JSON.stringify(receipt,null,2)+"\n")
console.log(JSON.stringify(receipt,null,2))
