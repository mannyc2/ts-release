import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const here = dirname(fileURLToPath(import.meta.url))
const worker = join(here, "worker.mjs")
const stateRoot = join(here, ".probe-state")

const check = (condition, message) => {
  if (!condition) throw new Error(message)
}

const runWorker = (args) => new Promise((resolvePromise, rejectPromise) => {
  const child = spawn(process.execPath, [worker, ...args], {
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  })
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (chunk) => { stdout += chunk })
  child.stderr.on("data", (chunk) => { stderr += chunk })
  child.on("close", (code) => {
    if (code !== 0) return rejectPromise(new Error(`worker exited ${code}\n${stdout}\n${stderr}`))
    const line = stdout.split(/\r?\n/).find((value) => value.startsWith("JOURNAL_WORKER_RESULT="))
    if (!line) return rejectPromise(new Error(`missing worker result\n${stdout}\n${stderr}`))
    resolvePromise(JSON.parse(line.slice("JOURNAL_WORKER_RESULT=".length)))
  })
})

const makeRoot = async (name) => {
  const root = join(stateRoot, name)
  await rm(root, { recursive: true, force: true })
  await mkdir(join(root, "barrier"), { recursive: true })
  return root
}

const releaseWhenReady = async (root, names) => {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const ready = await Promise.all(names.map(async (name) => {
      try {
        await stat(join(root, "barrier", `ready-${name}`))
        return true
      } catch (error) {
        if (error?.code === "ENOENT") return false
        throw error
      }
    }))
    if (ready.every(Boolean)) {
      await writeFile(join(root, "barrier", "release"), "release\n")
      return
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1))
  }
  throw new Error("race barrier timeout")
}

const race = async (mode, root, endpoint = "") => {
  const names = ["runner-a", "runner-b"]
  const pending = names.map((name) => runWorker([mode, root, name, endpoint]))
  await releaseWhenReady(root, names)
  const results = await Promise.all(pending)
  check(results.filter((value) => value.winner).length === 1, `${mode}: expected one winner`)
  check(results.filter((value) => !value.winner).length === 1, `${mode}: expected one loser`)
  return results
}

const filesystemProbe = async () => {
  const root = await makeRoot("filesystem")
  await mkdir(join(root, "events"), { recursive: true })
  await writeFile(join(root, "events", "0000000000000001.json"), '{"revision":1}\n')
  const results = await race("filesystem", root)
  const files = (await readdir(join(root, "events"))).sort()
  check(files.join(",") === "0000000000000001.json,0000000000000002.json", "filesystem generation set invalid")
  const event = JSON.parse(await readFile(join(root, "events", "0000000000000002.json"), "utf8"))
  return { winners: 1, losers: 1, finalRevision: event.revision, winner: event.writer, results }
}

const sqliteProbe = async () => {
  const root = await makeRoot("sqlite")
  const path = join(root, "journal.sqlite")
  const db = new DatabaseSync(path)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("CREATE TABLE journal_head(revision INTEGER NOT NULL)")
  db.exec("CREATE TABLE journal_events(revision INTEGER PRIMARY KEY, writer TEXT NOT NULL)")
  db.exec("INSERT INTO journal_head(revision) VALUES (1)")
  db.close()
  const results = await race("sqlite", root)
  const inspect = new DatabaseSync(path, { readOnly: true })
  const head = inspect.prepare("SELECT revision FROM journal_head").get()
  const events = inspect.prepare("SELECT revision, writer FROM journal_events ORDER BY revision").all()
  inspect.close()
  check(Number(head.revision) === 2 && events.length === 1, "sqlite final state invalid")
  return { winners: 1, losers: 1, finalRevision: Number(head.revision), winner: events[0].writer, results }
}

const startConditionalServer = async () => {
  const heads = new Map([
    ["/heads/object", { etag: '"r1"', body: { revision: 1 } }],
    ["/heads/ci", { etag: '"r1"', body: { revision: 1 } }]
  ])
  const segments = new Map()
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const bodyText = Buffer.concat(chunks).toString("utf8")
    if (request.method === "PUT" && request.url.startsWith("/segments/")) {
      segments.set(request.url, JSON.parse(bodyText))
      response.writeHead(200, { etag: `"segment-${segments.size}"` }).end()
      return
    }
    if (request.method === "PUT" && heads.has(request.url)) {
      const current = heads.get(request.url)
      if (request.headers["if-match"] !== current.etag) {
        response.writeHead(412).end()
        return
      }
      const next = { etag: '"r2"', body: JSON.parse(bodyText) }
      heads.set(request.url, next)
      response.writeHead(200, { etag: next.etag }).end()
      return
    }
    response.writeHead(404).end()
  })
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise))
  const address = server.address()
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    heads,
    segments,
    close: () => new Promise((resolvePromise, rejectPromise) => server.close((error) => error ? rejectPromise(error) : resolvePromise()))
  }
}

const objectProbe = async (server) => {
  const root = await makeRoot("object")
  const results = await race("object", root, server.endpoint)
  const head = server.heads.get("/heads/object")
  check(head.body.revision === 2, "object-store head did not advance")
  const objectSegments = [...server.segments.keys()].filter((key) => key.includes("runner-"))
  check(objectSegments.length >= 2, "object-store immutable segments missing")
  return { winners: 1, losers: 1, finalRevision: head.body.revision, reachableSegment: head.body.segment, uploadedSegments: 2, results }
}

const artifactProbe = async (server) => {
  const root = await makeRoot("artifact")
  const results = await race("artifact", root, server.endpoint)
  const artifacts = await readdir(join(root, "artifacts"))
  const head = server.heads.get("/heads/ci")
  check(artifacts.length === 2 && head.body.revision === 2, "artifact-plus-state final state invalid")
  return { artifactUploads: artifacts.length, externalStateWinners: 1, externalStateLosers: 1, finalRevision: head.body.revision, results }
}

await rm(stateRoot, { recursive: true, force: true })
const conditionalServer = await startConditionalServer()
try {
  const output = {
    status: "pass",
    filesystem: await filesystemProbe(),
    sqlite: await sqliteProbe(),
    conditionalObject: await objectProbe(conditionalServer),
    ciArtifactPlusExternalState: await artifactProbe(conditionalServer),
    limitations: [
      "filesystem result applies only where local link and durability primitives behave as documented",
      "SQLite result is a local-file race and does not validate network filesystems",
      "conditional object result is a protocol double, not a live S3 conformance test",
      "CI artifact result demonstrates that immutable artifacts do not themselves provide a mutable-head CAS"
    ]
  }
  console.log(`JOURNAL_BACKEND_RACE_RESULT=${JSON.stringify(output)}`)
} finally {
  await conditionalServer.close()
}
