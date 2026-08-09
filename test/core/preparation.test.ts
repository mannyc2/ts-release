import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath, Version, WorkspaceRoot } from "../../src/model/primitives.js"
import { OutputDeclaration } from "../../src/model/operation.js"
import { DriverError } from "../../src/model/run.js"
import { VerifiedPackage, VerifiedReleaseContext, VerifiedSource } from "../../src/release/context.js"
import { CapabilityContribution, GraphCommandArtifact, GraphCommandCheck, GraphNpmPublication, linkContributions } from "../../src/release/graph.js"
import { prepareRelease, PreparationError, type PreparationRequest } from "../../src/release/prepare.js"
import type { RunCommand } from "../../src/drivers/process.js"

const contextFor = (root: string, commit = "abc123") => VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(root),
  source: VerifiedSource.make({ commit: NonEmptyName.make(commit), tree: NonEmptyName.make("tree123"), clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: NonEmptyName.make("sha256:manifest"), headTags: [] }),
  package: VerifiedPackage.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
    path: SafeRelativePath.make("package.json"), digest: NonEmptyName.make("sha256:manifest") })
})
const requestFor = (root: string, run: RunCommand, verifySource = (context: VerifiedReleaseContext) => Effect.succeed(context)): PreparationRequest => {
  const output = OutputDeclaration.make({ id: OutputId.make("generated"), path: SafeRelativePath.make("generated.txt"), kind: "file", provenance: "process" })
  const graph = linkContributions([CapabilityContribution.make({ artifacts: [], publications: [], preparations: [
    GraphCommandCheck.make({ id: OperationId.make("check"), argv: ["check"], cwd: SafeRelativePath.make("."), environmentNames: [], inputs: [], sourceCommit: NonEmptyName.make("abc123") }),
    GraphCommandArtifact.make({ id: OperationId.make("generate"), argv: ["generate", "{output:generated}"], cwd: SafeRelativePath.make("."), environmentNames: [], inputs: [], outputs: [output], sourceCommit: NonEmptyName.make("abc123") })
  ] })])
  return { context: contextFor(root), graph, storeDirectory: join(root, ".release", "prepared"), run, verifySource }
}

