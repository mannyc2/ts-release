import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"

interface BuildResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const root = process.cwd()

const makeTempDirectory = Effect.fn("scripts.checkActionBundle.makeTempDirectory")(function*() {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.makeTempDirectory({ prefix: "ts-release-action-bundle-" }).pipe(
    Effect.mapError((cause) => new Error("Failed to create temporary directory.", { cause }))
  )
})

const removeTempDirectory = Effect.fn("scripts.checkActionBundle.removeTempDirectory")(function*(path: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.remove(path, { recursive: true, force: true }).pipe(
    Effect.mapError((cause) => new Error(`Failed to remove temporary directory ${path}.`, { cause }))
  )
})

const ignoreRemoveTempDirectoryError = (path: string) =>
  removeTempDirectory(path).pipe(
    Effect.match({
      onFailure: () => undefined,
      onSuccess: () => undefined
    })
  )

const readBytes = Effect.fn("scripts.checkActionBundle.readBytes")(function*(path: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFile(path).pipe(
    Effect.mapError((cause) => new Error(`Failed to read ${path}.`, { cause }))
  )
})

const readText = Effect.fn("scripts.checkActionBundle.readText")(function*(path: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString(path).pipe(
    Effect.mapError((cause) => new Error(`Failed to read ${path}.`, { cause }))
  )
})

const writeText = Effect.fn("scripts.checkActionBundle.writeText")(function*(
  path: string,
  contents: string
) {
  const fs = yield* FileSystem.FileSystem
  const directory = yield* Path.Path
  yield* fs.makeDirectory(directory.dirname(path), { recursive: true }).pipe(
    Effect.mapError((cause) => new Error(`Failed to create ${directory.dirname(path)}.`, { cause }))
  )
  yield* fs.writeFileString(path, contents).pipe(
    Effect.mapError((cause) => new Error(`Failed to write ${path}.`, { cause }))
  )
})

const commandOutput = (stream: Stream.Stream<Uint8Array, unknown>) =>
  Stream.mkString(Stream.decodeText(stream))

const runChildProcess = Effect.fn("scripts.checkActionBundle.runChildProcess")(function*(
  command: ChildProcess.Command
) {
  const spawner = yield* ChildProcessSpawner
  const output = yield* Effect.scoped(
    Effect.gen(function*() {
      const handle = yield* spawner.spawn(command)
      return yield* Effect.all({
        stdout: commandOutput(handle.stdout),
        stderr: commandOutput(handle.stderr),
        exitCode: handle.exitCode
      }, { concurrency: "unbounded" })
    })
  )
  return {
    exitCode: Number(output.exitCode),
    stdout: output.stdout,
    stderr: output.stderr
  }
})

const buildTempBundle = Effect.fn("scripts.checkActionBundle.buildTempBundle")(function*(
  actionRoot: string,
  outputPath: string
) {
  const result: BuildResult = yield* runChildProcess(
    ChildProcess.make(
      "bun",
      [
        "build",
        "src/index.ts",
        "--target=node",
        "--format=esm",
        "--outfile",
        outputPath
      ],
      {
        cwd: actionRoot,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe"
      }
    )
  ).pipe(
    Effect.mapError((cause) => new Error("Action bundle temp build failed.", { cause }))
  )

  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      new Error(
        [
          `Action bundle temp build failed with exit code ${result.exitCode}.`,
          result.stdout.trim(),
          result.stderr.trim()
        ].filter((line) => line.length > 0).join("\n")
      )
    )
  }
})

const textDecoder = new TextDecoder()

const normalizeBunSourcePathComments = (bundle: Uint8Array): string =>
  textDecoder.decode(bundle).replace(/^\/\/ (.*)$/gm, (line, sourcePath: string) => {
    const normalizedSourcePath = sourcePath.replaceAll("\\", "/")
    const bunStoreIndex = normalizedSourcePath.indexOf(".bun/")
    return bunStoreIndex === -1 ? line : `// ${normalizedSourcePath.slice(bunStoreIndex)}`
  })

const bundlesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  normalizeBunSourcePathComments(left) === normalizeBunSourcePathComments(right)

const staleBundleMessage =
  "Action bundle is stale. Run bun run --cwd apps/ts-release-action build and include apps/ts-release-action/dist/index.js."

// Plan 186 C2. The bundle runs under node20, so a Bun module or a Bun global
// reaching it is a mid-run ReferenceError that no type or test would catch.
const bunSurfaceViolations = (bundle: Uint8Array): ReadonlyArray<string> => {
  const text = textDecoder.decode(bundle)
  const memberAccess = [...text.matchAll(/\bBun\.[A-Za-z_$][A-Za-z0-9_$]*/gu)]
    .map((match) => `bundle reaches ${match[0]}`)
  const platformSpecifier = text.includes("@effect/platform-bun")
    ? ["bundle carries the @effect/platform-bun specifier"]
    : []
  return [...new Set([...platformSpecifier, ...memberAccess])]
}

// Plan 186 C1. The fixture covers every path that was Bun-locked before this
// plan: Exec (which also proves the closed environment), Pack as tar.gz, as
// zip, and from a files pattern, plus Check, Write, and Digest. No publish
// operation appears, so the gate never reaches a network.
const fixtureConfig = {
  project: {
    name: "action-fixture",
    version: "1.0.0",
    tag: "v1.0.0",
    commit: "fixture"
  },
  hooks: {
    before: [{
      id: "env-dump",
      run: ["node", "tools/dump-env.mjs"],
      cwd: ".",
      env: ["FIXTURE_DECLARED"]
    }]
  },
  artifacts: [{ id: "payload", path: "dist/payload.txt", format: "file" }],
  archives: [
    { id: "bundle", ids: ["payload"], formats: ["tar.gz", "zip"] },
    { id: "tree", ids: [], files: ["tree/**"], formats: ["zip"], nameTemplate: "tree_{version}" }
  ],
  checksum: {},
  publish: {}
}
const dumpEnvSource = `import { writeFileSync } from "node:fs"
writeFileSync("env-dump.json", JSON.stringify(process.env))
`

const writeFixtureWorkspace = Effect.fn("scripts.checkActionBundle.writeFixtureWorkspace")(function*(
  workspace: string
) {
  const path = yield* Path.Path
  yield* writeText(
    path.join(workspace, "release.config.json"),
    `${JSON.stringify(fixtureConfig, null, 2)}\n`
  )
  yield* writeText(path.join(workspace, "tools", "dump-env.mjs"), dumpEnvSource)
  yield* writeText(path.join(workspace, "dist", "payload.txt"), "payload\n")
  yield* writeText(path.join(workspace, "tree", "a.txt"), "a\n")
  yield* writeText(path.join(workspace, "tree", "nested", "b.txt"), "b\n")
})

// @actions/core writes `name<<delimiter\nvalue\ndelimiter` lines to GITHUB_OUTPUT.
const parseActionOutputs = (contents: string): Readonly<Record<string, string>> => {
  const outputs: Record<string, string> = {}
  const lines = contents.split("\n")
  let index = 0
  while (index < lines.length) {
    const header = /^([A-Za-z0-9_-]+)<<(.+)$/u.exec(lines[index] ?? "")
    if (header === null) {
      index += 1
      continue
    }
    const [, name, delimiter] = header
    const body: Array<string> = []
    index += 1
    while (index < lines.length && lines[index] !== delimiter) {
      body.push(lines[index]!)
      index += 1
    }
    outputs[name!] = body.join("\n")
    index += 1
  }
  return outputs
}

const nodeMissingMessage =
  "check:action-bundle requires a node binary on PATH to execute the Action bundle in its real runtime (node20). Install Node 20 or newer and re-run; skipping this gate would recreate the defect it exists to catch."

