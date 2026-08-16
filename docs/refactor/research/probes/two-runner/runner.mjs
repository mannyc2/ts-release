import { mkdir, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import {
  INITIAL_DISPATCH_ID,
  appendCas,
  check,
  dispatchStarted,
  initJournal,
  loadPrepared,
  makeProvider,
  readJson,
  replayDecision,
  sendPrepared,
  writePlan
} from "./core.mjs"

async function runnerA(root, scenario) {
  const provider = makeProvider("v1")
  const intent = { coordinate: "@probe/package@1.0.0", payload: { integrity: "sha512-probe", artifact: "bundle:probe.tgz" } }
  await mkdir(root, { recursive: true })
  await initJournal(root)
  await writePlan(root, provider, intent)
  const prepared = provider.prepare(intent, { originDispatchId: INITIAL_DISPATCH_ID })
  const event = dispatchStarted(prepared, INITIAL_DISPATCH_ID, 1, { kind: "initial" })
  check((await appendCas(root, 0, event)).appended, "initial CAS failed")
  if (scenario === "before-send") return { stoppedAfter: "DispatchStarted-before-send" }
  try { await sendPrepared(root, prepared, INITIAL_DISPATCH_ID, true) } catch (error) {
    check(error?.code === "RESPONSE_LOST", "unexpected send failure")
    return { stoppedAfter: "remote-commit-response-lost" }
  }
  throw new Error("response was not lost")
}

async function barrier(root, name) {
  const directory = join(root, "barrier")
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, `ready-${name}`), "ready\n")
  for (let i = 0; i < 1000; i += 1) {
    try { await stat(join(directory, "release")); return } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2))
  }
  throw new Error("barrier timeout")
}

async function runnerB(root, version, dispatchId, raceName) {
  const provider = makeProvider(version)
  const { plan, prepared } = await loadPrepared(root, provider)
  const journal = await readJson(join(root, "journal.json"))
  const prior = journal.events.at(-1)
  const decision = replayDecision(prior, prepared, plan.probeNow)
  if (decision.decision === "stop") return { result: decision, sent: false }
  if (raceName) await barrier(root, raceName)
  const next = dispatchStarted(prepared, dispatchId, prior.attempt + 1, decision.basis)
  const append = await appendCas(root, journal.revision, next)
  if (!append.appended) {
    return {
      sent: false,
      result: {
        decision: "stop",
        code: "journal-cas-lost",
        comparisons: [{ fact: "journalRevision", recorded: String(journal.revision), candidate: String(append.actualRevision ?? "contended"), result: "mismatch", consequence: "block" }],
        riskAcceptance: {
          assertion: `I authorize another dispatch after losing journal CAS for ${prior.operationId}`,
          priorDispatchId: prior.dispatchId,
          operationId: prior.operationId,
          candidateRequestFingerprint: prepared.requestFingerprint,
          acceptedRisks: ["duplicate continuation"]
        }
      }
    }
  }
  return { result: decision, sent: true, remoteResult: await sendPrepared(root, prepared, dispatchId) }
}

const [mode, rootArg, ...args] = process.argv.slice(2)
const root = resolve(rootArg)
let result
if (mode === "a") result = await runnerA(root, args[0])
else if (mode === "b") result = await runnerB(root, args[0], args[1], args[2])
else throw new Error(`unknown runner mode ${mode}`)
console.log(`PROBE_RUNNER_RESULT=${JSON.stringify(result)}`)
