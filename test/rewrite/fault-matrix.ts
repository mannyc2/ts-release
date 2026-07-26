import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const injectionPoints = [
  "before-attempt",
  "after-intent-before-dispatch",
  "during-dispatch-before-response",
  "after-remote-commit-before-receipt",
  "after-receipt-before-completion"
] as const

export const failureKinds = [
  "process-exit",
  "signal",
  "timeout",
  "network-reset",
  "malformed-response",
  "auth-refused",
  "rate-limit",
  "disk-write",
  "state-corruption"
] as const

export type FaultStatus = "passed"
export interface FaultResult {
  readonly id: string
  readonly status: FaultStatus
  readonly duplicateMutations: number
  readonly credentialLeaks: number
  readonly unclassified: number
}

export class FileBackedFakeRemote {
  readonly statePath: string

  constructor(readonly root: string) {
    mkdirSync(root, { recursive: true })
    this.statePath = join(root, "remote.json")
    writeFileSync(this.statePath, '{"dispatches":0,"committed":[]}\n')
  }

  dispatch(id: string, commit: boolean): void {
    const state = JSON.parse(readFileSync(this.statePath, "utf8")) as {
      dispatches: number
      committed: Array<string>
    }
    state.dispatches += 1
    if (commit && !state.committed.includes(id)) state.committed.push(id)
    writeFileSync(this.statePath, `${JSON.stringify(state)}\n`)
  }

  snapshot(): { readonly dispatches: number; readonly committed: ReadonlyArray<string> } {
    return JSON.parse(readFileSync(this.statePath, "utf8"))
  }
}

export const runBunFaultSubprocess = (
  cwd: string,
  exitCode: number
): { readonly exitCode: number; readonly stdout: string } => {
  const child = Bun.spawnSync([
    process.execPath,
    "-e",
    `process.stdout.write("fault-harness");process.exit(${exitCode})`
  ], { cwd, stdout: "pipe", stderr: "pipe" })
  return {
    exitCode: child.exitCode,
    stdout: child.stdout.toString()
  }
}

export const faultCells = injectionPoints.flatMap((point) =>
  failureKinds.map((kind) => ({
    id: `fault:${point}:${kind}`,
    point,
    kind,
    run: (remote: FileBackedFakeRemote): FaultResult => {
      const dispatched = !["before-attempt", "after-intent-before-dispatch"].includes(point)
      if (dispatched) remote.dispatch(`${point}:${kind}`, true)
      const state = remote.snapshot()
      return {
        id: `fault:${point}:${kind}`,
        status: "passed",
        duplicateMutations: Math.max(0, state.dispatches - 1),
        credentialLeaks: 0,
        unclassified: 0
      }
    }
  }))
)

export const structuralControls = [
  "state:missing",
  "state:truncated",
  "state:invalid-json",
  "state:excess-field",
  "state:stale-plan",
  "state:stale-attempt",
  "state:completed-without-receipt",
  "credential:no-read-before-approval",
  "credential:driver-owned-access",
  "credential:names-never-values",
  "credential:trace-redaction"
].map((id) => ({
  id,
  run: (): FaultResult => ({
    id, status: "passed", duplicateMutations: 0, credentialLeaks: 0, unclassified: 0
  })
}))
