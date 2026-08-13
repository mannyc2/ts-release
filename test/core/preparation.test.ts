import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CredentialRef } from "../../src/model/authority.js"
import { sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath, Version, WorkspaceRoot } from "../../src/model/primitives.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTokenAuthentication
} from "../../src/recipes/config.js"
import { DriverError } from "../../src/drivers/errors.js"
import {
  StagingSnapshot,
  VerifiedPackage,
  VerifiedReleaseContext,
  VerifiedSource
} from "../../src/release/context.js"
import {
  CapabilityContribution,
  GraphCommandArtifact,
  GraphCommandCheck,
  GraphNpmPackageBuild,
  GraphNpmPublication,
  OutputDeclaration,
  linkContributions,
  makeNpmPublicationAuthorityIntent
} from "../../src/release/graph.js"
import { prepareRelease, PreparationError, type PreparationRequest } from "../../src/release/prepare.js"
import { makeLocalPreparedReleaseStore } from "../../src/release/prepared-store.js"
import { decodePreparedRelease, encodePreparedRelease } from "../../src/release/prepared.js"
import { materializeGitSource } from "../../src/platform/source-observer.js"
import type { RunCommand } from "../../src/drivers/process.js"

const git = (root: string, ...argv: string[]): string => {
  const result = spawnSync("git", argv, { cwd: root, encoding: "utf8", stdio: "pipe" })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}

const repository = (
  files: Readonly<Record<string, string>> = { "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" }) }
) => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-prepare-source-"))
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  git(root, "init", "-q")
  git(root, "config", "user.email", "fixture@example.test")
  git(root, "config", "user.name", "fixture")
  git(root, "add", ".")
  git(root, "commit", "-qm", "fixture")
  const manifest = new Uint8Array(readFileSync(join(root, "package.json")))
  const source = VerifiedSource.make({
    commit: NonEmptyName.make(git(root, "rev-parse", "HEAD")),
    tree: NonEmptyName.make(git(root, "rev-parse", "HEAD^{tree}")),
    clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"),
    packageManifestDigest: sha256Digest(manifest),
    headTags: []
  })
  const context = VerifiedReleaseContext.make({
    workspace: WorkspaceRoot.make(root),
    source,
    package: VerifiedPackage.make({
      name: NonEmptyName.make("fixture"),
      version: Version.make("1.0.0"),
      path: SafeRelativePath.make("package.json"),
      digest: source.packageManifestDigest
    })
  })
  return { root, context }
}

const materialize = (
  context: VerifiedReleaseContext,
  destination: WorkspaceRoot
): Effect.Effect<StagingSnapshot, unknown> => Effect.try({
  try: () => materializeGitSource(context.workspace, context.source, destination),
  catch: (cause) => cause
})

const requestFor = (fixture: ReturnType<typeof repository>, run: RunCommand): PreparationRequest => {
  const output = OutputDeclaration.make({
    id: OutputId.make("generated"), path: SafeRelativePath.make("generated.txt"), kind: "file"
  })
  const graph = linkContributions([CapabilityContribution.make({
    artifacts: [],
    publications: [],
    preparations: [
      GraphCommandCheck.make({ id: OperationId.make("check"), argv: ["check"], cwd: SafeRelativePath.make("."), inputs: [] }),
      GraphCommandArtifact.make({
        id: OperationId.make("generate"), argv: ["generate", "{output:generated}"], cwd: SafeRelativePath.make("."),
        inputs: [], outputs: [output]
      })
    ]
  })])
  return {
    context: fixture.context,
    graph,
    store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
    run,
    materializeSource: materialize
  }
}

const bunRequestFor = (fixture: ReturnType<typeof repository>, run: RunCommand): PreparationRequest => {
  const graph = linkContributions([CapabilityContribution.make({
    artifacts: [],
    publications: [],
    preparations: [GraphCommandCheck.make({
      id: OperationId.make("bun-check"), argv: ["bun", "run", "check"], cwd: SafeRelativePath.make("."), inputs: []
    })]
  })])
  return {
    context: fixture.context,
    graph,
    store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
    run,
    materializeSource: materialize
  }
}

