import { stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { check, readJson, writeJson } from "./core.mjs"
import { child, remote, root, sendCount } from "./helpers.mjs"

export async function mutatedStop(name, mutate, expectedCode) {
  const path = await root(name)
  await child(["a", path, "before-send"])
  const journalPath = join(path, "journal.json")
  const journal = await readJson(journalPath)
  mutate(journal.events[0])
  await writeJson(journalPath, journal)
  const b = await child(["b", path, "v1", `dispatch-${name}`])
  check(!b.sent && b.result.code === expectedCode, `${name} did not stop precisely`)
  return { code: b.result.code }
}

export async function casRace() {
  const path = await root("cas-race")
  await child(["a", path, "before-send"])
  const first = child(["b", path, "v1", "dispatch-race-a", "a"])
  const second = child(["b", path, "v1", "dispatch-race-b", "b"])
  for (let i = 0; i < 1000; i += 1) {
    const ready = await Promise.all(["a", "b"].map(async (name) => {
      try { await stat(join(path, "barrier", `ready-${name}`)); return true } catch (error) {
        if (error?.code === "ENOENT") return false
        throw error
      }
    }))
    if (ready.every(Boolean)) break
    if (i === 999) throw new Error("race barrier timeout")
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2))
  }
  await writeFile(join(path, "barrier", "release"), "release\n")
  const results = await Promise.all([first, second])
  const winners = results.filter((value) => value.sent)
  const losers = results.filter((value) => !value.sent)
  const journal = await readJson(join(path, "journal.json"))
  const r = await remote(path)
  const sends = await sendCount(path)
  check(winners.length === 1 && losers.length === 1, "race did not select one winner")
  check(losers[0].result.code === "journal-cas-lost", "race loser not structured")
  check(journal.revision === 2 && r.effects === 1 && sends === 1, "send occurred without CAS")
  return { winners: 1, losers: 1, loserCode: losers[0].result.code, journalRevision: 2, remoteEffects: 1, sends: 1 }
}
