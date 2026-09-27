import { Schema } from "effect"
import { JournalEvent } from "@mannyc1/ts-release"
import { FinalizedReport } from "@mannyc1/ts-release/node"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { dirname, delimiter, join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const packed = process.env.TS_RELEASE_PACKED_ARTIFACT_WORK
const node = process.env.TS_RELEASE_ACCEPTANCE_NODE ?? process.env.TS_RELEASE_HTTP_PEER_NODE
assert(
  packed && packed.startsWith("/") && node && node.startsWith("/"),
  "Choose completed packed artifact evidence and native Node",
)
const packedRoot = packed
const nodeExecutable = node
const baseline = Schema.decodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      archive: Schema.String,
      kernelSha256: Schema.String,
      outcomes: Schema.Array(
        Schema.Struct({
          manager: Schema.String,
          runtime: Schema.String,
          evidence: Schema.Struct({ executables: Schema.Struct({ work: Schema.String }) }),
        }),
      ),
    }),
  ),
)(await readFile(join(packedRoot, "evidence.json"), "utf8"))
const ProcessReport = Schema.Struct({
  calls: Schema.Struct({
    submit: Schema.Int,
    info: Schema.Int,
    staple: Schema.Int,
    assess: Schema.Int,
  }),
  report: Schema.Struct({
    revision: Schema.Int,
    preparations: Schema.Array(
      Schema.Struct({ revision: Schema.Int, operations: FinalizedReport.fields.operations }),
    ),
    nativeFacts: Schema.Array(JournalEvent),
  }),
  workspaces: Schema.Array(Schema.String),
})
const decodeReport = Schema.decodeSync(Schema.fromJsonString(ProcessReport))
const firstStatus = (preparation: (typeof ProcessReport.Type.report.preparations)[number]) => {
  const operation = preparation.operations[0]
  assert.ok(operation, "Preparation report must contain its operation")
  return operation.status
}
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
assert.equal(hash(await readFile(baseline.archive)), baseline.kernelSha256)
const work = await mkdtemp("/tmp/ts-release-packed-apple-")
const commands: unknown[] = [],
  outcomes: unknown[] = [],
  checks: string[] = []
