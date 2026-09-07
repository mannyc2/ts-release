import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createServer } from "node:https"
import { once } from "node:events"
import { spawn, execFileSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, writeFile, appendFile, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Schema } from "effect"
import { createOperation, createPlan } from "@mannyc1/ts-release"
import { File, Content, finalize, encodeBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner, makeGitCatalogHost } from "@mannyc1/ts-release/node"
import * as Git from "@mannyc1/ts-release/git"
import {
  Upload,
  Opaque,
  Intent,
  intentCodec,
  encodeIntent,
  intentCanonicalVersion,
  Receipt,
  Observation,
  NativeError,
  definition,
  gitDefinition,
} from "@fixture/external-provider"

const work = await mkdtemp(join(process.cwd(), "native-"))
const cli = resolve("node_modules/.bin/ts-release")
const application = resolve("application.mjs")
const git = execFileSync("which", ["git"], { encoding: "utf8" }).trim()
const journal = join(work, "journal.git")
execFileSync(git, ["init", "--bare", "--quiet", journal])
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
const body = Buffer.from("external owned artifact\n")
const artifact = Schema.decodeUnknownSync(File)({
  _tag: "OwnedFile",
  logicalName: "external.bin",
  content: { bytes: String(body.length), sha256: digest(body) },
  deliveryMode: 420,
  executable: null,
  provenance: { _tag: "IntrinsicProvenance", producer: "external-fixture" },
})
const bundle = await Effect.runPromise(finalize([artifact]))
const bundleId = digest(encodeBundle(bundle))
const acquisitions = join(work, "acquisitions.jsonl"),
  opaqueLog = join(work, "opaque.jsonl"),
  cacheLog = join(work, "cache.jsonl"),
  accounts = join(work, "accounts.json")
