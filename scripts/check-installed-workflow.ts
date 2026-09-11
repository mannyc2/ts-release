import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"
import { createHash } from "node:crypto"
import { Effect, Schema } from "effect"
import { createPlan, Plan, ReleaseError } from "@mannyc1/ts-release"
import { encodeBundle, finalize } from "@mannyc1/ts-release/bundle"
import * as Git from "@mannyc1/ts-release/git"
import { fileContentOwner, makeGitCatalogHost, FinalizedReport } from "@mannyc1/ts-release/node"

// Real packed CLI + Action, native Git provider/transport and shared Git journal.
// Only the acknowledgement boundary is controlled, after native Git has committed.
const root = resolve(import.meta.dir, "..")
const work = await mkdtemp(join(tmpdir(), "ts-release-installed-workflow-"))
const git = Bun.which("git")!
const node = process.env.TS_RELEASE_ACCEPTANCE_NODE ?? Bun.which("node")!
assert.ok(git && node, "Git and supported Node are required")
const run = async (cwd: string, argv: string[], env: Record<string, string> = {}) => {
  const child = Bun.spawn(argv, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert.equal(exit, 0, stdout + stderr)
  return stdout.trim()
}
if (!process.argv.includes("--skip-build"))
  await run(root, [process.execPath, "run", "build:delivery"])
const archive = join(work, "core.tgz")
await run(join(root, "packages/ts-release"), [
  process.execPath,
  "pm",
  "pack",
  "--ignore-scripts",
  "--filename",
  archive,
])
const consumer = join(work, "consumer")
await mkdir(consumer)
await writeFile(
  join(consumer, "package.json"),
  JSON.stringify({
    private: true,
    type: "module",
    dependencies: {
      "@mannyc1/ts-release": `file:${archive}`,
      effect: "4.0.0-rc.108",
    },
  }),
)
await run(consumer, [process.execPath, "install", "--ignore-scripts"])
const cli = join(consumer, "node_modules/.bin/ts-release")
const launcher = join(work, "launcher.cjs")
await cp(join(root, "apps/action/dist/launcher.cjs"), launcher)
await cp(
  join(root, "test/reimplementation/hosts/catalog-application.mjs"),
  join(consumer, "application.mjs"),
)
const identity = new Git.Identity({
  name: "Fixture",
  email: "fixture@example.test",
  timestamp: "1700000000",
  timezone: "+0000",
})
for (const entrypoint of ["cli", "action"] as const)
  for (const scenario of ["ordinary", "interrupted"] as const) {
    const directory = join(work, `${entrypoint}-${scenario}`)
    await mkdir(directory)
    const remote = join(directory, "catalog.git"),
      journal = join(directory, "journal.git")
    await run(work, [git, "init", "--bare", remote])
    await run(work, [git, "init", "--bare", journal])
    const tree = await run(work, [git, "--git-dir", remote, "mktree"])
    const old = await run(work, [git, "--git-dir", remote, "commit-tree", tree, "-m", "Initial"], {
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.test",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.test",
    })
    for (const ref of ["one", "two"])
      await run(work, [git, "--git-dir", remote, "update-ref", `refs/heads/${ref}`, old])
    const owner = fileContentOwner(join(directory, "content"))
    const readContent = (content: Parameters<typeof owner.read>[0]) =>
      owner
        .read(content)
        .pipe(
          Effect.mapError(
            () => new ReleaseError({ code: "fixture-content", message: "Missing content" }),
          ),
        )
    const prepared = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const native = yield* makeGitCatalogHost({
            gitExecutable: git,
            temporaryRoot: directory,
            timeoutMilliseconds: 10000,
            maximumOutputBytes: 4 * 1024 * 1024,
            readContent,
            credentials: () => Effect.succeed({ _tag: "Anonymous" as const }),
          })
          const operations = []
          for (const ref of ["one", "two"]) {
            const coordinate = {
              remote: pathToFileURL(remote).href,
              ref: `refs/heads/${ref}`,
              principal: "publisher",
              scope: "catalog",
            }
            const intent = yield* Git.prepare(
              new Git.CommitInput({
                ...coordinate,
                expectedOld: old,
                baseObjects: yield* owner.putOwned(
                  yield* native.captureBase({ ...coordinate, expectedOld: old }),
                ),
                files: [
                  new Git.FileEdit({
                    path: "release.json",
                    mode: "100644",
                    content: yield* owner.putOwned(
                      new TextEncoder().encode('{"version":"1.0.0"}\n'),
                    ),
                  }),
                ],
                message: "Release 1.0.0\n",
                author: identity,
                committer: identity,
              }),
              {
                objects: native.objects,
                readContent,
                putContent: (bytes) =>
                  owner.putOwned(bytes).pipe(
                    Effect.mapError(
                      () =>
                        new ReleaseError({
                          code: "fixture-put",
                          message: "Content write failed",
                        }),
                    ),
                  ),
              },
            )
            operations.push(yield* Git.update(intent))
          }
          const bundle = yield* finalize([]),
            bytes = encodeBundle(bundle)
          const plan = yield* createPlan(
            createHash("sha256").update(bytes).digest("hex"),
            operations,
          )
          return { bytes, plan }
        }),
      ),
    )
    const bundleFile = join(directory, "bundle.json"),
      planFile = join(directory, "plan.json")
    await writeFile(bundleFile, prepared.bytes)
    await writeFile(planFile, JSON.stringify(Schema.encodeSync(Plan)(prepared.plan)))
    const marker = join(directory, "committed"),
      sends = join(directory, "sends"),
      wrapper = join(directory, "git-wrapper")
    const wrapperSource = (
      pause: boolean,
    ) => `#!${node}\nimport {spawnSync} from "node:child_process";import {appendFileSync,writeFileSync} from "node:fs";
const args=process.argv.slice(2);const result=spawnSync(${JSON.stringify(git)},args,{stdio:["inherit","pipe","pipe"]});
if(args.includes("push")){appendFileSync(${JSON.stringify(sends)},"push\\n");${pause ? `writeFileSync(${JSON.stringify(marker)},"committed");setInterval(()=>{},1000);` : ""}}
${pause ? "else " : ""}{process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exit(result.status??1)}\n`
    await writeFile(wrapper, wrapperSource(scenario === "interrupted"), { mode: 0o755 })
    const input = {
      bundleFile,
      planFile,
      contentDirectory: join(directory, "content"),
      journalRemote: pathToFileURL(journal).href,
      gitExecutable: git,
      publisherGit: wrapper,
      authorize: true,
    }
    const invoke = async (cache: string, observe = false, interrupt = false) => {
      const selected = { ...input, cacheDirectory: join(directory, cache) },
        inputFile = join(directory, "input.json")
      await writeFile(inputFile, JSON.stringify(selected))
      const output = join(directory, "outputs")
      await writeFile(output, "")
      const child = Bun.spawn(
        entrypoint === "cli"
          ? [node, cli, ...(observe ? ["--observe"] : []), "consumer/application.mjs", inputFile]
          : [node, launcher],
        {
          cwd: work,
          env: {
            ...process.env,
            GITHUB_WORKSPACE: work,
            GITHUB_OUTPUT: output,
            INPUT_APPLICATION: "consumer/application.mjs",
            INPUT_INPUT: JSON.stringify(selected),
            INPUT_OBSERVE: String(observe),
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const stdout = new Response(child.stdout).text(),
        stderr = new Response(child.stderr).text()
      if (interrupt) {
        let exited = false
        void child.exited.then(() => {
          exited = true
        })
        const deadline = Date.now() + 20000
        while (!(await Bun.file(marker).exists()) && !exited && Date.now() < deadline)
          await Bun.sleep(20)
        if (!(await Bun.file(marker).exists())) {
          child.kill()
          throw new Error("Publication did not reach commit: " + (await stderr))
        }
        child.kill("SIGINT")
      }
      const result = { exit: await child.exited, stdout: await stdout, stderr: await stderr }
      if (interrupt) {
        assert.equal(result.exit, 130, result.stderr)
        return null
      }
      assert.equal(result.exit, observe ? 2 : 0, result.stderr)
      const report = Schema.decodeUnknownSync(FinalizedReport)(JSON.parse(result.stdout))
      if (entrypoint === "action")
        assert.equal(
          await readFile(output, "utf8"),
          `plan-id=${report.plan.planId}\njournal-revision=${report.journal.revision}\n`,
        )
      return report
    }
    // Observation has no publication, even when the application authorizes it.
    const before = await invoke("before", true)
    assert.ok(before)
    assert.equal(before.operations.filter((op) => op.status === "Satisfied").length, 0)
    assert.equal(await Bun.file(sends).exists(), false)
    if (scenario === "interrupted") {
      await invoke("interrupted", false, true)
      await writeFile(wrapper, wrapperSource(false), { mode: 0o755 })
      const partial = await invoke("inspect-fresh", true)
      assert.ok(partial)
      assert.equal(partial.operations.filter((op) => op.status === "Satisfied").length, 1)
      assert.equal((await readFile(sends, "utf8")).trim().split("\n").length, 1)
    }
    const completed = await invoke("continue-fresh")
    assert.ok(completed)
    assert.ok(completed.operations.every((op) => op.status === "Satisfied"))
    await invoke("already-completed")
    assert.equal((await readFile(sends, "utf8")).trim().split("\n").length, 2)
    assert.equal(
      completed.journal.events.filter((event) => event.body._tag === "DispatchStarted").length,
      2,
    )
    for (const ref of ["one", "two"])
      assert.equal(
        await run(work, [git, "--git-dir", remote, "show", `refs/heads/${ref}:release.json`]),
        '{"version":"1.0.0"}',
      )
    console.log(
      `${entrypoint} ${scenario}: installed observation, publication/continuation and completed recognition passed`,
    )
  }
console.log(`Local workflow fixtures: ${work}`)
