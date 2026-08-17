import { open, link, rm, mkdir, writeFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const [mode, root, name, endpoint = ""] = process.argv.slice(2)

const result = (value) => {
  console.log(`JOURNAL_WORKER_RESULT=${JSON.stringify(value)}`)
}

const waitForBarrier = async () => {
  const barrier = join(root, "barrier")
  await mkdir(barrier, { recursive: true })
  await writeFile(join(barrier, `ready-${name}`), "ready\n")
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    try {
      await stat(join(barrier, "release"))
      return
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1))
  }
  throw new Error("barrier timeout")
}

const syncDirectory = async (path) => {
  const handle = await open(path, "r")
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

const filesystemRace = async () => {
  const events = join(root, "events")
  const candidates = join(root, "candidates")
  await mkdir(events, { recursive: true })
  await mkdir(candidates, { recursive: true })
  const candidate = join(candidates, `${name}.json`)
  const handle = await open(candidate, "wx", 0o600)
  try {
    await handle.writeFile(`${JSON.stringify({ revision: 2, writer: name })}\n`)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await waitForBarrier()
  const installed = join(events, "0000000000000002.json")
  try {
    await link(candidate, installed)
    await syncDirectory(events)
    result({ backend: "filesystem", winner: true })
  } catch (error) {
    if (error?.code !== "EEXIST") throw error
    result({ backend: "filesystem", winner: false, reason: "generation-exists" })
  } finally {
    await rm(candidate, { force: true })
  }
}

const sqliteRace = async () => {
  await waitForBarrier()
  const db = new DatabaseSync(join(root, "journal.sqlite"))
  try {
    db.exec("PRAGMA busy_timeout = 5000")
    db.exec("BEGIN IMMEDIATE")
    const update = db.prepare("UPDATE journal_head SET revision = 2 WHERE revision = 1").run()
    if (Number(update.changes) === 1) {
      db.prepare("INSERT INTO journal_events(revision, writer) VALUES (2, ?)").run(name)
      db.exec("COMMIT")
      result({ backend: "sqlite", winner: true })
    } else {
      db.exec("ROLLBACK")
      result({ backend: "sqlite", winner: false, reason: "revision-mismatch" })
    }
  } finally {
    db.close()
  }
}

const conditionalWrite = async (headPath, artifact = false) => {
  if (artifact) {
    const artifacts = join(root, "artifacts")
    await mkdir(artifacts, { recursive: true })
    await writeFile(join(artifacts, `${name}.json`), `${JSON.stringify({ writer: name })}\n`, { flag: "wx" })
  }
  const segment = await fetch(`${endpoint}/segments/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify({ revision: 2, writer: name })
  })
  if (!segment.ok) throw new Error(`segment upload failed: ${segment.status}`)
  await waitForBarrier()
  const response = await fetch(`${endpoint}${headPath}`, {
    method: "PUT",
    headers: { "if-match": '"r1"', "content-type": "application/json" },
    body: JSON.stringify({ revision: 2, segment: name })
  })
  if (response.status === 200) {
    result({ backend: artifact ? "ci-artifact-plus-state" : "conditional-object", winner: true })
  } else if (response.status === 412) {
    result({ backend: artifact ? "ci-artifact-plus-state" : "conditional-object", winner: false, reason: "precondition-failed" })
  } else {
    throw new Error(`unexpected conditional status ${response.status}`)
  }
}

if (mode === "filesystem") await filesystemRace()
else if (mode === "sqlite") await sqliteRace()
else if (mode === "object") await conditionalWrite("/heads/object")
else if (mode === "artifact") await conditionalWrite("/heads/ci", true)
else throw new Error(`unknown mode ${mode}`)
