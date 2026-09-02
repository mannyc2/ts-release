import { constants } from "node:fs"
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Result } from "effect"
import { sha256Bytes } from "../src/trial-hash.js"
import { inventoryRuntimeDependencyTree } from "../src/trial-runtime-dependency-tree.js"
import {
  TRIAL_BUBBLEWRAP_EXECUTABLE,
  TRIAL_ISOLATION_FAILURE_EXIT_CODE,
  TRIAL_ISOLATION_FAILURE_PREFIX,
  TRIAL_SANDBOX_CANDIDATE_ROOT,
  TrialIsolationEstablishmentError,
  TrialIsolationInvalidRequestError,
  TrialIsolationPostcheckError,
  TrialIsolationUnavailableError,
  buildTrialIsolationArgv,
  makeTrialIsolatedProcess,
  type TrialIsolationExpectedToolchain,
  type ValidatedTrialIsolationPaths
} from "../src/trial-isolated-process.js"
import {
  TrialProcessTimeoutError,
  makeTrialProcessStreamCapture,
  type TrialProcessRequest,
  type TrialProcessService
} from "../src/trial-process.js"

const encoder = new TextEncoder()
const programRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = resolve(programRoot, "../..")
const withCandidateRoot = async <A>(
  use: (root: string, runnerNodeModules: string) => Promise<A>
): Promise<A> => {
  const outer = await mkdtemp("/tmp/trial-isolation-test-")
  const root = join(outer, "candidate")
  const runnerNodeModules = join(outer, "node_modules")
  await mkdir(root)
  await mkdir(join(runnerNodeModules, ".bin"), { recursive: true })
  await mkdir(join(runnerNodeModules, "pkg"), { recursive: true })
  await writeFile(join(runnerNodeModules, "pkg/index.js"), "export default true\n")
  await symlink("../pkg/index.js", join(runnerNodeModules, ".bin/pkg"))
  try {
    return await use(root, runnerNodeModules)
  } finally {
    await rm(outer, { recursive: true, force: true })
  }
}

const executableDigest = async (path: string) =>
  sha256Bytes(new Uint8Array(await readFile(path)))

const findBunExecutable = async (): Promise<string> => {
  if (basename(process.execPath) === "bun") return realpath(process.execPath)
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (directory.length === 0) continue
    const candidate = join(directory, "bun")
    try {
      await access(candidate, constants.X_OK)
      return await realpath(candidate)
    } catch {
      // Continue through the exact PATH search order.
    }
  }
  throw new Error("Bun executable is unavailable to the test runner")
}

const expectedToolchain = async (
  bunExecutable: string,
  runnerNodeModules: string,
  bubblewrapVersion = "0.9.0"
): Promise<TrialIsolationExpectedToolchain> => {
  const rootPackage = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8")) as {
    readonly packageManager: string
  }
  return {
    bunVersion: rootPackage.packageManager.replace(/^bun@/u, ""),
    bunExecutableSha256: await executableDigest(bunExecutable),
    bubblewrapVersion,
    bubblewrapExecutableSha256: await executableDigest(TRIAL_BUBBLEWRAP_EXECUTABLE),
    runnerNodeModulesSha256: (await Effect.runPromise(
      inventoryRuntimeDependencyTree(runnerNodeModules)
    )).inventory.treeSha256
  }
}

const preparedAuthority = (
  bunExecutable: string,
  runnerNodeModules: string,
  bindings: TrialIsolationExpectedToolchain
) => ({
  bubblewrapExecutable: TRIAL_BUBBLEWRAP_EXECUTABLE,
  bunExecutable,
  runnerNodeModules,
  repositoryRoot,
  expectedToolchain: bindings
})

