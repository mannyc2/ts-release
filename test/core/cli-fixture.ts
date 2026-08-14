import * as Effect from "effect/Effect"
import { realpathSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import type { ReleaseApi } from "../../src/api/types.js"
import type { ObservationReport, ReleaseReport } from "../../src/publication/report.js"
import {
  makeGitHubActionsCompletePreparedReleaseRef,
  makeLocalCompletePreparedReleaseRef
} from "../../src/release/prepared-ref.js"
import type {
  CliApi,
  CliApiFactory,
  CliIo
} from "../../apps/release-ts/src/cli/commands.js"

export const emptyInspection = {} as unknown as Awaited<ReturnType<ReleaseApi["inspect"]>>
export const localPrepared = Effect.runSync(makeLocalCompletePreparedReleaseRef("a".repeat(64)))
export const hostedPrepared = Effect.runSync(makeGitHubActionsCompletePreparedReleaseRef({
  owner: "owner",
  repository: "project",
  runId: "7",
  attempt: "2",
  artifactName: "prepared-release",
  digest: "b".repeat(64)
}))

export const completeReport = {
  status: "complete",
  subjects: [{ _tag: "AlreadyEquivalent" }]
} as unknown as ReleaseReport

export const blockedReport = {
  status: "blocked",
  subjects: [{ _tag: "BlockedSubject" }]
} as unknown as ReleaseReport

export const uncertainReport = {
  status: "uncertain",
  subjects: [{ _tag: "UncertainSubject" }]
} as unknown as ReleaseReport

export const observationReport = {
  status: "equivalent",
  subjects: [{ observation: { _tag: "Equivalent" } }]
} as unknown as ObservationReport

export const cliApi = (overrides: Partial<CliApi> = {}): CliApi => ({
  inspect: async () => emptyInspection,
  prepare: async () => localPrepared,
  observe: async () => observationReport,
  publish: async () => completeReport,
  release: async () => ({ prepared: localPrepared, report: completeReport }),
  correct: async ({ prepared }) => ({
    prepared,
    status: "unsupported",
    reason: "fixture"
  }) as Awaited<ReturnType<ReleaseApi["correct"]>>,
  ...overrides
})

export const cliApiFactory = (
  overrides: Partial<CliApi> = {},
  onStore?: (storeDirectory: string) => void
): CliApiFactory => (storeDirectory) => {
  onStore?.(storeDirectory)
  return {
    ...cliApi(overrides),
    dispose: async () => {}
  }
}

export const ioFor = (
  files: Record<string, string> = {}
): CliIo & { readonly logs: string[] } => {
  const logs: string[] = []
  const key = (path: string): string => {
    try { return join(realpathSync(dirname(path)), basename(path)) } catch { return path }
  }
  const values = Object.fromEntries(Object.entries(files).map(([path, value]) => [key(path), value]))
  return {
    logs,
    read: (path) => values[key(path)] ?? (() => { throw new Error(`missing ${path}`) })(),
    write: (path, value) => { values[key(path)] = value },
    log: (value) => { logs.push(value) }
  }
}