const requireNode = Effect.fn("scripts.checkActionBundle.requireNode")(function*() {
  const result = yield* runChildProcess(
    ChildProcess.make("node", ["--version"], { stdin: "ignore", stdout: "pipe", stderr: "pipe" })
  ).pipe(Effect.mapError(() => new Error(nodeMissingMessage)))
  if (result.exitCode !== 0) return yield* Effect.fail(new Error(nodeMissingMessage))
  const major = Number(/^v(\d+)\./u.exec(result.stdout.trim())?.[1] ?? "0")
  if (major < 20) {
    return yield* Effect.fail(new Error(
      `check:action-bundle needs node >= 20 to match the Action runtime, found ${result.stdout.trim()}.`
    ))
  }
  return result.stdout.trim()
})

const runBundle = Effect.fn("scripts.checkActionBundle.runBundle")(function*(
  bundlePath: string,
  workspace: string,
  outputsPath: string,
  inputs: Readonly<Record<string, string>>
) {
  const fs = yield* FileSystem.FileSystem
  yield* writeText(outputsPath, "")
  const result = yield* runChildProcess(ChildProcess.make("node", [bundlePath], {
    cwd: workspace,
    env: {
      PATH: process.env.PATH,
      GITHUB_WORKSPACE: workspace,
      GITHUB_OUTPUT: outputsPath,
      FIXTURE_DECLARED: "declared-value",
      FIXTURE_UNDECLARED: "ambient-value",
      ...Object.fromEntries(Object.entries(inputs).map(([name, value]) =>
        [`INPUT_${name.toUpperCase()}`, value]))
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })).pipe(Effect.mapError((cause) => new Error("Action bundle execution failed.", { cause })))
  if (result.exitCode !== 0) {
    return yield* Effect.fail(new Error([
      `Action bundle exited ${result.exitCode} under node for command ${inputs.command ?? "plan"}.`,
      result.stdout.trim(),
      result.stderr.trim()
    ].filter((line) => line.length > 0).join("\n")))
  }
  const contents = yield* fs.readFileString(outputsPath).pipe(
    Effect.mapError((cause) => new Error("Action bundle emitted no outputs file.", { cause }))
  )
  return { ...result, outputs: parseActionOutputs(contents) }
})

const expectFile = Effect.fn("scripts.checkActionBundle.expectFile")(function*(
  path: string,
  label: string
) {
  const fs = yield* FileSystem.FileSystem
  const present = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
  if (!present) return yield* Effect.fail(new Error(`Action bundle run did not materialize ${label}.`))
  return yield* readBytes(path)
})

const executeUnderNode = Effect.fn("scripts.checkActionBundle.executeUnderNode")(function*(
  bundlePath: string,
  temporary: string
) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const version = yield* requireNode()
  const workspace = yield* fs.realPath(path.join(temporary, "fixture")).pipe(
    Effect.orElseSucceed(() => path.join(temporary, "fixture"))
  )
  const outputsPath = path.join(temporary, "github-output.txt")
  yield* writeFixtureWorkspace(workspace)
  const realWorkspace = yield* fs.realPath(workspace).pipe(
    Effect.mapError((cause) => new Error("Fixture workspace is unreadable.", { cause }))
  )

  const planned = yield* runBundle(bundlePath, realWorkspace, outputsPath, {
    command: "plan",
    config: "release.config.json",
    "plan-path": "release-plan.json"
  })
  if (planned.outputs.status !== "planned" || (planned.outputs.plan_id ?? "").length === 0) {
    return yield* Effect.fail(new Error("Action bundle plan emitted no plan_id under node."))
  }
  const reviewed = yield* runBundle(bundlePath, realWorkspace, outputsPath, {
    command: "apply",
    "review-only": "true",
    "plan-path": "release-plan.json",
    "plan-id": planned.outputs.plan_id!,
    scope: "all"
  })
  const reviewId = reviewed.outputs.execution_review_id ?? ""
  if (reviewId.length === 0) {
    return yield* Effect.fail(new Error("Action bundle review emitted no execution_review_id."))
  }
  const applied = yield* runBundle(bundlePath, realWorkspace, outputsPath, {
    command: "apply",
    "plan-path": "release-plan.json",
    "plan-id": planned.outputs.plan_id!,
    "new-run": ".release/run.json",
    "confirm-execution": reviewId,
    reviewer: "action-bundle-gate",
    through: "validate",
    scope: "all"
  })
  if (applied.outputs.status !== "complete") {
    return yield* Effect.fail(new Error(
      `Action bundle apply reported status ${applied.outputs.status ?? "none"} under node, expected complete.`
    ))
  }
  for (const [label, relative] of [
    ["the run ledger", ".release/run.json"],
    ["the evidence projection", ".release/run.json.evidence.json"],
    ["the zip archive", ".release/artifacts/action-fixture_1.0.0.zip"],
    ["the files-pattern archive", ".release/artifacts/tree_1.0.0.zip"],
    ["the checksum file", ".release/artifacts/action-fixture_1.0.0_checksums.txt"],
    ["the checksum digest", ".release/facts/checksum-sha256"]
  ] as const) {
    yield* expectFile(path.join(realWorkspace, relative), label)
  }
  const archive = yield* expectFile(
    path.join(realWorkspace, ".release/artifacts/action-fixture_1.0.0.tar.gz"),
    "the tar.gz archive"
  )
  const header = [...archive.subarray(0, 10)]
  if (header.join(",") !== [0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0, 2, 0xff].join(",")) {
    return yield* Effect.fail(new Error(
      `Action bundle tar.gz header is ${header.join(",")}, expected the canonical gzip header.`
    ))
  }
  const dumped = yield* readText(path.join(realWorkspace, "env-dump.json"))
  // Darwin system libraries set __CF_USER_TEXT_ENCODING inside every process
  // after the spawn environment is already closed, so the exactness proof
  // exempts that one name on that one platform.
  const hostInjected = process.platform === "darwin" ? ["__CF_USER_TEXT_ENCODING"] : []
  const names = Object.keys(JSON.parse(dumped) as Record<string, string>)
    .filter((name) => !hostInjected.includes(name))
    .sort()
  if (names.join(",") !== "FIXTURE_DECLARED,PATH") {
    return yield* Effect.fail(new Error(
      `Exec ran with environment ${names.join(",")}, expected exactly FIXTURE_DECLARED,PATH.`
    ))
  }
  return version
})

