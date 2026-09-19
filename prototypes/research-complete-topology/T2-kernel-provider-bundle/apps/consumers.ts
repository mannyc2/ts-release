import { Effect } from "effect"
import { firstPartyLayers, prepareFirstParty } from "../packages/providers/src/index.js"

export const INVALID_VERSION_STATES = [
  "kernel-next/providers-current",
  "kernel-current/providers-next"
] as const

export const runLibraryConsumer = (requestId: string) => Effect.runPromise(prepareFirstParty(requestId).pipe(Effect.provide(firstPartyLayers)))
export const runNodeHost = runLibraryConsumer
export const runBunHost = runLibraryConsumer
export const runCli = (requestId: string) => runLibraryConsumer(requestId).then((values) => values.map(({ providerId }) => providerId).join(","))
export const runAction = (requestId: string) => runLibraryConsumer(requestId).then((operations) => ({ artifact: "action-bundle", operations }))
export const runPackedExternal = async (requestId: string) => {
  const external = await import("../external/provider.js")
  return Effect.runPromise(Effect.gen(function* () { const provider = yield* external.ExternalProvider; return provider.instances.map(({ id }) => provider.prepare(id, requestId)) }).pipe(Effect.provide(external.externalProviderLayer)))
}

export interface FinalizedArtifact { readonly logicalName: string; readonly bytes: Uint8Array; readonly sizeDecimal: string; readonly mode: number; readonly symlinkTarget?: string }
export const adoptFinalizedArtifacts = (values: ReadonlyArray<FinalizedArtifact>): ReadonlyArray<FinalizedArtifact> => {
  const names = new Set<string>()
  return values.map((value) => { if (names.has(value.logicalName)) throw new Error("duplicate artifact"); names.add(value.logicalName); if (!/^(0|[1-9][0-9]*)$/.test(value.sizeDecimal)) throw new Error("bad size"); if (value.symlinkTarget?.split("/").includes("..")) throw new Error("escaping link"); return { ...value, bytes: value.bytes.slice() } })
}
export const assertHostAuthoritySealed = (consumerAuthority: symbol): void => { const hostAuthority = Symbol("host"); if (consumerAuthority === hostAuthority) throw new Error("host authority leaked") }
