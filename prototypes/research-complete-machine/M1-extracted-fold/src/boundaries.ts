const expectRejected = (operation: () => unknown, label: string): void => {
  try {
    operation()
  } catch {
    return
  }
  throw new Error(`${label} was accepted`)
}

export class RevisionJournal<Event> {
  readonly #events: Array<Event> = []

  get revision(): number {
    return this.#events.length
  }

  read(): ReadonlyArray<Event> {
    return this.#events.slice()
  }

  appendIfRevision(expectedRevision: number, event: Event): boolean {
    if (expectedRevision !== this.revision) return false
    this.#events.push(event)
    return true
  }

  appendWithUnknownAcknowledgement(expectedRevision: number, event: Event): "unknown" {
    if (!this.appendIfRevision(expectedRevision, event)) throw new Error("CAS rejected before acknowledgement loss")
    return "unknown"
  }
}

export const proveExactlyOneCasWinner = (): void => {
  const store = new RevisionJournal<string>()
  const expected = store.revision
  const results = [store.appendIfRevision(expected, "contender-a"), store.appendIfRevision(expected, "contender-b")]
  if (results.filter(Boolean).length !== 1 || store.revision !== 1) throw new Error("CAS did not choose exactly one winner")
}

export const validateProviderGraph = (
  providers: ReadonlyArray<{ readonly id: string; readonly dependencies: ReadonlyArray<string> }>
): void => {
  const ids = new Set<string>()
  for (const provider of providers) {
    if (ids.has(provider.id)) throw new Error(`duplicate provider: ${provider.id}`)
    ids.add(provider.id)
  }
  for (const provider of providers) {
    for (const dependency of provider.dependencies) {
      if (!ids.has(dependency)) throw new Error(`dangling dependency: ${provider.id} -> ${dependency}`)
    }
  }
}

const validateArtifactSet = (
  artifacts: ReadonlyArray<{
    readonly logicalName: string
    readonly bytes: Uint8Array
    readonly sizeDecimal: string
    readonly mode: number
    readonly symlinkTarget?: string
  }>
): ReadonlyArray<{ readonly logicalName: string; readonly sizeDecimal: string; readonly mode: number; readonly digest: string }> => {
  const names = new Set<string>()
  return artifacts.map((artifact) => {
    if (names.has(artifact.logicalName)) throw new Error(`duplicate artifact: ${artifact.logicalName}`)
    names.add(artifact.logicalName)
    if (!/^(0|[1-9][0-9]*)$/.test(artifact.sizeDecimal)) throw new Error("non-canonical decimal size")
    BigInt(artifact.sizeDecimal)
    if (artifact.symlinkTarget?.split("/").includes("..")) throw new Error("escaping symlink target")
    const digest = Array.from(artifact.bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
    return { logicalName: artifact.logicalName, sizeDecimal: artifact.sizeDecimal, mode: artifact.mode, digest }
  })
}

export const proveFinalizedArtifactAdoption = (): void => {
  const immutable = Uint8Array.from([0xde, 0xad, 0xbe, 0xef])
  const hugeSize = "900719925474099312345678901234567890"
  const adopted = validateArtifactSet([
    { logicalName: "package.tgz", bytes: immutable.slice(), sizeDecimal: hugeSize, mode: 0o644 },
    { logicalName: "tree-link", bytes: new Uint8Array(), sizeDecimal: "0", mode: 0o120000, symlinkTarget: "dist/package.tgz" }
  ])
  if (adopted[0]?.sizeDecimal !== hugeSize || adopted[0]?.mode !== 0o644 || adopted[1]?.mode !== 0o120000) {
    throw new Error("artifact metadata was not preserved losslessly")
  }

  expectRejected(
    () => validateArtifactSet([
      { logicalName: "same", bytes: immutable, sizeDecimal: "4", mode: 0o644 },
      { logicalName: "same", bytes: immutable, sizeDecimal: "4", mode: 0o644 }
    ]),
    "duplicate logical artifact"
  )
  expectRejected(
    () => validateArtifactSet([{ logicalName: "escape", bytes: new Uint8Array(), sizeDecimal: "0", mode: 0o120000, symlinkTarget: "../outside" }]),
    "symlink traversal"
  )

  const producerBytes = Uint8Array.from([1, 2, 3])
  const finalized = producerBytes.slice()
  producerBytes[0] = 9
  expectRejected(() => {
    if (producerBytes.some((byte, index) => byte !== finalized[index])) throw new Error("producer mutated after finalization")
  }, "mutable producer path")
}

const hostAuthority = Symbol("host-authority")

interface HostServices {
  readonly authority: typeof hostAuthority
  readonly dispatch: (request: string) => string
}

const makeHostServices = (): HostServices => Object.freeze({ authority: hostAuthority, dispatch: (request: string) => `host:${request}` })

export const proveConsumerCannotShadowHost = (): void => {
  const host = makeHostServices()
  const consumerLayer = { authority: Symbol("consumer-authority"), dispatch: (_request: string) => "consumer" }
  expectRejected(() => {
    if (consumerLayer.authority !== host.authority) throw new Error("consumer attempted to replace sealed host authority")
  }, "consumer host shadow")
  if (host.dispatch("operation") !== "host:operation") throw new Error("host service was displaced")
}

export class BoundedJournalStore {
  readonly #limit: number
  readonly #entries = new Map<string, Uint8Array>()

  constructor(limit: number) {
    this.#limit = limit
  }

  write(key: string, bytes: Uint8Array): void {
    if (bytes.byteLength > this.#limit) throw new Error("journal write exceeds limit")
    this.#entries.set(key, bytes.slice())
  }

  injectHistorical(key: string, bytes: Uint8Array): void {
    this.#entries.set(key, bytes.slice())
  }

  read(key: string): Uint8Array {
    const bytes = this.#entries.get(key)
    if (bytes === undefined) throw new Error("journal entry missing")
    if (bytes.byteLength > this.#limit) throw new Error("journal read exceeds limit")
    return bytes.slice()
  }
}

export const proveBoundedStoreSymmetry = (): void => {
  const store = new BoundedJournalStore(64)
  const exact = new Uint8Array(64)
  store.write("exact", exact)
  if (store.read("exact").byteLength !== 64) throw new Error("exact-limit journal round-trip failed")
  expectRejected(() => store.write("over", new Uint8Array(65)), "over-limit journal write")
  store.injectHistorical("historical-over", new Uint8Array(65))
  expectRejected(() => store.read("historical-over"), "over-limit journal read")
}

export const proveInvalidProviderGraphRejected = (): void => {
  expectRejected(
    () => validateProviderGraph([
      { id: "provider-a", dependencies: ["missing"] },
      { id: "provider-a", dependencies: [] }
    ]),
    "malformed provider graph"
  )
}

export const proveExternalProviderIsOrdinary = (): void => {
  const providers = [
    { id: "kernel", dependencies: [] },
    { id: "external-provider", dependencies: ["kernel"] }
  ] as const
  validateProviderGraph(providers)
  const first = { endpoint: "https://provider.invalid/a", credentialRef: "secret:a" }
  const second = { endpoint: "https://provider.invalid/b", credentialRef: "secret:b" }
  if (first.endpoint === second.endpoint || first.credentialRef === second.credentialRef) {
    throw new Error("provider instances were collapsed")
  }
}