const check = (name: string, actual: unknown, expected: unknown) => {
  assert.deepEqual(actual, expected, name)
  checks.push(name)
}
const run = async (
  cwd: string,
  argv: string[],
  env: Record<string, string> = {},
  killed = false,
) => {
  const child = Bun.spawn(argv, {
    cwd,
    env: {
      ...process.env,
      PATH: `${dirname(nodeExecutable)}${delimiter}${process.env.PATH}`,
      TS_RELEASE_HTTP_PEER_NODE: nodeExecutable,
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  commands.push({ cwd, argv, exitCode, output: (stdout + stderr).slice(-16_000) })
  await writeFile(join(work, "commands.json"), JSON.stringify(commands, null, 2) + "\n")
  check(killed ? "actual SIGKILL process exit" : "native process exit", exitCode, killed ? 137 : 0)
  return stdout
}
let fixture = await readFile(
  join(root, "test/reimplementation/artifacts/apple-fixtures.ts"),
  "utf8",
)
for (const [source, publicEntry] of Object.entries({
  EffectBuild: "effect-build",
  Node: "node",
  Bundle: "bundle",
  Apple: "apple",
}))
  fixture = fixture.replaceAll(
    `../../../packages/ts-release/src/${source}.js`,
    `@mannyc1/ts-release/${publicEntry}`,
  )
fixture = fixture
  .replaceAll("@effect/platform-bun/BunServices", "@effect/platform-node/NodeServices")
  .replaceAll("BunServices", "NodeServices")
assert(!fixture.includes("packages/ts-release/src"))
const fixtureJavascript = new Bun.Transpiler({ loader: "ts", target: "node" }).transformSync(
  fixture,
)
for (const manager of ["bun", "npm"]) {
  const cwd = join(packedRoot, manager)
  await writeFile(join(cwd, "apple-fixtures.js"), fixtureJavascript)
  await cp(
    join(root, "test/reimplementation/artifacts/apple-process.mjs"),
    join(cwd, "apple-process.mjs"),
  )
  await cp(
    join(root, "test/reimplementation/artifacts/apple-installed.mjs"),
    join(cwd, "apple-installed.mjs"),
  )
  for (const [index, runtime] of [nodeExecutable, process.execPath].entries()) {
    const next = runtime === nodeExecutable ? process.execPath : nodeExecutable
    const prior = baseline.outcomes.find(
      (cell: { manager: string; runtime: string }) =>
        cell.manager === manager && cell.runtime === runtime,
    )
    assert.ok(prior, "Missing packed executable evidence for consumer/runtime")
    const executable = prior.evidence.executables.work
    const env = { TS_RELEASE_EXECUTABLE_WITNESS: executable }
    const cell = join(work, `${manager}-${index}`)
    await mkdir(cell)
    const invoke = (runtime: string, root: string, mode: string, killed = false) =>
      run(cwd, [runtime, "apple-process.mjs", root, mode], env, killed)
    const success = join(cell, "retained-receipt")
    await invoke(runtime, success, "init")
    await run(cwd, ["git", "init", "--bare", "--initial-branch=main", join(success, "journal.git")])
    await invoke(runtime, success, "kill-after-receipt", true)
    const pending = decodeReport(await invoke(next, success, "pending"))
    check(
      "fresh runner polls recorded ID and submits only the independent second scope",
      pending.calls,
      { submit: 1, info: 2, staple: 0, assess: 0 },
    )
    check("both preparations remain Pending", pending.report.preparations.map(firstStatus), [
      "Pending",
      "Pending",
    ])
    const ready = decodeReport(await invoke(runtime, success, "ready"))
    check("fresh completion polls and adopts without another submit", ready.calls, {
      submit: 0,
      info: 2,
      staple: 2,
      assess: 2,
    })
    const report = decodeReport(await invoke(next, success, "report"))
    check("finished restart performs no native submit/poll/staple/assessment", report.calls, {
      submit: 0,
      info: 0,
      staple: 0,
      assess: 0,
    })
    check("all preparations selected", report.report.preparations.map(firstStatus), [
      "Satisfied",
      "Satisfied",
    ])
    check(
      "one shared report revision",
      report.report.preparations.every((row) => row.revision === report.report.revision),
      true,
    )
    check(
      "one start per preparation",
      report.report.nativeFacts.filter((row) => row.body._tag === "DispatchStarted").length,
      2,
    )
    check(
      "two persisted exact native receipts",
      report.report.nativeFacts.filter((row) => row.body._tag === "ReceiptAccepted").length,
      2,
    )
    check("all native workspaces closed", report.workspaces, [])
    const installed = Schema.decodeSync(
      Schema.fromJsonString(Schema.Struct({ checks: Schema.Int })),
    )(await run(cwd, [next, "apple-installed.mjs", success]))
    check("selected tar members, native Linux executable and checksums", installed.checks, 8)
    const submitted = (await readFile(join(success, "native-submits.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((row) =>
        Schema.decodeSync(Schema.fromJsonString(Schema.Struct({ submissionId: Schema.String })))(
          row,
        ),
      )
    check(
      "exact native submission identities retained",
      report.report.nativeFacts
        .filter((row) => row.body._tag === "ReceiptAccepted")
        .map((row) => {
          assert.equal(row.body._tag, "ReceiptAccepted")
          return Schema.decodeUnknownSync(Schema.Struct({ submissionId: Schema.String }))(
            row.body.receipt,
          ).submissionId
        })
        .sort(),
      submitted.map((row) => row.submissionId).sort(),
    )
    const lost = join(cell, "lost-receipt")
    await invoke(runtime, lost, "init-lost")
    await run(cwd, ["git", "init", "--bare", "--initial-branch=main", join(lost, "journal.git")])
    await invoke(runtime, lost, "kill-before-receipt", true)
    for (const resume of [next, runtime]) {
      const unknown = decodeReport(await invoke(resume, lost, "restart-lost"))
      check(
        "lost native ID remains Inconclusive on fresh runner",
        unknown.report.preparations.map(firstStatus),
        ["Inconclusive"],
      )
      check("missing ID never causes submit or guessed polling", unknown.calls, {
        submit: 0,
        info: 0,
        staple: 0,
        assess: 0,
      })
      check(
        "lost receipt history retains one start and no receipt",
        [
          unknown.report.nativeFacts.filter((row) => row.body._tag === "DispatchStarted").length,
          unknown.report.nativeFacts.filter((row) => row.body._tag === "ReceiptAccepted").length,
        ],
        [1, 0],
      )
    }
    check(
      "only one native mutation in lost-response history",
      (await readFile(join(lost, "native-submits.jsonl"), "utf8")).trim().split("\n").length,
      1,
    )
    outcomes.push({ manager, runtime, next, success, lost, executable })
    await writeFile(join(work, "outcomes.json"), JSON.stringify(outcomes, null, 2) + "\n")
  }
}
await writeFile(
  join(work, "evidence.json"),
  JSON.stringify(
    {
      format: "ts-release/packed-apple-process/1",
      work,
      packed: packedRoot,
      kernelSha256: baseline.kernelSha256,
      fixtureAdaptation:
        "Exact local protocol fixture transpiled with Bun.Transpiler for Node; source imports replaced by public exports and NodeServices boundary for both supported runtimes.",
      fixtureJavascriptSha256: hash(new TextEncoder().encode(fixtureJavascript)),
      outcomes,
      commands,
      checks,
      limits: [
        "Real Git histories and OS process loss; Apple native services are protocol doubles, not macOS signing/notary acceptance.",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify({
    work,
    cells: outcomes.length,
    checks: checks.length,
    processes: commands.length,
  }),
)
