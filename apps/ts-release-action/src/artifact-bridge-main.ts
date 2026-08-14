import { readFileSync, writeFileSync } from "node:fs"
import {
  decodeArtifactBridgeRequest,
  executeArtifactBridgeRequest,
  type ArtifactBridgeResponse
} from "./artifact-bridge.js"
import { makeActionsArtifactTransport } from "./artifact-client.js"

const requestPath = process.argv[2]
const responsePath = process.argv[3]

const write = (response: ArtifactBridgeResponse): void => {
  if (responsePath === undefined) throw new Error("Native artifact bridge requires a response path.")
  writeFileSync(responsePath, `${JSON.stringify(response)}\n`, { mode: 0o600 })
}

const main = async (): Promise<void> => {
  try {
    if (requestPath === undefined || responsePath === undefined) {
      throw new Error("Native artifact bridge requires request and response paths.")
    }
    const request = decodeArtifactBridgeRequest(JSON.parse(readFileSync(requestPath, "utf8")))
    const output = await executeArtifactBridgeRequest(request, makeActionsArtifactTransport(), process.env)
    write({ ok: true, output })
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause)
    try { write({ ok: false, error }) } catch {
      console.error(error)
    }
    process.exitCode = 1
  }
}

void main()
