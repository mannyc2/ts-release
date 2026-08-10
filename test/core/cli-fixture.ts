import type { InspectOutput, ReleaseApi } from "../../src/api/types.js"
import type { CliApi, CliIo } from "../../apps/release-ts/src/cli/commands.js"

export const emptyInspection = {} as unknown as InspectOutput
export const emptyBundle = { directory: "/tmp/prepared", manifest: {}, blobs: new Map() } as unknown as Awaited<ReturnType<ReleaseApi["prepare"]>>

export const cliApi = (overrides: Partial<CliApi> = {}): CliApi => ({
  inspect: async () => emptyInspection,
  prepare: async () => emptyBundle,
  publish: async () => [],
  release: async () => ({ prepared: emptyBundle, publications: [] }),
  correct: async () => ({}) as never,
  ...overrides
})

export const ioFor = (files: Record<string, string> = {}): CliIo & { readonly logs: string[] } => {
  const logs: string[] = []
  return {
    logs,
    read: (path) => files[path] ?? (() => { throw new Error(`missing ${path}`) })(),
    write: (path, value) => { files[path] = value },
    log: (value) => { logs.push(value) }
  }
}

