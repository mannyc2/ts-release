import * as Effect from "effect/Effect"
import {
  formatNpmSha1Shasum,
  formatNpmSha512Sri,
  sha1Digest,
  sha512Digest
} from "../../../src/model/digest.js"
import type {
  CertifiedPublisherSpawnShape,
  NpmUserConfig,
  NpmUserConfigResourceShape
} from "../../../src/platform/credentials.js"
import { npmPublishArgv } from "../../../src/publication/publisher.js"
import {
  PublisherExited,
  PublisherOutcomeUnknown,
  RejectedBeforeStart
} from "../../../src/platform/credentials.js"
import type { HttpAuthorizerShape } from "../../../src/publication/http.js"
import {
  faultInjected,
  httpExchange,
  processExit,
  processSignal,
  processSpawn,
  protocolBodyFingerprint,
  streamFailure,
  type ProtocolEvent
} from "../events.js"

export const NpmProviderScenarioSchemaVersion = "npm-provider-scenario/v1" as const

export interface NpmProviderScenarioState {
  readonly schemaVersion: typeof NpmProviderScenarioSchemaVersion
  packageVisibility: "missing" | "visible"
  versionState: "absent" | "equivalent" | "different"
  distTagState: "missing" | "equivalent" | "different"
  readonly publishResult:
    | "exit-0"
    | "exit-nonzero"
    | "response-loss"
    | "before-start"
    | "stdout-failure"
    | "stderr-failure"
    | "signal"
    | "coordinate-consumed"
  observationCount: number
  publishCount: number
}

export interface NpmProviderScenarioInput {
  readonly packageName: string
  readonly version: string
  readonly distTag: string
  readonly bytes: Uint8Array
  readonly initial: Pick<NpmProviderScenarioState, "packageVisibility" | "versionState" | "distTagState">
  readonly publishResult: NpmProviderScenarioState["publishResult"]
}

const fakeUserConfig = { _tag: "NpmUserConfig" } as unknown as NpmUserConfig

const packument = (input: NpmProviderScenarioInput, state: NpmProviderScenarioState): string => {
  const versionBytes = state.versionState === "different"
    ? new TextEncoder().encode("provider carries different tarball bytes")
    : input.bytes
  const version = state.versionState === "absent"
    ? {}
    : {
      [input.version]: {
        name: input.packageName,
        version: input.version,
        dist: {
          integrity: formatNpmSha512Sri(sha512Digest(versionBytes)),
          shasum: formatNpmSha1Shasum(sha1Digest(versionBytes))
        }
      }
    }
  const tags = state.distTagState === "missing"
    ? {}
    : { [input.distTag]: state.distTagState === "equivalent" ? input.version : "9.9.9" }
  return JSON.stringify({ name: input.packageName, versions: version, "dist-tags": tags })
}

