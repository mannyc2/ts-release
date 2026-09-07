import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { openGitRuntime, checked } from "../../../packages/ts-release/dist/platform/GitProcess.js"

const root = mkdtempSync(join(tmpdir(), "git-process-consumer-")),
  executable = join(root, "git-process-fixture")
const [nativeGit, node] = process.argv.slice(2)
const marker = join(root, "pids.json")
writeFileSync(
  executable,
  `#!${node}
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'hold') {
  const child = spawn(${JSON.stringify(node)}, ['-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'inherit', 'inherit'] });
  writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ parent: process.pid, child: child.pid }));
  setInterval(() => {}, 1000);
} else if (args[0] === 'inspect-environment') {
  process.stdout.write(JSON.stringify({ home: process.env.HOME, profile: process.env.USERPROFILE, xdg: process.env.XDG_CONFIG_HOME, netrc: process.env.NETRC, ambient: process.env.TS_RELEASE_SYNTHETIC_CREDENTIAL }));
} else {
  const bytes = execFileSync(${JSON.stringify(nativeGit)}, args, { input: readFileSync(0), env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  process.stdout.write(bytes);
}
`,
  { mode: 0o700 },
)
let assertions = 0
const equal = (actual, expected) => {
  assert.deepEqual(actual, expected)
  assertions++
}
const live = (pid) => {
  try {
    process.kill(pid, 0)
    // A reparented zombie has already exited; it cannot perform later effects.
    return !readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].startsWith("Z ")
  } catch (error) {
    if (error.code === "ESRCH" || error.code === "ENOENT") return false
    throw error
  }
}
try {
  for (const mode of ["timeout", "interrupt"]) {
    rmSync(marker, { force: true })
    const controller = new AbortController()
    let directory, pids
    const operation = Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime({
            gitExecutable: executable,
            temporaryRoot: root,
            timeoutMilliseconds: mode === "timeout" ? 500 : 5000,
            maximumOutputBytes: 4096,
          })
          const repository = yield* runtime.repository("sha1")
          directory = repository.directory
          const environment = JSON.parse(
            new TextDecoder().decode(yield* checked(repository.run, ["inspect-environment"])),
          )
          equal(environment.home.startsWith(root + "/ts-release-git-"), true)
          equal(environment.profile, environment.home)
          equal(environment.xdg, environment.home)
          equal(environment.netrc, "/dev/null")
          equal(environment.ambient, undefined)
          yield* repository.run(["hold"])
        }),
      ),
      { signal: controller.signal },
    ).then(
      () => "unexpected-success",
      () => "stopped",
    )
    const deadline = Date.now() + 4000
    while (!existsSync(marker)) {
      if (Date.now() > deadline) throw new Error("Process fixture did not start")
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    pids = JSON.parse(readFileSync(marker, "utf8"))
    if (mode === "interrupt") controller.abort()
    equal(await operation, "stopped")
    equal(existsSync(directory), false)
    equal(live(pids.parent), false)
    equal(live(pids.child), false)
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}
process.stdout.write(JSON.stringify({ assertions, runtime: process.version }) + "\n")
