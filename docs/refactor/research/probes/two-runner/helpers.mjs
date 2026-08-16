import { readFile, rm, mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readJson } from "./core.mjs"

export const here = dirname(fileURLToPath(import.meta.url))
export const runner = join(here, "runner.mjs")
export const stateRoot = join(here, ".probe-state")
export const providerDefinitionFields = ["definitionId", "intentSchema", "intentSchemaVersion", "behaviorId", "operationId"]
export const dispatchStartedFields = ["type", "dispatchId", "attempt", "operationId", "providerDefinitionId", "providerBehaviorId", "providerLockfileIdentity", "transportId", "endpointIdentity", "requestFingerprint", "authorizationIdentity", "replayProtection", "replayBasis", "startedAt"]

export const child = (args) => new Promise((resolvePromise, rejectPromise) => {
  const processChild = spawn(process.execPath, [runner, ...args], { stdio: ["ignore", "pipe", "pipe"] })
  let stdout = "", stderr = ""
  processChild.stdout.on("data", (chunk) => { stdout += chunk })
  processChild.stderr.on("data", (chunk) => { stderr += chunk })
  processChild.on("close", (code) => {
    if (code) return rejectPromise(new Error(`child ${code}\n${stdout}\n${stderr}`))
    const line = stdout.split(/\r?\n/).find((value) => value.startsWith("PROBE_RUNNER_RESULT="))
    if (!line) return rejectPromise(new Error(`missing child result\n${stdout}\n${stderr}`))
    resolvePromise(JSON.parse(line.slice(20)))
  })
})

export async function root(name) {
  const path = resolve(stateRoot, name)
  await rm(path, { recursive: true, force: true })
  await mkdir(path, { recursive: true })
  return path
}

export async function remote(path) {
  try { return await readJson(join(path, "remote.json")) } catch (error) {
    if (error?.code === "ENOENT") return { requests: 0, effects: 0 }
    throw error
  }
}

export async function sendCount(path) {
  try { return (await readFile(join(path, "send-log.ndjson"), "utf8")).trim().split(/\r?\n/).filter(Boolean).length } catch (error) {
    if (error?.code === "ENOENT") return 0
    throw error
  }
}