/** Stateful provider double only; it performs no network, filesystem, or process mutation. */
export const makeNpmProviderScenario = (input: NpmProviderScenarioInput): {
  readonly state: NpmProviderScenarioState
  readonly events: Array<ProtocolEvent>
  readonly http: HttpAuthorizerShape
  readonly userConfigs: NpmUserConfigResourceShape
  readonly publisher: CertifiedPublisherSpawnShape
} => {
  const state: NpmProviderScenarioState = {
    schemaVersion: NpmProviderScenarioSchemaVersion,
    ...input.initial,
    publishResult: input.publishResult,
    observationCount: 0,
    publishCount: 0
  }
  const events: Array<ProtocolEvent> = []

  const http: HttpAuthorizerShape = {
    execute: (request, grant) => Effect.sync(() => {
      state.observationCount += 1
      const status = state.packageVisibility === "missing" ? 404 : 200
      const body = status === 404 ? JSON.stringify({ error: "not_found" }) : packument(input, state)
      const responseFingerprint = protocolBodyFingerprint(body)
      events.push(httpExchange({
        provider: "npm",
        phase: "observe",
        attempt: state.observationCount,
        method: "GET",
        url: request.url,
        status,
        grantKind: grant._tag,
        ...(request.headers === undefined ? {} : { requestHeaders: request.headers }),
        responseBodySha256: responseFingerprint.sha256,
        responseBodyLength: responseFingerprint.length
      }))
      return { status, headers: {}, body }
    })
  }

  const userConfigs: NpmUserConfigResourceShape = {
    acquire: () => Effect.acquireRelease(Effect.succeed(fakeUserConfig), () => Effect.void)
  }

  const publisher: CertifiedPublisherSpawnShape = {
    preflightTrustedNpm: (_operation, grant) => Effect.sync(() => {
      for (const argv of [["node", "--version"], ["npm", "--version"]] as const) {
        events.push(processSpawn({
          provider: "npm",
          phase: "mutate",
          argv,
          cwd: "/protocol/preflight",
          environmentNames: [],
          grantKind: grant._tag
        }))
        events.push(processExit({ provider: "npm", phase: "mutate", exitCode: 0 }))
      }
    }),
    spawn: (spec, grant) => Effect.sync(() => {
      state.publishCount += 1
      events.push(processSpawn({
        provider: "npm",
        phase: "mutate",
        attempt: state.publishCount,
        argv: npmPublishArgv(spec),
        cwd: spec.cwd,
        environmentNames: grant._tag === "WorkloadIdentity"
          ? [...grant.names].map(String).sort()
          : ["NPM_CONFIG_USERCONFIG"],
        grantKind: grant._tag
      }))
      if (state.publishResult === "before-start") {
        events.push(faultInjected({
          provider: "npm",
          phase: "mutate",
          attempt: state.publishCount,
          point: "before-process-start",
          commitment: "before-dispatch"
        }))
        return RejectedBeforeStart.make({
          commitment: "before-dispatch",
          reason: "protocol process did not start"
        })
      }
      if (state.publishResult === "coordinate-consumed") {
        events.push(processExit({
          provider: "npm",
          phase: "mutate",
          attempt: state.publishCount,
          exitCode: 1
        }))
        return PublisherExited.make({
          commitment: "started",
          exitCode: 1,
          stdout: "",
          stderr: "The exact package version coordinate was already consumed."
        })
      }
      if (state.publishResult === "exit-nonzero") {
        events.push(processExit({
          provider: "npm",
          phase: "mutate",
          attempt: state.publishCount,
          exitCode: 17
        }))
        return PublisherExited.make({
          commitment: "started",
          exitCode: 17,
          stdout: "",
          stderr: "The publisher rejected the prepared operation."
        })
      }
      if (state.publishResult === "stdout-failure" || state.publishResult === "stderr-failure") {
        events.push(streamFailure({
          provider: "npm",
          phase: "mutate",
          attempt: state.publishCount,
          stream: state.publishResult === "stdout-failure" ? "stdout" : "stderr",
          reason: "Injected output collection failure."
        }))
        return PublisherOutcomeUnknown.make({
          commitment: "unknown",
          reason: "protocol output collection failed after process start"
        })
      }
      if (state.publishResult === "signal") {
        events.push(processSignal({
          provider: "npm",
          phase: "mutate",
          attempt: state.publishCount,
          signal: "SIGTERM"
        }))
        return PublisherOutcomeUnknown.make({
          commitment: "unknown",
          reason: "protocol process was interrupted after start"
        })
      }
      if (state.packageVisibility === "visible" && state.versionState !== "absent") {
        events.push(processExit({
          provider: "npm",
          phase: "mutate",
          attempt: state.publishCount,
          exitCode: 1
        }))
        return PublisherExited.make({
          commitment: "started",
          exitCode: 1,
          stdout: "",
          stderr: "The exact package version now exists."
        })
      }
      state.packageVisibility = "visible"
      state.versionState = "equivalent"
      state.distTagState = "equivalent"
      if (state.publishResult === "response-loss") {
        events.push(faultInjected({
          provider: "npm",
          phase: "mutate",
          attempt: state.publishCount,
          point: "after-provider-accept-before-result",
          commitment: "unknown"
        }))
        return PublisherOutcomeUnknown.make({
          commitment: "unknown",
          reason: "protocol response lost after dispatch"
        })
      }
      events.push(processExit({
        provider: "npm",
        phase: "mutate",
        attempt: state.publishCount,
        exitCode: 0
      }))
      return PublisherExited.make({
        commitment: "started",
        exitCode: 0,
        stdout: JSON.stringify({ id: `${input.packageName}@${input.version}` }),
        stderr: ""
      })
    })
  }

  return { state, events, http, userConfigs, publisher }
}