describe("local preparation boundary", () => {
  test("runs checks and generators through one argv executor and stores only declared outputs", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepare-"))
    writeFileSync(join(root, "package.json"), "{}")
    const seen: Array<ReadonlyArray<string>> = []
    const seenCwds: string[] = []
    const run: RunCommand = ({ argv, cwd }) => Effect.sync(() => {
      seen.push(argv)
      seenCwds.push(cwd)
      if (argv[0] === "generate") writeFileSync(join(cwd, "generated.txt"), "generated\n")
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    const bundle = await Effect.runPromise(prepareRelease(requestFor(root, run)))
    expect(seen).toEqual([["check"], ["generate", "generated.txt"]])
    expect(seenCwds.every((cwd) => cwd !== root)).toBe(true)
    expect(existsSync(join(root, "generated.txt"))).toBe(false)
    expect(bundle.manifest.artifacts.map((artifact) => artifact.id.toString())).toEqual(["generated"])
    expect(new TextDecoder().decode(bundle.blobs.get("generated"))).toBe("generated\n")
  })

  test("command failure produces no prepared bundle and no durable check receipt", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepare-"))
    writeFileSync(join(root, "package.json"), "{}")
    const run: RunCommand = () => Effect.succeed({ exitCode: 1, stdout: "", stderr: "failed" })
    await expect(Effect.runPromise(prepareRelease(requestFor(root, run)))).rejects.toBeInstanceOf(PreparationError)
    expect(existsSync(join(root, ".release", "prepared"))).toBe(false)
  })

  test("source identity is reverified before another preparation can consume outputs", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepare-"))
    writeFileSync(join(root, "package.json"), "{}")
    let observations = 0
    const run: RunCommand = ({ cwd }) => Effect.sync(() => {
      writeFileSync(join(cwd, "generated.txt"), "generated\n")
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    const verifySource = (context: VerifiedReleaseContext) => Effect.succeed(++observations === 1 ? context : contextFor(root, "changed"))
    await expect(Effect.runPromise(prepareRelease(requestFor(root, run, verifySource)))).rejects.toBeInstanceOf(PreparationError)
    expect(existsSync(join(root, ".release", "prepared"))).toBe(false)
  })

  test("rejects a trusted command that mutates a declared input in staging", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepare-input-"))
    writeFileSync(join(root, "package.json"), "{}")
    writeFileSync(join(root, "input.txt"), "before\n")
    const input = OutputDeclaration.make({ id: OutputId.make("input"), path: SafeRelativePath.make("input.txt"), kind: "file", provenance: "import" })
    const output = OutputDeclaration.make({ id: OutputId.make("output"), path: SafeRelativePath.make("output.txt"), kind: "file", provenance: "process" })
    const graph = linkContributions([CapabilityContribution.make({ artifacts: [input], publications: [], preparations: [GraphCommandArtifact.make({
      id: OperationId.make("mutate"), argv: ["mutate", "{input:input}", "{output:output}"], cwd: SafeRelativePath.make("."), environmentNames: [],
      inputs: [input.id], outputs: [output], sourceCommit: NonEmptyName.make("abc123")
    })] })])
    const run: RunCommand = ({ cwd }) => Effect.sync(() => {
      writeFileSync(join(cwd, "input.txt"), "after\n")
      writeFileSync(join(cwd, "output.txt"), "output\n")
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    await expect(Effect.runPromise(prepareRelease({ context: contextFor(root), graph, storeDirectory: join(root, ".release", "prepared"), run,
      verifySource: (value) => Effect.succeed(value) }))).rejects.toBeInstanceOf(PreparationError)
    expect(existsSync(join(root, ".release", "prepared"))).toBe(false)
  })

  test("npm publication is bound to the exact tarball produced during preparation", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-npm-"))
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-pack", version: "1.0.0", files: ["lib"] }))
    mkdirSync(join(root, "lib"), { recursive: true })
    writeFileSync(join(root, "lib", "index.js"), "export const fixture = true\n")
    const packageArtifact = OutputDeclaration.make({ id: OutputId.make("npm-package"), path: SafeRelativePath.make("."), kind: "package", provenance: "build" })
    const graph = linkContributions([CapabilityContribution.make({ artifacts: [packageArtifact], preparations: [], publications: [
      GraphNpmPublication.make({ id: OperationId.make("npm-release"), packageName: NonEmptyName.make("fixture-pack"), version: NonEmptyName.make("1.0.0"), registryUrl: "https://registry.npmjs.org", artifactIds: [packageArtifact.id] })
    ] })])
    const run: RunCommand = ({ argv, cwd }) => Effect.try({ try: () => {
      const result = spawnSync(argv[0]!, argv.slice(1), { cwd, encoding: "utf8", stdio: "pipe" })
      if (result.error !== undefined) throw result.error
      return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr }
    }, catch: (cause) => DriverError.make({ reason: cause instanceof Error ? cause.message : String(cause), commitment: "before-commit" }) })
    const context = contextFor(root)
    const bundle = await Effect.runPromise(prepareRelease({ context, graph, storeDirectory: join(root, ".release", "prepared"), run,
      verifySource: (value) => Effect.succeed(value) }))
    const publication = bundle.manifest.publications[0]
    expect(publication?._tag).toBe("PreparedNpmPublication")
    expect(publication?._tag === "PreparedNpmPublication" ? publication.artifactId.toString() : "").toBe("npm-tarball:npm-release")
    expect(bundle.manifest.artifacts.some((artifact) => artifact.id.toString() === "npm-package")).toBe(false)
    expect(bundle.blobs.has("npm-tarball:npm-release")).toBe(true)
  })
})