const checkActionBundle = Effect.fn("scripts.checkActionBundle")(function*() {
  const path = yield* Path.Path
  const actionRoot = path.join(root, "apps", "ts-release-action")
  const trackedBundlePath = path.join(actionRoot, "dist", "index.js")
  const tempDirectory = yield* makeTempDirectory()
  const tempBundlePath = path.join(tempDirectory, "index.js")
  const check = Effect.gen(function*() {
    yield* buildTempBundle(actionRoot, tempBundlePath)
    const trackedBundle = yield* readBytes(trackedBundlePath)
    const tempBundle = yield* readBytes(tempBundlePath)
    if (!bundlesEqual(trackedBundle, tempBundle)) {
      return yield* Effect.fail(new Error(staleBundleMessage))
    }
    const violations = bunSurfaceViolations(trackedBundle)
    if (violations.length > 0) {
      return yield* Effect.fail(new Error(
        `Action bundle depends on Bun, but the Action runs node20:\n- ${violations.join("\n- ")}`
      ))
    }
    return yield* executeUnderNode(tempBundlePath, tempDirectory)
  })

  return yield* check.pipe(
    Effect.ensuring(ignoreRemoveTempDirectoryError(tempDirectory))
  )
})

BunRuntime.runMain(
  checkActionBundle().pipe(
    Effect.tap((version) =>
      Effect.sync(() => console.log(`Action bundle is fresh and runs under ${version}.`))
    ),
    Effect.catch((cause: Error) =>
      Effect.sync(() => {
        console.error(cause.message)
        process.exitCode = 1
      })
    ),
    Effect.provide(BunServices.layer)
  )
)