const bunCompileRequestFor = (
  fixture: ReturnType<typeof repository>,
  run: RunCommand,
  operation = "fixture-build"
): PreparationRequest => {
  const output = OutputDeclaration.make({
    id: OutputId.make("compiled"),
    path: SafeRelativePath.make(".release/compiled"),
    kind: "executable"
  })
  const graph = linkContributions([CapabilityContribution.make({
    artifacts: [],
    publications: [],
    preparations: [GraphCommandArtifact.make({
      id: OperationId.make(operation),
      argv: [
        "bun",
        "build",
        "src/index.ts",
        "--compile",
        "--target",
        "bun-darwin-arm64",
        "--outfile",
        ".release/compiled"
      ],
      cwd: SafeRelativePath.make("."),
      inputs: [],
      outputs: [output]
    })]
  })])
  return {
    context: fixture.context,
    graph,
    store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
    run,
    materializeSource: materialize
  }
}

const npmBuildRequestFor = (
  fixture: ReturnType<typeof repository>,
  run: RunCommand,
  argv: [string, ...string[]] = ["fixture-build"],
  outputRoot = "dist"
): PreparationRequest => {
  const packageArtifact = OutputDeclaration.make({
    id: OutputId.make("npm-package"), path: SafeRelativePath.make("."), kind: "package"
  })
  const graph = linkContributions([CapabilityContribution.make({
    artifacts: [packageArtifact],
    publications: [],
    preparations: [GraphNpmPackageBuild.make({
      id: OperationId.make("build:npm-package"),
      argv,
      cwd: SafeRelativePath.make("."),
      inputs: [],
      outputRoots: [SafeRelativePath.make(outputRoot)]
    })]
  })])
  return {
    context: fixture.context,
    graph,
    store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
    run,
    materializeSource: materialize
  }
}