describe("TrialIsolatedProcess", () => {
  it("builds the exact offline namespace, mount, environment, and execve boundary", async () =>
    withCandidateRoot(async (candidateRoot, runnerNodeModules) => {
      const bunExecutable = await findBunExecutable()
      const bindings = await expectedToolchain(bunExecutable, runnerNodeModules)
      const paths: ValidatedTrialIsolationPaths = {
        bubblewrapExecutable: TRIAL_BUBBLEWRAP_EXECUTABLE,
        bunExecutable,
        runnerNodeModules,
        repositoryRoot,
        candidateRoot
      }
      const argv = buildTrialIsolationArgv(paths, "probe", bindings)
      expect(argv.slice(0, 9)).toEqual([
        TRIAL_BUBBLEWRAP_EXECUTABLE,
        "--unshare-all",
        "--unshare-user",
        "--disable-userns",
        "--assert-userns-disabled",
        "--new-session",
        "--die-with-parent",
        "--cap-drop",
        "ALL"
      ])
      expect(argv).toContain("--clearenv")
      const pwdBinding = argv.indexOf("PWD")
      expect(argv.slice(pwdBinding - 1, pwdBinding + 2)).toEqual([
        "--setenv",
        "PWD",
        TRIAL_SANDBOX_CANDIDATE_ROOT
      ])
      expect(argv).not.toContain("--share-net")
      expect(argv).toContain("--proc")
      expect(argv).toContain("--dev")
      expect(argv).toContain("--tmpfs")
      expect(argv).not.toContain(repositoryRoot)
      expect(argv.filter((value) => value === candidateRoot)).toHaveLength(1)
      expect(argv.filter((value) => value === runnerNodeModules)).toHaveLength(1)
      expect(argv.filter((value) => value === bunExecutable)).toHaveLength(1)
      const remountRoot = argv.indexOf("--remount-ro")
      expect(argv.filter((value) => value === "--remount-ro")).toHaveLength(1)
      expect(argv.slice(remountRoot, remountRoot + 2)).toEqual(["--remount-ro", "/"])
      expect(remountRoot).toBeGreaterThan(argv.lastIndexOf("--bind"))
      expect(remountRoot).toBeGreaterThan(argv.lastIndexOf("--ro-bind"))
      expect(remountRoot).toBeGreaterThan(argv.lastIndexOf("--tmpfs"))
      expect(remountRoot).toBeLessThan(argv.indexOf("--chdir"))
      const verifier = argv.at(-1)!
      expect(verifier).toContain(`Bun.version !== ${JSON.stringify(bindings.bunVersion)}`)
      expect(verifier).toContain("process.execve")
      expect(verifier).toContain("/proc/net/route")
      expect(verifier).toContain("/candidate/node_modules/.trial-isolation-write-probe")
    }))

  it("verifies both executable digests and bubblewrap version before candidate execution", async () =>
    withCandidateRoot(async (candidateRoot, runnerNodeModules) => {
      const bunExecutable = await findBunExecutable()
      const bindings = await expectedToolchain(bunExecutable, runnerNodeModules, "test-version")
      const requests: Array<TrialProcessRequest> = []
      const processService: TrialProcessService = {
        run: (request) => {
          requests.push(request)
          return Effect.succeed(request.argv[1] === "--version"
            ? {
              exitCode: 0,
              stdout: encoder.encode("bubblewrap test-version\n"),
              stderr: new Uint8Array()
            }
            : { exitCode: 0, stdout: encoder.encode("{}\n"), stderr: new Uint8Array() })
        }
      }
      const service = makeTrialIsolatedProcess({
        trialProcess: processService,
        preparedAuthority: preparedAuthority(bunExecutable, runnerNodeModules, bindings)
      })
      const result = await Effect.runPromise(service.run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: bindings
      }))
      expect(result.exitCode).toBe(0)
      expect(requests).toHaveLength(2)
      expect(requests[0]!.argv).toEqual([TRIAL_BUBBLEWRAP_EXECUTABLE, "--version"])
      expect(requests[1]!.argv[0]).toBe(TRIAL_BUBBLEWRAP_EXECUTABLE)
      expect(requests[1]!.closedEnvironment).toEqual({
        PATH: "/usr/bin:/bin",
        LC_ALL: "C",
        LANG: "C",
        TZ: "UTC",
        NO_COLOR: "1"
      })

      requests.length = 0
      const wrongDigest = { ...bindings, bunExecutableSha256: "0".repeat(64) as typeof bindings.bunExecutableSha256 }
      const rejected = await Effect.runPromise(service.run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: wrongDigest
      }).pipe(Effect.result))
      expect(Result.isFailure(rejected)).toBe(true)
      if (Result.isFailure(rejected)) expect(rejected.failure).toBeInstanceOf(TrialIsolationInvalidRequestError)
      expect(requests).toHaveLength(0)

      const wrongDependencyDigest = {
        ...bindings,
        runnerNodeModulesSha256: "0".repeat(64) as typeof bindings.runnerNodeModulesSha256
      }
      const mismatchedAuthority = makeTrialIsolatedProcess({
        trialProcess: processService,
        preparedAuthority: preparedAuthority(
          bunExecutable,
          runnerNodeModules,
          wrongDependencyDigest
        )
      })
      const dependencyRejected = await Effect.runPromise(mismatchedAuthority.run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: wrongDependencyDigest
      }).pipe(Effect.result))
      expect(Result.isFailure(dependencyRejected)).toBe(true)
      if (Result.isFailure(dependencyRejected)) {
        expect(dependencyRejected.failure).toBeInstanceOf(TrialIsolationUnavailableError)
      }
      expect(requests).toHaveLength(1)
      expect(requests[0]!.argv).toEqual([TRIAL_BUBBLEWRAP_EXECUTABLE, "--version"])
    }))

  it("fails closed for missing Bun provenance, version drift, setup failure, and timeout", async () =>
    withCandidateRoot(async (candidateRoot, runnerNodeModules) => {
      const bunExecutable = await findBunExecutable()
      const bindings = await expectedToolchain(bunExecutable, runnerNodeModules, "expected")
      let candidateCalls = 0
      const versionDrift: TrialProcessService = {
        run: () => Effect.succeed({
          exitCode: 0,
          stdout: encoder.encode("bubblewrap different\n"),
          stderr: new Uint8Array()
        })
      }
      const drift = await Effect.runPromise(makeTrialIsolatedProcess({
        trialProcess: versionDrift,
        preparedAuthority: preparedAuthority(bunExecutable, runnerNodeModules, bindings)
      }).run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: bindings
      }).pipe(Effect.result))
      expect(Result.isFailure(drift)).toBe(true)
      if (Result.isFailure(drift)) expect(drift.failure).toBeInstanceOf(TrialIsolationUnavailableError)

      const missingBun = await Effect.runPromise(makeTrialIsolatedProcess({
        trialProcess: versionDrift
      }).run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: bindings
      }).pipe(Effect.result))
      expect(Result.isFailure(missingBun)).toBe(true)
      if (Result.isFailure(missingBun)) expect(missingBun.failure).toBeInstanceOf(TrialIsolationUnavailableError)

      let calls = 0
      const setupFailure: TrialProcessService = {
        run: () => {
          calls += 1
          if (calls === 1) {
            return Effect.succeed({
              exitCode: 0,
              stdout: encoder.encode("bubblewrap expected\n"),
              stderr: new Uint8Array()
            })
          }
          candidateCalls += 1
          return Effect.succeed({
            exitCode: TRIAL_ISOLATION_FAILURE_EXIT_CODE,
            stdout: new Uint8Array(),
            stderr: encoder.encode(`${TRIAL_ISOLATION_FAILURE_PREFIX}environment\n`)
          })
        }
      }
      const setup = await Effect.runPromise(makeTrialIsolatedProcess({
        trialProcess: setupFailure,
        preparedAuthority: preparedAuthority(bunExecutable, runnerNodeModules, bindings)
      }).run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: bindings
      }).pipe(Effect.result))
      expect(Result.isFailure(setup)).toBe(true)
      if (Result.isFailure(setup)) {
        expect(setup.failure).toBeInstanceOf(TrialIsolationEstablishmentError)
        if (setup.failure instanceof TrialIsolationEstablishmentError) {
          expect(setup.failure.processAttempt).toEqual({
            _tag: "Exited",
            exitCode: TRIAL_ISOLATION_FAILURE_EXIT_CODE,
            stdout: {
              _tag: "Complete",
              byteLength: 0,
              sha256: sha256Bytes(new Uint8Array())
            },
            stderr: {
              _tag: "Complete",
              byteLength: encoder.encode(`${TRIAL_ISOLATION_FAILURE_PREFIX}environment\n`).byteLength,
              sha256: sha256Bytes(
                encoder.encode(`${TRIAL_ISOLATION_FAILURE_PREFIX}environment\n`)
              )
            }
          })
        }
      }
      expect(candidateCalls).toBe(1)

      calls = 0
      const timeout: TrialProcessService = {
        run: () => {
          calls += 1
          return calls === 1
            ? Effect.succeed({
              exitCode: 0,
              stdout: encoder.encode("bubblewrap expected\n"),
              stderr: new Uint8Array()
            })
            : Effect.fail(new TrialProcessTimeoutError(30_000))
        }
      }
      const timedOut = await Effect.runPromise(makeTrialIsolatedProcess({
        trialProcess: timeout,
        preparedAuthority: preparedAuthority(bunExecutable, runnerNodeModules, bindings)
      }).run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: bindings
      }).pipe(Effect.result))
      expect(Result.isFailure(timedOut)).toBe(true)
      if (Result.isFailure(timedOut)) expect(timedOut.failure).toBeInstanceOf(TrialProcessTimeoutError)
    }))

  it("retains an interrupted child transcript when a post-execution isolation check also fails", async () =>
    withCandidateRoot(async (candidateRoot, runnerNodeModules) => {
      const bunExecutable = await findBunExecutable()
      const bindings = await expectedToolchain(bunExecutable, runnerNodeModules, "postcheck")
      const stdout = encoder.encode("partial adapter stdout\n")
      const stderr = encoder.encode("complete adapter stderr\n")
      let calls = 0
      const processService: TrialProcessService = {
        run: (request) => {
          calls += 1
          if (calls === 1) {
            return Effect.succeed({
              exitCode: 0,
              stdout: encoder.encode("bubblewrap postcheck\n"),
              stderr: new Uint8Array()
            })
          }
          return Effect.promise(async () => {
            const targetIndex = request.argv.indexOf("/candidate/node_modules")
            const snapshotNodeModules = request.argv[targetIndex - 1]!
            await writeFile(join(snapshotNodeModules, "pkg/index.js"), "tampered after start\n")
          }).pipe(Effect.flatMap(() => Effect.fail(new TrialProcessTimeoutError(
            30_000,
            makeTrialProcessStreamCapture("Prefix", stdout),
            makeTrialProcessStreamCapture("Complete", stderr)
          ))))
        }
      }
      const result = await Effect.runPromise(makeTrialIsolatedProcess({
        trialProcess: processService,
        preparedAuthority: preparedAuthority(bunExecutable, runnerNodeModules, bindings)
      }).run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: bindings
      }).pipe(Effect.result))

      expect(Result.isFailure(result)).toBe(true)
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(TrialIsolationPostcheckError)
        if (result.failure instanceof TrialIsolationPostcheckError) {
          expect(result.failure.processAttempt).toEqual({
            _tag: "TimedOut",
            timeoutMilliseconds: 30_000,
            stdout: {
              _tag: "Prefix",
              byteLength: stdout.byteLength,
              sha256: sha256Bytes(stdout)
            },
            stderr: {
              _tag: "Complete",
              byteLength: stderr.byteLength,
              sha256: sha256Bytes(stderr)
            }
          })
        }
      }
    }))

  it("binds only invocation-private verified copies and removes them after execution", async () =>
    withCandidateRoot(async (candidateRoot, runnerNodeModules) => {
      const sourceBun = join(dirname(candidateRoot), "preflight-bun")
      await writeFile(sourceBun, "trusted bun bytes\n")
      await chmod(sourceBun, 0o755)
      const bindings = await expectedToolchain(sourceBun, runnerNodeModules, "copy-version")
      let calls = 0
      let snapshotRoot = ""
      const processService: TrialProcessService = {
        run: (request) => Effect.promise(async () => {
          calls += 1
          if (calls === 1) {
            return {
              exitCode: 0,
              stdout: encoder.encode("bubblewrap copy-version\n"),
              stderr: new Uint8Array()
            }
          }
          const bunDestination = request.argv.indexOf("/runtime/bun")
          const dependenciesDestination = request.argv.indexOf("/candidate/node_modules")
          const copiedBun = request.argv[bunDestination - 1]!
          const copiedDependencies = request.argv[dependenciesDestination - 1]!
          snapshotRoot = dirname(copiedBun)
          expect(copiedBun).not.toBe(sourceBun)
          expect(copiedDependencies).not.toBe(runnerNodeModules)
          expect(dirname(copiedDependencies)).toBe(snapshotRoot)
          expect((await lstat(copiedBun)).mode & 0o7777).toBe(0o555)
          expect((await lstat(copiedDependencies)).mode & 0o7777).toBe(0o755)
          expect((await lstat(join(copiedDependencies, "pkg"))).mode & 0o7777).toBe(0o755)
          expect(await readFile(copiedBun, "utf8")).toBe("trusted bun bytes\n")

          await writeFile(sourceBun, "hostile replacement\n")
          await writeFile(join(runnerNodeModules, "pkg/index.js"), "hostile replacement\n")
          expect(await readFile(copiedBun, "utf8")).toBe("trusted bun bytes\n")
          expect(await readFile(join(copiedDependencies, "pkg/index.js"), "utf8")).toBe(
            "export default true\n"
          )
          return { exitCode: 0, stdout: encoder.encode("{}\n"), stderr: new Uint8Array() }
        })
      }
      const service = makeTrialIsolatedProcess({
        trialProcess: processService,
        preparedAuthority: preparedAuthority(sourceBun, runnerNodeModules, bindings)
      })
      const result = await Effect.runPromise(service.run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: bindings
      }))
      expect(result.exitCode).toBe(0)
      expect(snapshotRoot).not.toBe("")
      await expect(access(snapshotRoot)).rejects.toThrow()
      expect(await readFile(sourceBun, "utf8")).toBe("hostile replacement\n")
    }))

  it.live("keeps host paths, credentials, routes, nested user namespaces, and external writes unavailable", () =>
    Effect.tryPromise(async () => withCandidateRoot(async (candidateRoot, runnerNodeModules) => {
      const bunExecutable = await findBunExecutable()
      const bindings = await expectedToolchain(bunExecutable, runnerNodeModules)
      const adapter = [
        'const fs = require("node:fs");',
        'const write = (path) => { try { fs.writeFileSync(path, "x", { flag: "wx" }); return true } catch { return false } };',
        'write("adapter-started");',
        'const candidateWrite = write("inside.txt");',
        'const externalWrite = write("/outside-trial.txt");',
        'const nested = Bun.spawnSync(["/usr/bin/unshare", "-Ur", "true"], { stdout: "pipe", stderr: "pipe" });',
        'const routeCount = fs.readFileSync("/proc/net/route", "utf8").trim().split(/\\n/u).slice(1).filter(Boolean).length;',
        'const credentialEnv = Object.keys(process.env).some((name) => /TOKEN|SECRET|PASS|KEY|PROXY/u.test(name));',
        'process.stdout.write(JSON.stringify({ candidateWrite, credentialEnv, externalWrite, homeVisible: fs.existsSync("/home"), networkRouteCount: routeCount, nestedUserns: nested.exitCode === 0, rootVisible: fs.existsSync("/root") }) + "\\n");'
      ].join("\n")
      await writeFile(join(candidateRoot, "trial-adapter.ts"), adapter)
      await chmod(join(candidateRoot, "trial-adapter.ts"), 0o644)
      const marker = join(candidateRoot, "adapter-started")
      const service = makeTrialIsolatedProcess({
        preparedAuthority: preparedAuthority(bunExecutable, runnerNodeModules, bindings)
      })
      const result = await Effect.runPromise(service.run({
        candidateRoot,
        adapterArgv: ["bun", "run", "trial-adapter.ts", "case"],
        stdin: encoder.encode("{}\n"),
        timeoutMilliseconds: 30_000,
        expectedToolchain: bindings
      }).pipe(Effect.result))

      if (Result.isFailure(result)) {
        if (process.env.TRIAL_REQUIRE_LIVE_ISOLATION === "1") throw result.failure
        expect(
          result.failure instanceof TrialIsolationUnavailableError ||
          result.failure instanceof TrialIsolationEstablishmentError
        ).toBe(true)
        await expect(readFile(marker)).rejects.toThrow()
        return
      }
      expect(new TextDecoder().decode(result.success.stdout)).toBe(
        '{"candidateWrite":true,"credentialEnv":false,"externalWrite":false,"homeVisible":false,"networkRouteCount":0,"nestedUserns":false,"rootVisible":false}\n'
      )
      expect(result.success.stderr.byteLength).toBe(0)
      expect(await readFile(join(candidateRoot, "inside.txt"), "utf8")).toBe("x")
      await expect(readFile("/outside-trial.txt")).rejects.toThrow()
    })))
})
