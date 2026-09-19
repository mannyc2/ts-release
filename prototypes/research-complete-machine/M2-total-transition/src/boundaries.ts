const mustReject = (operation: () => unknown, label: string): void => {
  try {
    operation()
  } catch {
    return
  }
  throw new Error(`${label} was accepted`)
}

export class CasJournal<Event> {
  readonly #events: Array<Event> = []
  get revision(): number { return this.#events.length }
  read(): ReadonlyArray<Event> { return this.#events.slice() }
  append(expected: number, event: Event): boolean {
    if (expected !== this.revision) return false
    this.#events.push(event)
    return true
  }
}

export const exerciseCasContenders = (): void => {
  const journal = new CasJournal<string>()
  const revision = journal.revision
  const winners = [journal.append(revision, "a"), journal.append(revision, "b")].filter(Boolean)
  if (winners.length !== 1 || journal.revision !== 1) throw new Error("CAS winner invariant failed")
}

export const validateProviderDag = (nodes: ReadonlyArray<{ readonly id: string; readonly needs: ReadonlyArray<string> }>): void => {
  const ids = new Set<string>()
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`duplicate provider ${node.id}`)
    ids.add(node.id)
  }
  for (const node of nodes) for (const dependency of node.needs) {
    if (!ids.has(dependency)) throw new Error(`dangling provider dependency ${dependency}`)
  }
}

export const exerciseMalformedProviderDag = (): void => mustReject(
  () => validateProviderDag([{ id: "provider", needs: ["missing"] }, { id: "provider", needs: [] }]),
  "malformed provider DAG"
)

export const exerciseExternalProvider = (): void => {
  validateProviderDag([{ id: "kernel", needs: [] }, { id: "external", needs: ["kernel"] }])
  const instances = new Set(["external:primary:endpoint-a:credential-a", "external:secondary:endpoint-b:credential-b"])
  if (instances.size !== 2) throw new Error("external provider instances collapsed")
}

interface FinalArtifact {
  readonly logicalName: string
  readonly sizeDecimal: string
  readonly mode: number
  readonly bytes: Uint8Array
  readonly symlinkTarget?: string
}

const adopt = (artifacts: ReadonlyArray<FinalArtifact>): ReadonlyArray<FinalArtifact> => {
  const names = new Set<string>()
  return artifacts.map((artifact) => {
    if (names.has(artifact.logicalName)) throw new Error("duplicate artifact name")
    names.add(artifact.logicalName)
    if (!/^(0|[1-9][0-9]*)$/.test(artifact.sizeDecimal)) throw new Error("invalid decimal size")
    BigInt(artifact.sizeDecimal)
    if (artifact.symlinkTarget?.split("/").includes("..")) throw new Error("symlink traversal")
    return { ...artifact, bytes: artifact.bytes.slice() }
  })
}

export const exerciseArtifactBoundary = (): void => {
  const huge = "900719925474099312345678901234567890"
  const adopted = adopt([
    { logicalName: "archive", sizeDecimal: huge, mode: 0o644, bytes: Uint8Array.from([1, 2]) },
    { logicalName: "link", sizeDecimal: "0", mode: 0o120000, bytes: new Uint8Array(), symlinkTarget: "dist/archive" }
  ])
  if (adopted[0]?.sizeDecimal !== huge || adopted[1]?.mode !== 0o120000) throw new Error("lossy artifact adoption")
  mustReject(() => adopt([
    { logicalName: "same", sizeDecimal: "0", mode: 0o644, bytes: new Uint8Array() },
    { logicalName: "same", sizeDecimal: "0", mode: 0o644, bytes: new Uint8Array() }
  ]), "duplicate artifact")
  mustReject(() => adopt([{ logicalName: "link", sizeDecimal: "0", mode: 0o120000, bytes: new Uint8Array(), symlinkTarget: "../escape" }]), "escaping symlink")
  const mutable = Uint8Array.from([1, 2, 3])
  const snapshot = adopt([{ logicalName: "mutable", sizeDecimal: "3", mode: 0o644, bytes: mutable }])[0]!
  mutable[0] = 9
  if (snapshot.bytes[0] !== 1) throw new Error("finalized bytes remained producer-owned")
}

const hostToken = Symbol("host-token")
export const exerciseHostOwnership = (): void => {
  const host = Object.freeze({ token: hostToken, journal: new CasJournal<string>(), dispatch: (id: string) => `host:${id}` })
  const consumer = { token: Symbol("consumer-token"), dispatch: (_id: string) => "consumer" }
  mustReject(() => { if (consumer.token !== host.token) throw new Error("sealed host token mismatch") }, "host shadow")
  if (host.dispatch("operation") !== "host:operation" || host.journal.revision !== 0) throw new Error("consumer changed host services")
}

export class LimitedStore {
  readonly #values = new Map<string, Uint8Array>()
  constructor(readonly limit: number) {}
  write(key: string, bytes: Uint8Array): void {
    if (bytes.byteLength > this.limit) throw new Error("write over limit")
    this.#values.set(key, bytes.slice())
  }
  inject(key: string, bytes: Uint8Array): void { this.#values.set(key, bytes.slice()) }
  read(key: string): Uint8Array {
    const bytes = this.#values.get(key)
    if (bytes === undefined) throw new Error("missing value")
    if (bytes.byteLength > this.limit) throw new Error("read over limit")
    return bytes.slice()
  }
}