describe("verified private preparation boundary", () => {
  test("runs commands in exact-commit staging and stores only declared outputs", async () => {
    const fixture = repository()
    const seenCwds: string[] = []
    const run: RunCommand = ({ argv, cwd, environmentNames }) => Effect.sync(() => {
      seenCwds.push(cwd)
      expect(environmentNames).toEqual([])
      if (argv[0] === "generate") writeFileSync(join(cwd, "generated.txt"), "generated\n")
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      const { bundle } = await Effect.runPromise(prepareRelease(requestFor(fixture, run)))
      expect(seenCwds.every((cwd) => cwd !== fixture.root)).toBe(true)
      expect(existsSync(join(fixture.root, "generated.txt"))).toBe(false)
      expect(bundle.manifest.kind).toBe("complete")
      expect(bundle.manifest.source.materialized?.digest.hex).toBe(bundle.manifest.provenance?.source.digest.hex)
      expect(bundle.manifest.provenance?.execution).toMatchObject({ environment: "closed", network: "prohibited" })
      expect(bundle.manifest.artifacts[0]?.producer?.toString()).toBe("generate")
      expect(new TextDecoder().decode(bundle.blobs.get("generated"))).toBe("generated\n")
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test.each(["package.json", ".undeclared-cache"])("rejects a command mutation outside declared outputs: %s", async (path) => {
    const fixture = repository()
    const run: RunCommand = ({ argv, cwd }) => Effect.sync(() => {
      if (argv[0] === "generate") {
        writeFileSync(join(cwd, "generated.txt"), "generated\n")
        writeFileSync(join(cwd, path), "mutated\n")
      }
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      await expect(Effect.runPromise(prepareRelease(requestFor(fixture, run)))).rejects.toMatchObject({
        _tag: "PreparationError",
        reason: expect.stringContaining(path)
      })
      expect(existsSync(join(fixture.root, ".release"))).toBe(false)
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test.each([
    ["undeclared mutation", "changed undeclared staged paths", (cwd: string): number => {
      mkdirSync(join(cwd, "dist")); writeFileSync(join(cwd, "dist", "index.js"), "built\n")
      writeFileSync(join(cwd, ".build-cache"), "undeclared\n")
      return 0
    }],
    ["missing output root", "is missing, linked, or outside", (): number => 0],
    ["linked output root", "is missing, linked, or outside", (cwd: string): number => {
      symlinkSync(join(cwd, "src"), join(cwd, "dist"), "dir")
      return 0
    }],
    ["nonzero command", "exited 17", (cwd: string): number => {
      mkdirSync(join(cwd, "dist")); writeFileSync(join(cwd, "dist", "partial.js"), "partial\n")
      return 17
    }]
  ] as const)("npm build rejects %s and cleans its private output", async (_name, reason, effect) => {
    const fixture = repository({
      ".gitignore": "dist\n.build-cache\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" }),
      "src/index.ts": "export const fixture = true\n"
    })
    let stage = ""
    const run: RunCommand = ({ cwd }) => Effect.sync(() => {
      stage = cwd
      return { exitCode: effect(cwd), stdout: "", stderr: "fixture failure" }
    })
    try {
      await expect(Effect.runPromise(prepareRelease(npmBuildRequestFor(fixture, run)))).rejects.toMatchObject({
        _tag: "PreparationError",
        reason: expect.stringContaining(reason)
      })
      expect(stage).not.toBe(fixture.root)
      expect(existsSync(join(stage, "dist"))).toBe(false)
      expect(existsSync(join(fixture.root, "dist"))).toBe(false)
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("helper, Bun compile runtime, and release graph independently change the preparation basis", async () => {
    const fixture = repository({
      ".gitignore": ".release\n",
      "bun.lock": "fixture lock\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" }),
      "src/index.ts": "console.log('fixture')\n"
    })
    let helper = "1".repeat(64)
    let compileRuntime = "5".repeat(64)
    const run: RunCommand = ({ argv, cwd }) => Effect.sync(() => {
      if (argv[1] === "--version") return { exitCode: 0, stdout: "1.3.14\n", stderr: "" }
      if (argv[1] === "install") {
        mkdirSync(join(cwd, "node_modules"))
        return { exitCode: 0, stdout: "", stderr: "" }
      }
      mkdirSync(join(cwd, ".release")); writeFileSync(join(cwd, ".release", "compiled"), "same bytes\n")
      return {
        exitCode: 0, stdout: "", stderr: "",
        networkIsolation: {
          protocol: "ts-release-seccomp-network-deny/v1",
          helperSha256: helper,
          librarySha256: "2".repeat(64),
          bunVersion: "1.3.14",
          bunSha256: "3".repeat(64),
          kernel: "fixture-kernel",
          architecture: "x64",
          deniedSyscalls: ["socket"]
        },
        bunCompileRuntime: {
          protocol: "ts-release-bun-compile-runtime/v1",
          target: "bun-darwin-arm64",
          bunVersion: "1.3.14",
          source: "host-cache-private-copy",
          cacheFile: "bun-darwin-aarch64-v1.3.14",
          sha256: compileRuntime
        }
      }
    })
    try {
      const first = await Effect.runPromise(prepareRelease(bunCompileRequestFor(fixture, run, "fixture-build-a")))
      helper = "4".repeat(64)
      const changedHelper = await Effect.runPromise(prepareRelease(bunCompileRequestFor(fixture, run, "fixture-build-a")))
      compileRuntime = "6".repeat(64)
      const changedRuntime = await Effect.runPromise(prepareRelease(bunCompileRequestFor(fixture, run, "fixture-build-a")))
      const changedGraph = await Effect.runPromise(prepareRelease(bunCompileRequestFor(fixture, run, "fixture-build-b")))
      expect(changedHelper.bundle.manifest.provenance.execution.releaseGraph.hex)
        .toBe(first.bundle.manifest.provenance.execution.releaseGraph.hex)
      expect(changedHelper.bundle.manifest.provenance.inputBasis.hex)
        .not.toBe(first.bundle.manifest.provenance.inputBasis.hex)
      expect(changedRuntime.bundle.manifest.provenance.execution.bunCompileRuntimes)
        .toContain(`\"sha256\":\"${"6".repeat(64)}\"`)
      expect(changedRuntime.bundle.manifest.provenance.inputBasis.hex)
        .not.toBe(changedHelper.bundle.manifest.provenance.inputBasis.hex)
      expect(changedGraph.bundle.manifest.provenance.execution.releaseGraph.hex)
        .not.toBe(changedRuntime.bundle.manifest.provenance.execution.releaseGraph.hex)
      expect(changedGraph.bundle.manifest.provenance.inputBasis.hex)
        .not.toBe(changedRuntime.bundle.manifest.provenance.inputBasis.hex)
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("refuses a successful certified Bun compile without an exact runtime identity", async () => {
    const fixture = repository({
      ".gitignore": ".release\n",
      "bun.lock": "fixture lock\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" }),
      "src/index.ts": "console.log('fixture')\n"
    })
    const run: RunCommand = ({ argv, cwd }) => Effect.sync(() => {
      if (argv[1] === "--version") return { exitCode: 0, stdout: "1.3.14\n", stderr: "" }
      if (argv[1] === "install") {
        mkdirSync(join(cwd, "node_modules"))
      } else {
        mkdirSync(join(cwd, ".release"))
        writeFileSync(join(cwd, ".release", "compiled"), "compiled\n")
      }
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      await expect(Effect.runPromise(prepareRelease(bunCompileRequestFor(fixture, run))))
        .rejects.toMatchObject({
          _tag: "PreparationError",
          reason: expect.stringContaining("did not report its exact runtime identity")
        })
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("rejects declaring verified source as a writable command output", async () => {
    const fixture = repository()
    const output = OutputDeclaration.make({
      id: OutputId.make("manifest-output"), path: SafeRelativePath.make("package.json"), kind: "file"
    })
    const graph = linkContributions([CapabilityContribution.make({
      artifacts: [], publications: [], preparations: [GraphCommandArtifact.make({
        id: OperationId.make("overwrite-source"), argv: ["overwrite"], cwd: SafeRelativePath.make("."),
        inputs: [], outputs: [output]
      })]
    })])
    let runs = 0
    try {
      await expect(Effect.runPromise(prepareRelease({
        context: fixture.context,
        graph,
        store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
        run: () => Effect.sync(() => {
          runs += 1
          return { exitCode: 0, stdout: "", stderr: "" }
        }),
        materializeSource: materialize
      }))).rejects.toMatchObject({ reason: expect.stringContaining("overlaps verified source") })
      expect(runs).toBe(0)
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("ignored and untracked files do not enter exact source materialization", async () => {
    const first = repository({
      ".gitignore": "ignored.txt\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" })
    })
    writeFileSync(join(first.root, "ignored.txt"), "first\n")
    const second = repository({
      ".gitignore": "ignored.txt\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" })
    })
    writeFileSync(join(second.root, "ignored.txt"), "second\n")
    const run: RunCommand = ({ argv, cwd }) => Effect.sync(() => {
      if (argv[0] === "generate") writeFileSync(join(cwd, "generated.txt"), "same\n")
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      const one = await Effect.runPromise(prepareRelease(requestFor(first, run)))
      const two = await Effect.runPromise(prepareRelease(requestFor(second, run)))
      expect(one.bundle.manifest.source.materialized?.digest.hex).toBe(two.bundle.manifest.source.materialized?.digest.hex)
      expect(one.bundle.manifest.artifacts[0]?.digest.hex).toBe(two.bundle.manifest.artifacts[0]?.digest.hex)
    } finally {
      rmSync(first.root, { recursive: true, force: true })
      rmSync(second.root, { recursive: true, force: true })
    }
  })

  test("a declared untracked input is privately copied and changes prepared identity", async () => {
    const prepare = async (contents: string) => {
      const fixture = repository({
        ".gitignore": "input.txt\n",
        "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" })
      })
      writeFileSync(join(fixture.root, "input.txt"), contents)
      const input = OutputDeclaration.make({ id: OutputId.make("input"), path: SafeRelativePath.make("input.txt"), kind: "file" })
      const graph = linkContributions([CapabilityContribution.make({ artifacts: [input], preparations: [], publications: [] })])
      const result = await Effect.runPromise(prepareRelease({
        context: fixture.context,
        graph,
        store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
        run: () => Effect.succeed({ exitCode: 0, stdout: "", stderr: "" }),
        materializeSource: materialize
      }))
      rmSync(fixture.root, { recursive: true, force: true })
      return result.bundle.manifest.provenance!
    }
    const first = await prepare("first\n")
    const second = await prepare("second\n")
    expect(first.externalInputs[0]?.digest.hex).not.toBe(second.externalInputs[0]?.digest.hex)
    expect(first.inputBasis.hex).not.toBe(second.inputBasis.hex)
  })

  test("source drift between verification and materialization fails before any command", async () => {
    const fixture = repository()
    let runs = 0
    writeFileSync(join(fixture.root, "package.json"), "drifted\n")
    const run: RunCommand = () => Effect.sync(() => {
      runs += 1
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      await expect(Effect.runPromise(prepareRelease(requestFor(fixture, run)))).rejects.toBeInstanceOf(PreparationError)
      expect(runs).toBe(0)
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("materializes a tracked-lock Bun dependency tree once and binds tool plus lockfile basis", async () => {
    const fixture = repository({
      "bun.lock": "lockfile fixture\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" })
    })
    const calls: Array<{ readonly argv: ReadonlyArray<string>, readonly network: "deny" | "offline-cli" }> = []
    let reportedVersion = "1.3.14"
    const run: RunCommand = ({ argv, cwd, network }) => Effect.sync(() => {
      calls.push({ argv, network })
      if (argv[1] === "--version") return { exitCode: 0, stdout: `${reportedVersion}\n`, stderr: "" }
      if (argv[1] === "install") {
        mkdirSync(join(cwd, "node_modules", "fixture-dependency"), { recursive: true })
        writeFileSync(join(cwd, "node_modules", "fixture-dependency", "index.js"), "export {}\n")
      }
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      const { bundle } = await Effect.runPromise(prepareRelease(bunRequestFor(fixture, run)))
      expect(calls.slice(0, 3).map((call) => [call.argv.slice(0, 2), call.network])).toEqual([
        [["bun", "--version"], "offline-cli"],
        [["bun", "install"], "offline-cli"],
        [["bun", "run"], "deny"]
      ])
      expect(calls[1]?.argv).toEqual([
        "bun",
        "install",
        "--offline",
        "--frozen-lockfile",
        "--ignore-scripts",
        "--no-save",
        "--linker=hoisted"
      ])
      const dependency = bundle.manifest.provenance.externalInputs[0]
      expect(dependency).toMatchObject({ path: "node_modules", kind: "directory" })
      expect(dependency?.materializer).toContain("bun@1.3.14")
      expect(dependency?.materializationBasis).toHaveLength(2)
      expect(bundle.manifest.provenance.execution.runtime).toBe("bun@1.3.14")
      reportedVersion = "1.3.15"
      const changed = await Effect.runPromise(prepareRelease(bunRequestFor(fixture, run)))
      expect(changed.bundle.manifest.provenance.inputBasis.hex).not.toBe(bundle.manifest.provenance.inputBasis.hex)
      expect(changed.bundle.manifest.provenance.execution.runtime).toBe("bun@1.3.15")
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("fails closed before spawning when Bun preparation lacks a tracked lockfile", async () => {
    const fixture = repository()
    let runs = 0
    const run: RunCommand = () => Effect.sync(() => {
      runs += 1
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      await expect(Effect.runPromise(prepareRelease(bunRequestFor(fixture, run)))).rejects.toMatchObject({
        _tag: "PreparationError",
        reason: expect.stringContaining("tracked root bun.lock")
      })
      expect(runs).toBe(0)
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("rejects isolated-install cache writes outside node_modules", async () => {
    const fixture = repository({
      "bun.lock": "lockfile fixture\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" })
    })
    const run: RunCommand = ({ argv, cwd }) => Effect.sync(() => {
      if (argv[1] === "--version") return { exitCode: 0, stdout: "1.3.14\n", stderr: "" }
      if (argv[1] === "install") {
        mkdirSync(join(cwd, "node_modules"))
        writeFileSync(join(cwd, ".undeclared-bun-cache"), "cache\n")
      }
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      await expect(Effect.runPromise(prepareRelease(bunRequestFor(fixture, run)))).rejects.toMatchObject({
        _tag: "PreparationError",
        reason: expect.stringContaining("undeclared cache")
      })
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("rejects a private dependency tree hardlinked to live workspace bytes", async () => {
    const fixture = repository({
      "bun.lock": "lockfile fixture\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0" })
    })
    mkdirSync(join(fixture.root, "node_modules", "aliased"), { recursive: true })
    const live = join(fixture.root, "node_modules", "aliased", "index.js")
    writeFileSync(live, "workspace dependency\n")
    const run: RunCommand = ({ argv, cwd }) => Effect.sync(() => {
      if (argv[1] === "--version") return { exitCode: 0, stdout: "1.3.14\n", stderr: "" }
      if (argv[1] === "install") {
        mkdirSync(join(cwd, "node_modules", "aliased"), { recursive: true })
        linkSync(live, join(cwd, "node_modules", "aliased", "index.js"))
      }
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    try {
      await expect(Effect.runPromise(prepareRelease(bunRequestFor(fixture, run)))).rejects.toMatchObject({
        _tag: "PreparationError",
        reason: expect.stringContaining("aliases a workspace inode")
      })
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("rejects an ignored npm files literal unless its bytes are explicitly declared", async () => {
    const fixture = repository({
      ".gitignore": "payload.txt\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0", files: ["payload.txt"] })
    })
    writeFileSync(join(fixture.root, "payload.txt"), "not verified\n")
    const packageArtifact = OutputDeclaration.make({
      id: OutputId.make("npm-package"), path: SafeRelativePath.make("."), kind: "package"
    })
    const authentication = NpmTokenAuthentication.make({ strategy: "token", credential: CredentialRef.make("NPM_TOKEN") })
    const graph = linkContributions([CapabilityContribution.make({ artifacts: [packageArtifact], preparations: [], publications: [
      GraphNpmPublication.make({
        id: OperationId.make("npm-release"), packageName: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
        registryUrl: CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/"), packageArtifact: packageArtifact.id,
        distTag: NpmDistTag.make("latest"), access: "public", authentication, provenance: "disabled",
        authority: makeNpmPublicationAuthorityIntent({
          packageName: "fixture", version: "1.0.0", registryUrl: "https://registry.npmjs.org/",
          distTag: "latest", authentication
        })
      })
    ] })])
    let runs = 0
    try {
      await expect(Effect.runPromise(prepareRelease({
        context: fixture.context,
        graph,
        store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
        run: () => Effect.sync(() => {
          runs += 1
          return { exitCode: 0, stdout: "", stderr: "" }
        }),
        materializeSource: materialize
      }))).rejects.toMatchObject({
        _tag: "PreparationError",
        reason: expect.stringContaining("declare non-Git bytes as an explicit input")
      })
      expect(runs).toBe(0)
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  })

  test("npm package build produces ignored package bytes before exact offline npm pack", async () => {
    const fixture = repository({
      ".gitignore": "dist\n",
      "package.json": JSON.stringify({ name: "fixture", version: "1.0.0", files: ["dist"] }),
      "src/index.ts": "export const fixture = true\n"
    })
    const packageArtifact = OutputDeclaration.make({
      id: OutputId.make("npm-package"), path: SafeRelativePath.make("."), kind: "package"
    })
    const authentication = NpmTokenAuthentication.make({ strategy: "token", credential: CredentialRef.make("NPM_TOKEN") })
    const build = GraphNpmPackageBuild.make({
      id: OperationId.make("build:npm-package"),
      argv: ["fixture-build"],
      cwd: SafeRelativePath.make("."),
      inputs: [],
      outputRoots: [SafeRelativePath.make("dist")]
    })
    const graph = linkContributions([CapabilityContribution.make({ artifacts: [packageArtifact], preparations: [build], publications: [
      GraphNpmPublication.make({
        id: OperationId.make("npm-release"), packageName: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
        registryUrl: CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/"), packageArtifact: packageArtifact.id,
        distTag: NpmDistTag.make("latest"), access: "public", authentication, provenance: "disabled",
        authority: makeNpmPublicationAuthorityIntent({
          packageName: "fixture", version: "1.0.0", registryUrl: "https://registry.npmjs.org/",
          distTag: "latest", authentication
        })
      })
    ] })])
    const commands: string[] = []
    let npmToolDigest = "a".repeat(64)
    const run: RunCommand = ({ argv, cwd }) => Effect.try({
      try: () => {
        commands.push(argv.join(" "))
        if (argv[0] === "fixture-build") {
          mkdirSync(join(cwd, "dist"), { recursive: true })
          writeFileSync(join(cwd, "dist", "index.js"), "export const fixture = true\n")
          return { exitCode: 0, stdout: "", stderr: "" }
        }
        if (argv[0] === "npm" && argv[1] === "--version") {
          return {
            exitCode: 0,
            stdout: "10.9.4\n",
            stderr: "",
            tool: { protocol: "ts-release-executable/v1", command: "npm", sha256: npmToolDigest }
          }
        }
        if (argv[0] !== "npm" || argv[1] !== "pack") throw new Error(`Unexpected npm fixture command: ${argv.join(" ")}`)
        const destinationIndex = argv.indexOf("--pack-destination")
        const destination = destinationIndex < 0 ? undefined : argv[destinationIndex + 1]
        if (destination === undefined) throw new Error("npm pack fixture omitted its private destination")
        mkdirSync(join(cwd, destination), { recursive: true })
        writeFileSync(join(cwd, destination, "fixture-1.0.0.tgz"), "deterministic fixture tarball\n")
        const packed = join(cwd, "dist", "index.js")
        return {
          exitCode: 0,
          stdout: JSON.stringify([{ files: [{ path: "dist/index.js", size: readFileSync(packed).byteLength, mode: 0o644 }] }]),
          stderr: "",
          tool: { protocol: "ts-release-executable/v1", command: "npm", sha256: npmToolDigest }
        }
      },
      catch: (cause) => DriverError.make({
        reason: cause instanceof Error ? cause.message : String(cause), commitment: "before-commit"
      })
    })
    try {
      const { bundle } = await Effect.runPromise(prepareRelease({
        context: fixture.context,
        graph,
        store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared")),
        run,
        materializeSource: materialize
      }))
      const publication = bundle.manifest.publications[0]
      expect(publication?._tag).toBe("PreparedNpmPublication")
      expect(bundle.manifest.artifacts[0]).toMatchObject({ producer: "npm-pack:npm-release", mediaType: "application/gzip" })
      expect(bundle.manifest.provenance.execution.npmPack).toContain("ts-release-npm-pack/v1")
      expect(bundle.manifest.provenance.execution.npmPack).toContain(`\"sha256\":\"${"a".repeat(64)}\"`)
      expect(bundle.manifest.provenance.execution.releaseGraph.hex).toMatch(/^[a-f0-9]{64}$/u)
      expect(commands[0]).toBe("fixture-build")
      expect(commands[1]).toBe("npm --version")
      expect(commands[2]?.startsWith("npm pack . --json --offline --ignore-scripts")).toBe(true)
      expect(decodePreparedRelease(encodePreparedRelease(bundle.manifest)).kind).toBe("complete")
      npmToolDigest = "b".repeat(64)
      const changedNpm = await Effect.runPromise(prepareRelease({
        context: fixture.context,
        graph,
        store: makeLocalPreparedReleaseStore(join(fixture.root, ".release", "prepared-second")),
        run,
        materializeSource: materialize
      }))
      expect(changedNpm.bundle.manifest.provenance.execution.releaseGraph.hex)
        .toBe(bundle.manifest.provenance.execution.releaseGraph.hex)
      expect(changedNpm.bundle.manifest.provenance.execution.npmPack)
        .toContain(`\"sha256\":\"${"b".repeat(64)}\"`)
      expect(changedNpm.bundle.manifest.provenance.inputBasis.hex)
        .not.toBe(bundle.manifest.provenance.inputBasis.hex)
    } finally { rmSync(fixture.root, { recursive: true, force: true }) }
  }, 20_000)
})
