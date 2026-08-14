import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join } from "node:path"
import type {
  ActionArtifactFindBy,
  ActionArtifactTransport
} from "./artifact-client.js"

type BridgeFindBy = Omit<ActionArtifactFindBy, "token">

export type ArtifactBridgeRequest = {
  readonly operation: "upload"
  readonly name: string
  readonly files: ReadonlyArray<string>
  readonly rootDirectory: string
} | {
  readonly operation: "download"
  readonly name: string
  readonly destination: string
  readonly findBy?: BridgeFindBy
}

export interface ArtifactBridgeOutput {
  readonly id?: number
  readonly digest?: string
  readonly path?: string
  readonly digestMismatch?: boolean
}

export type ArtifactBridgeResponse = {
  readonly ok: true
  readonly output: ArtifactBridgeOutput
} | {
  readonly ok: false
  readonly error: string
}

export type ArtifactBridgeEnvironment = Readonly<Record<string, string | undefined>>

export interface ArtifactBridgeSpawnInput {
  readonly executable: string
  readonly argv: ReadonlyArray<string>
  readonly environment: ArtifactBridgeEnvironment
}

export type ArtifactBridgeSpawn = (input: ArtifactBridgeSpawnInput) => number

const defaultSpawn: ArtifactBridgeSpawn = ({ executable, argv, environment }) => {
  const result = spawnSync(executable, [...argv], {
    env: { ...environment },
    stdio: "inherit"
  })
  if (result.error !== undefined) throw result.error
  return result.status ?? 1
}

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string.`)
  return value
}

const exactKeys = (value: Record<string, unknown>, expected: ReadonlyArray<string>, label: string): void => {
  if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) {
    throw new Error(`${label} has an unexpected shape.`)
  }
}

export const decodeArtifactBridgeRequest = (value: unknown): ArtifactBridgeRequest => {
  const input = object(value, "Artifact bridge request")
  if (input.operation === "upload") {
    exactKeys(input, ["operation", "name", "files", "rootDirectory"], "Artifact upload request")
    if (!Array.isArray(input.files) || input.files.length === 0 || input.files.some((path) => typeof path !== "string" || path.length === 0)) {
      throw new Error("Artifact upload files must be a non-empty string array.")
    }
    return {
      operation: "upload",
      name: text(input.name, "Artifact upload name"),
      files: input.files as ReadonlyArray<string>,
      rootDirectory: text(input.rootDirectory, "Artifact upload root")
    }
  }
  if (input.operation === "download") {
    const allowed = input.findBy === undefined
      ? ["operation", "name", "destination"]
      : ["operation", "name", "destination", "findBy"]
    exactKeys(input, allowed, "Artifact download request")
    const findBy = input.findBy === undefined ? undefined : object(input.findBy, "Artifact download findBy")
    if (findBy !== undefined) {
      exactKeys(findBy, ["workflowRunId", "repositoryOwner", "repositoryName"], "Artifact download findBy")
    }
    return {
      operation: "download",
      name: text(input.name, "Artifact download name"),
      destination: text(input.destination, "Artifact download destination"),
      ...(findBy === undefined ? {} : {
        findBy: {
          workflowRunId: text(findBy.workflowRunId, "Artifact workflow run id"),
          repositoryOwner: text(findBy.repositoryOwner, "Artifact repository owner"),
          repositoryName: text(findBy.repositoryName, "Artifact repository name")
        }
      })
    }
  }
  throw new Error("Artifact bridge request has an unknown operation.")
}

export const executeArtifactBridgeRequest = async (
  request: ArtifactBridgeRequest,
  artifacts: ActionArtifactTransport,
  environment: ArtifactBridgeEnvironment
): Promise<ArtifactBridgeOutput> => {
  if (request.operation === "upload") {
    return artifacts.upload(request)
  }
  const token = request.findBy === undefined ? undefined : environment.GITHUB_TOKEN?.trim()
  if (request.findBy !== undefined && (token === undefined || token.length === 0)) {
    throw new Error("Artifact bridge requires GITHUB_TOKEN for authenticated cross-run download.")
  }
  return artifacts.download({
    name: request.name,
    destination: request.destination,
    ...(request.findBy === undefined ? {} : { findBy: { ...request.findBy, token: token! } })
  })
}

const decodeResponse = (value: unknown): ArtifactBridgeResponse => {
  const response = object(value, "Artifact bridge response")
  if (response.ok === false) {
    exactKeys(response, ["ok", "error"], "Artifact bridge failure")
    return { ok: false, error: text(response.error, "Artifact bridge error") }
  }
  if (response.ok !== true) throw new Error("Artifact bridge response has no canonical status.")
  exactKeys(response, ["ok", "output"], "Artifact bridge success")
  const output = object(response.output, "Artifact bridge output")
  const allowed = new Set(["id", "digest", "path", "digestMismatch"])
  if (Object.keys(output).some((key) => !allowed.has(key)) ||
      (output.id !== undefined && !Number.isSafeInteger(output.id)) ||
      (output.digest !== undefined && typeof output.digest !== "string") ||
      (output.path !== undefined && typeof output.path !== "string") ||
      (output.digestMismatch !== undefined && typeof output.digestMismatch !== "boolean")) {
    throw new Error("Artifact bridge output has an unexpected shape.")
  }
  return { ok: true, output: output as ArtifactBridgeOutput }
}

export const makeNodeArtifactBridgeTransport = (input: {
  readonly nodeExecutable: string
  readonly bridgePath: string
  readonly environment: ArtifactBridgeEnvironment
  readonly spawn?: ArtifactBridgeSpawn
}): ActionArtifactTransport => {
  if (!isAbsolute(input.nodeExecutable) || !isAbsolute(input.bridgePath)) {
    throw new Error("Artifact bridge Node executable and bundle path must be absolute.")
  }
  const spawn = input.spawn ?? defaultSpawn
  const call = async (request: ArtifactBridgeRequest): Promise<ArtifactBridgeOutput> => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-artifact-bridge-"))
    const requestPath = join(directory, "request.json")
    const responsePath = join(directory, "response.json")
    try {
      writeFileSync(requestPath, `${JSON.stringify(request)}\n`, { mode: 0o400 })
      const status = spawn({
        executable: input.nodeExecutable,
        argv: [input.bridgePath, requestPath, responsePath],
        environment: input.environment
      })
      let response: ArtifactBridgeResponse | undefined
      try { response = decodeResponse(JSON.parse(readFileSync(responsePath, "utf8"))) } catch (cause) {
        if (status === 0) throw cause
      }
      if (response?.ok === false) throw new Error(response.error)
      if (status !== 0 || response === undefined) throw new Error(`Native artifact bridge exited ${status} without a canonical response.`)
      return response.output
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
  return {
    upload: async ({ name, files, rootDirectory }) => call({ operation: "upload", name, files, rootDirectory }),
    download: async ({ name, destination, findBy }) => {
      if (findBy !== undefined && input.environment.GITHUB_TOKEN?.trim() !== findBy.token) {
        throw new Error("Artifact bridge download token disagrees with the Action credential boundary.")
      }
      return call({
        operation: "download", name, destination,
        ...(findBy === undefined ? {} : {
          findBy: {
            workflowRunId: findBy.workflowRunId,
            repositoryOwner: findBy.repositoryOwner,
            repositoryName: findBy.repositoryName
          }
        })
      })
    }
  }
}