await Promise.all([acquisitions, opaqueLog, cacheLog].map((path) => writeFile(path, "")))
const accountRows = []
const rows = new Map()
const captures = []
const children = new Set()
const checks = []
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name)
  checks.push(name)
}
const readLines = async (path) =>
  (await readFile(path, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse)
const server = createServer(
  { cert: await readFile(process.argv[2]), key: await readFile(process.argv[3]) },
  async (request, response) => {
    const row = rows.get(request.url)
    if (!row) return response.writeHead(404).end()
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const bytes = Buffer.concat(chunks)
    captures.push({
      method: request.method,
      endpoint: row.endpoint,
      account: row.account,
      authorization: request.headers.authorization,
      key: request.headers["x-external-key"],
      body: bytes.toString("base64"),
      digest: digest(bytes),
    })
    if (request.headers.authorization !== `Bearer ${row.token}`)
      return response.writeHead(401).end()
    const binding = { endpoint: row.endpoint, account: row.account, key: row.key }
    if (request.method === "GET")
      return response
        .writeHead(row.readStatus ?? 200)
        .end(JSON.stringify({ ...binding, state: row.state, digest: row.storedDigest ?? null }))
    if (row.deny)
      return response.writeHead(403).end(
        JSON.stringify({
          _tag: "NativeError",
          ...binding,
          digest: digest(bytes),
          code: "Denied",
        }),
      )
    row.writes++
    row.storedDigest = digest(bytes)
    row.state = row.pending ? "Pending" : "Satisfied"
    row.committed?.()
    if (row.hold) return
    response.writeHead(row.ackStatus ?? (row.pending ? 202 : 201)).end(
      JSON.stringify({
        _tag: "PutReceipt",
        ...binding,
        digest: digest(bytes),
        id: `native:${row.key}`,
        state: row.ackState ?? (row.pending ? "pending" : "created"),
      }),
    )
  },
)
server.listen(0, "127.0.0.1")
await once(server, "listening")
const origin = `https://127.0.0.1:${server.address().port}`
const provider = definition({
  readContent: () => Effect.succeed(body),
  read: () => Effect.die("Construction cannot read destination"),
}).provider
const externalGit = gitDefinition({
  readContent: () => Effect.die("Construction cannot read content"),
  observeRef: () => Effect.die("Construction cannot read refs"),
})
const add = async (key, kind = "Upload", account = "staging") => {
  const endpoint = kind === "Upload" ? `${origin}/${key}` : `urn:external:${key}`
  const value = { endpoint, account, key, token: `fixture-${key}-credential-1`, generation: 1 }
  accountRows.push(value)
  await writeFile(accounts, JSON.stringify(accountRows))
  if (kind === "Upload") rows.set(`/${key}`, { ...value, state: "Absent", writes: 0 })
  const input = { endpoint, account, key, payload: { artifact, labels: ["nested", "artifact"] } }
  return kind === "Upload" ? new Upload(input) : new Opaque({ ...input, sequence: 7 })
}
const save = async (name, intents) => {
  const directory = join(work, name)
  await mkdir(join(directory, "content"), { recursive: true })
  await writeFile(join(directory, "content", artifact.content.sha256), body)
  await writeFile(join(directory, "bundle.json"), encodeBundle(bundle))
  const operations = await Effect.runPromise(
    Effect.forEach(intents, (intent) =>
      createOperation(intent.remote ? externalGit : provider, intent),
    ),
  )
  const plan = await Effect.runPromise(createPlan(bundleId, operations))
  await writeFile(join(directory, "plan.json"), JSON.stringify(plan))
  return {
    directory,
    plan,
    accounts,
    acquisitions,
    opaqueLog,
    cacheLog,
    git,
    journalRemote: pathToFileURL(journal).href,
    authorize: true,
    cache: true,
  }
}
let invocation = 0
const launch = async (input) => {
  const path = join(input.directory, `input-${++invocation}.json`)
  await writeFile(path, JSON.stringify(input))
  const child = spawn(process.execPath, [cli, application, path], {
    stdio: ["ignore", "pipe", "pipe"],
  })
  children.add(child)
  let stdout = "",
    stderr = ""
  child.stdout.on("data", (chunk) => {
    stdout += chunk
  })
  child.stderr.on("data", (chunk) => {
    stderr += chunk
  })
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error("External CLI exceeded30seconds"))
    }, 30000)
    child.once("error", reject)
    child.once("close", (code, signal) => {
      clearTimeout(timer)
      children.delete(child)
      try {
        resolve({ code, signal, stdout, stderr, report: stdout ? JSON.parse(stdout) : null })
      } catch (error) {
        reject(error)
      }
    })
  })
  return { child, result }
}
const run = async (input, expected) => {
  const result = await (await launch(input)).result
  check(`CLI ${expected}`, result.code, expected === "Satisfied" ? 0 : 2)
  check("credential-free CLI diagnostics", result.stderr, "")
  check(
    "derived operation statuses",
    result.report.operations.map((operation) => operation.status),
    result.report.operations.map(() => expected),
  )
  check("no durable credential bytes", JSON.stringify(result.report).includes("credential-"), false)
  return result.report
}
const events = (report, tag) => report.journal.events.filter((event) => event.body._tag === tag)
try {
  const upload = await add("golden")
  const opaque = await add("golden-opaque", "Opaque")
  for (const value of [upload, opaque]) {
    const encoded = Schema.encodeSync(intentCodec)(value)
    check(
      "heterogeneous nested intent codec round-trip",
      Schema.decodeUnknownSync(intentCodec)(JSON.parse(JSON.stringify(encoded))),
      value,
    )
    const bytes = Buffer.from(encodeIntent(value)).toString()
    check(
      "independently versioned canonical bytes",
      bytes.startsWith(intentCanonicalVersion + "\0"),
      true,
    )
    const expected =
      `${intentCanonicalVersion}\0` +
      JSON.stringify({
        _tag: value._tag,
        account: value.account,
        endpoint: value.endpoint,
        key: value.key,
        payload: {
          artifact: {
            _tag: "OwnedFile",
            content: { bytes: artifact.content.bytes, sha256: artifact.content.sha256 },
            deliveryMode: 420,
            executable: null,
            logicalName: "external.bin",
            provenance: { _tag: "IntrinsicProvenance", producer: "external-fixture" },
          },
          labels: ["nested", "artifact"],
        },
        ...(value._tag === "Opaque" ? { sequence: 7 } : {}),
      }) +
      "\n"
    check("exact canonical golden vector", bytes, expected)
  }
  const staging = await add("dual-staging"),
    production = await add("dual-production", "Upload", "production")
  const dual = await save("dual", [staging, production])
  const before = await run({ ...dual, authorize: false, observe: false }, "Unattempted")
  check("preparation has no history", before.journal.revision, 0)
  check("preparation has no destination I/O", captures.length, 0)
  check("preparation has no credentials", (await readLines(acquisitions)).length, 0)
  const prepared = await Effect.runPromise(
    provider.prepare(dual.plan.operations[0], {
      own: { operation: dual.plan.operations[0], receipts: [], observations: [] },
      dependencies: [],
    }),
  )
  check("prepare returns exact owned bytes", Buffer.from(prepared.body), body)
  check("prepare is still service-free destination I/O", captures.length, 0)
  const sent = await run(dual, "Satisfied")
  check(
    "two independent operation IDs",
    new Set(dual.plan.operations.map((op) => op.operationId)).size,
    2,
  )
  check("two native sends", captures.filter((row) => row.method === "POST").length, 2)
  for (const event of events(sent, "DispatchStarted")) {
    const request = event.body.request
    const capture = captures.find(
      (row) => row.method === "POST" && row.endpoint === request.endpoint,
    )
    check("recorded and native request digest", capture.digest, request.bodyDigest)
    check("recorded and native method", capture.method, request.method)
    check("recorded and native request key", capture.key, request.scope)
    check("native request body golden", capture.body, body.toString("base64"))
    check("endpoint account binding", capture.account, request.principal)
  }
  for (const row of accountRows.filter((row) => row.key.startsWith("dual-"))) {
    row.token = `fixture-${row.key}-credential-2`
    row.generation = 2
    rows.get(`/${row.key}`).token = row.token
  }
  await writeFile(accounts, JSON.stringify(accountRows))
  await run({ ...dual, machine: "M2" }, "Satisfied")
  check(
    "restart never resends acknowledged uploads",
    captures.filter((row) => row.method === "POST").length,
    2,
  )
  check(
    "fresh operation-local credentials for both instances",
    (await readLines(acquisitions))
      .filter((row) => row.generation === 2)
      .map((row) => row.principal)
      .sort(),
    ["production", "staging"],
  )

  const pending = await save("pending", [await add("pending")])
  rows.get("/pending").pending = true
  const pendingReport = await run(pending, "Pending")
  check(
    "native pending receipt version",
    events(pendingReport, "ReceiptAccepted")[0].body.receiptVersion,
    "fixture.put-receipt/1",
  )
  await run({ ...pending, machine: "M2" }, "Pending")
  rows.get("/pending").state = "Satisfied"
  await run(pending, "Satisfied")
  check("pending converges without resend", rows.get("/pending").writes, 1)

  const denied = await save("denied", [await add("denied")])
  rows.get("/denied").deny = true
  const rejected = await run(denied, "Rejected")
  check("native denied non-commit", rows.get("/denied").writes, 0)
  const proof = events(rejected, "DispatchRejectedBeforeCommit")[0].body
  check("native error exact codec version", proof.proofVersion, "fixture.native-error/1")
  check(
    "native error round-trip",
    Schema.encodeSync(NativeError)(Schema.decodeUnknownSync(NativeError)(proof.proof)),
    proof.proof,
  )

  const badRead = await save("bad-read", [await add("bad-read")])
  Object.assign(rows.get("/bad-read"), {
    readStatus: 500,
    state: "Satisfied",
    storedDigest: artifact.content.sha256,
  })
  const invalidRead = await (await launch(badRead)).result
  check("native500 cannot establish satisfaction", invalidRead.code, 1)
  check("native500 cannot emit an accepted report", invalidRead.report, null)
  check("native500 cannot dispatch", rows.get("/bad-read").writes, 0)
  for (const [status, state] of [
    [202, "created"],
    [201, "pending"],
  ]) {
    const key = `bad-ack-${status}`
    const input = await save(key, [await add(key)])
    Object.assign(rows.get(`/${key}`), { ackStatus: status, ackState: state })
    const report = await run(input, "Inconclusive")
    check(
      "inconsistent native status/body cannot create a receipt",
      events(report, "ReceiptAccepted").length,
      0,
    )
    await run({ ...input, machine: "M2" }, "Satisfied")
    check("bad acknowledgement still cannot justify retry", rows.get(`/${key}`).writes, 1)
  }

  for (const state of ["Satisfied", "Conflict", "Pending", "Inconclusive", "Absent"]) {
    const key = `lost-${state.toLowerCase()}`
    const input = await save(key, [await add(key)])
    const row = rows.get(`/${key}`)
    row.hold = true
    let commit
    const committed = new Promise((resolve) => {
      commit = resolve
    })
    row.committed = commit
    const started = await launch(input)
    await Promise.race([
      committed,
      started.result.then(() => {
        throw new Error("CLI exited before native commit")
      }),
    ])
    started.child.kill("SIGKILL")
    check("real process killed after native commit", (await started.result).signal, "SIGKILL")
    row.state = state
    const resumed = await run(
      { ...input, machine: "M2" },
      state === "Absent" ? "Inconclusive" : state,
    )
    check(
      "lost response has exactly one durable start",
      events(resumed, "DispatchStarted").length,
      1,
    )
    check("lost response has no receipt", events(resumed, "ReceiptAccepted").length, 0)
    check("fresh process never blindly resends", row.writes, 1)
    for (const event of events(resumed, "ObservationRecorded")) {
      check("native observation exact codec", event.body.evidenceVersion, "fixture.observation/1")
      check(
        "native observation round-trip",
        Schema.encodeSync(Observation)(Schema.decodeUnknownSync(Observation)(event.body.evidence)),
        event.body.evidence,
      )
    }
  }
  const concurrent = await save("concurrent", [await add("concurrent")])
  const barrier = join(concurrent.directory, "barrier"),
    appendLog = join(concurrent.directory, "appends.jsonl")
  await mkdir(barrier)
  await writeFile(appendLog, "")
  const competitors = await Promise.all([
    launch({ ...concurrent, observe: false, barrier, appendLog }),
    launch({ ...concurrent, machine: "M2", observe: false, barrier, appendLog }),
  ])
  const results = await Promise.all(competitors.map((row) => row.result))
  check(
    "concurrent runners remain bounded",
    results.every((result) => result.code === 0 || result.code === 2),
    true,
  )
  const converged = await run(concurrent, "Satisfied")
  check("real journal CAS grants exactly one send", rows.get("/concurrent").writes, 1)
  check("one journal dispatch authority", events(converged, "DispatchStarted").length, 1)
  const appends = await readLines(appendLog)
  check("two distinct native CAS contenders", new Set(appends.map((row) => row.process)).size, 2)
  check(
    "both contend for initial revision",
    appends.map((row) => row.revision),
    [0, 0],
  )
  check(
    "one fresh native append wins",
    appends.filter((row) => row.result === "Appended").length,
    1,
  )
  check(
    "loser has no append authority",
    appends.some((row) => ["RevisionMismatch", "AmbiguousStorageOutcome"].includes(row.result)),
    true,
  )

  const missingOpaque = await save("opaque-missing", [await add("opaque-missing", "Opaque")])
  await writeFile(
    accounts,
    JSON.stringify(accountRows.filter((row) => row.key !== "opaque-missing")),
  )
  const noAccount = await (await launch(missingOpaque)).result
  check("opaque missing credentials reject", noAccount.code, 1)
  const noStart = await run({ ...missingOpaque, authorize: false, observe: false }, "Unattempted")
  check(
    "opaque missing credentials create no dispatch authority",
    events(noStart, "DispatchStarted").length,
    0,
  )
  check("opaque missing credentials create no native write", (await readLines(opaqueLog)).length, 0)
  await writeFile(accounts, JSON.stringify(accountRows))
  const writeOnly = await save("opaque-loss", [await add("opaque-loss", "Opaque")])
  const started = await launch({ ...writeOnly, opaqueWait: true })
  const deadline = Date.now() + 10000
  while (
    !(await readLines(opaqueLog)).some((row) => row.key === "opaque-loss") &&
    Date.now() < deadline
  )
    await new Promise((resolve) => setTimeout(resolve, 10))
  check(
    "write-only native effect committed",
    (await readLines(opaqueLog)).filter((row) => row.key === "opaque-loss").length,
    1,
  )
  started.child.kill("SIGKILL")
  check("write-only producer really killed", (await started.result).signal, "SIGKILL")
  const stopped = await run({ ...writeOnly, machine: "M2" }, "Inconclusive")
  check(
    "opaque uses NoReplay",
    events(stopped, "DispatchStarted")[0].body.request.replay._tag,
    "None",
  )
  check(
    "write-only cannot blindly resend",
    (await readLines(opaqueLog)).filter((row) => row.key === "opaque-loss").length,
    1,
  )
  const opaqueError = await save("opaque-error", [await add("opaque-error", "Opaque")])
  const errorReport = await run({ ...opaqueError, opaqueUnknown: true }, "Inconclusive")
  const nativeError = events(errorReport, "ObservationRecorded").find(
    (event) => event.body.evidenceKind === "DispatchError",
  ).body
  check(
    "opaque native durable error version",
    nativeError.evidenceVersion,
    "fixture.native-error/1",
  )
  check(
    "opaque native error codec round-trip",
    Schema.encodeSync(NativeError)(Schema.decodeUnknownSync(NativeError)(nativeError.evidence)),
    nativeError.evidence,
  )
  const opaqueAccepted = await save("opaque-accepted", [await add("opaque-accepted", "Opaque")])
  const accepted = await run(opaqueAccepted, "Satisfied")
  check(
    "opaque native receipt codec round-trip",
    Schema.encodeSync(Receipt)(
      Schema.decodeUnknownSync(Receipt)(events(accepted, "ReceiptAccepted")[0].body.receipt),
    ),
    events(accepted, "ReceiptAccepted")[0].body.receipt,
  )

  // Actual expected-old/desired-new Git race, through this external definition.
  const remote = join(work, "catalog.git")
  execFileSync(git, ["init", "--bare", "--quiet", remote])
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "External fixture",
    GIT_AUTHOR_EMAIL: "external@example.test",
    GIT_COMMITTER_NAME: "External fixture",
    GIT_COMMITTER_EMAIL: "external@example.test",
    GIT_AUTHOR_DATE: "@1700000000 +0000",
    GIT_COMMITTER_DATE: "@1700000000 +0000",
  }
  const native = (args, input = "") =>
    execFileSync(git, ["--git-dir", remote, ...args], {
      env: gitEnv,
      input,
      encoding: "utf8",
    }).trim()
  const tree = native(["mktree"]),
    old = native(["commit-tree", tree], "Initial\n")
  native(["update-ref", "refs/heads/catalog", old])
  const captureLog = join(work, "git-pushes.jsonl"),
    captureGit = join(work, "git-capture.mjs")
  await writeFile(captureLog, "")
  await writeFile(
    captureGit,
    `#!${process.execPath}\nimport {spawnSync} from "node:child_process";import {appendFileSync} from "node:fs";const args=process.argv.slice(2);const r=spawnSync(${JSON.stringify(git)},args,{stdio:["inherit","pipe","pipe"]});if(args.includes("push"))appendFileSync(${JSON.stringify(captureLog)},JSON.stringify({args,status:r.status})+"\\n");process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exit(r.status??1);\n`,
    { mode: 0o755 },
  )
  const plans = []
  for (const name of ["a", "b"]) {
    const directory = join(work, `git-${name}`)
    await mkdir(join(directory, "content"), { recursive: true })
    const owner = fileContentOwner(join(directory, "content"))
    const put = (bytes) =>
      Effect.tryPromise({
        try: async () => {
          const content = new Content({ bytes: String(bytes.length), sha256: digest(bytes) })
          await writeFile(join(directory, "content", content.sha256), bytes)
          return content
        },
        catch: () => new Error("Owned fixture content failed"),
      })
    const coordinate = {
      remote: pathToFileURL(remote).href,
      ref: "refs/heads/catalog",
      principal: "external-catalog",
      scope: "one-managed-path",
    }
    const builderRoot = join(directory, "builder")
    await mkdir(builderRoot)
    const intent = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const host = yield* makeGitCatalogHost({
            gitExecutable: git,
            temporaryRoot: builderRoot,
            timeoutMilliseconds: 5000,
            maximumOutputBytes: 4 * 1024 * 1024,
            readContent: owner.read,
            credentials: () => Effect.succeed({ _tag: "Anonymous" }),
          })
          return yield* Git.prepare(
            new Git.CommitInput({
              ...coordinate,
              expectedOld: old,
              baseObjects: yield* put(yield* host.captureBase({ ...coordinate, expectedOld: old })),
              files: [
                new Git.FileEdit({
                  path: "external.txt",
                  mode: "100644",
                  content: yield* put(Buffer.from(name + "\n")),
                }),
              ],
              message: `External ${name}\n`,
              author: {
                name: "External fixture",
                email: "external@example.test",
                timestamp: "1700000001",
                timezone: "+0000",
              },
              committer: {
                name: "External fixture",
                email: "external@example.test",
                timestamp: "1700000001",
                timezone: "+0000",
              },
            }),
            { objects: host.objects, readContent: owner.read, putContent: put },
          )
        }),
      ),
    )
    await rm(builderRoot, { recursive: true, force: true })
    plans.push({
      ...(await save(`git-${name}`, [intent])),
      captureGit,
      observe: false,
      desired: intent.desiredNew,
    })
  }
  const racers = await Promise.all(plans.map(launch))
  const raced = await Promise.all(racers.map(({ result }) => result))
  check("two actual conditional Git attempts", (await readLines(captureLog)).length, 2)
  const actual = native(["rev-parse", "refs/heads/catalog"])
  check(
    "Git winner is exactly one prepared commit",
    plans.filter((plan) => plan.desired === actual).length,
    1,
  )
  for (let i = 0; i < plans.length; i++) {
    check("Git race CLI result", [0, 2].includes(raced[i].code), true)
    const report = await run(
      { ...plans[i], observe: true, machine: "M2" },
      plans[i].desired === actual ? "Satisfied" : "Conflict",
    )
    check(
      "external Git identity persists",
      report.plan.operations[0].definitionId,
      "fixture.external.git",
    )
    check(
      "Git request preserves exact expected-old",
      events(report, "DispatchStarted")[0].body.request.replay.expectedOld,
      old,
    )
  }
  check("Git restart never repeats mutation", (await readLines(captureLog)).length, 2)
  check("native commit exact parent", native(["rev-parse", `${actual}^`]), old)
  check(
    "native managed path bytes",
    native(["show", `${actual}:external.txt`]),
    plans[0].desired === actual ? "a" : "b",
  )
  check(
    "external cache reduces underlying reads",
    (await readLines(cacheLog)).some((row) => row.reads > row.underlyingReads),
    true,
  )
  check(
    "external cache still forwards appends",
    (await readLines(cacheLog)).some((row) => row.appends > 0),
    true,
  )
  await writeFile(
    join(work, "evidence.json"),
    JSON.stringify(
      {
        checks,
        captures: captures.map(({ authorization, ...row }) => row),
        acquisitions: await readLines(acquisitions),
        gitPushes: await readLines(captureLog),
      },
      null,
      2,
    ) + "\n",
  )
  console.log(
    JSON.stringify({
      runtime: process.version,
      bun: process.versions.bun ?? null,
      work,
      checks: checks.length,
      processes: invocation,
      nativeHttpRequests: captures.filter((row) => row.method === "POST").length,
      nativeHttpCommits: [...rows.values()].reduce((sum, row) => sum + row.writes, 0),
      gitPushes: (await readLines(captureLog)).length,
    }),
  )
} finally {
  for (const child of children) child.kill("SIGKILL")
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
