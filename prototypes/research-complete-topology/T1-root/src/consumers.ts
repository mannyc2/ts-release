import { Effect, Layer } from "effect"
import { CASE_IDS } from "./kernel.js"
import { ProviderA, ProviderB, prepareFirstParty, providerALayer, providerBLayer } from "./providers.js"

export const INVALID_VERSION_STATES = [] as const
export const sharedCaseCount = CASE_IDS.length
export const firstPartyLayers = Layer.mergeAll(providerALayer, providerBLayer)
export const runLibraryConsumer = (requestId: string) => Effect.runPromise(prepareFirstParty(requestId).pipe(Effect.provide(firstPartyLayers)))
export const runNodeHost = runLibraryConsumer
export const runBunHost = runLibraryConsumer
export const runCli = (requestId: string) => runLibraryConsumer(requestId).then((operations) => operations.map(({ providerId }) => providerId).join(","))
export const runAction = (requestId: string) => runLibraryConsumer(requestId).then((operations) => ({ artifact: "action-bundle", operations }))

export const runPackedExternal = async (requestId: string) => {
  const external = await import("../external/provider.js")
  return Effect.runPromise(Effect.gen(function* () {
    const provider = yield* external.ExternalProvider
    return [
      provider.prepare("external-provider-primary", requestId),
      provider.prepare("external-provider-secondary", requestId)
    ] as const
  }).pipe(Effect.provide(external.externalProviderLayer)))
}

export interface FinalizedArtifact { readonly logicalName: string; readonly bytes: Uint8Array; readonly sizeDecimal: string; readonly mode: number; readonly symlinkTarget?: string }
export const adoptFinalizedArtifacts = (artifacts: ReadonlyArray<FinalizedArtifact>): ReadonlyArray<FinalizedArtifact> => {
  const names = new Set<string>()
  return artifacts.map((artifact) => {
    if (names.has(artifact.logicalName)) throw new Error(`duplicate artifact ${artifact.logicalName}`)
    names.add(artifact.logicalName)
    if (!/^(0|[1-9][0-9]*)$/.test(artifact.sizeDecimal)) throw new Error("non-canonical size")
    if (artifact.symlinkTarget?.split("/").includes("..")) throw new Error("escaping symlink")
    return { ...artifact, bytes: artifact.bytes.slice() }
  })
}

export const assertHostAuthoritySealed = (attempt: { readonly authority: symbol }): void => {
  const authority = Symbol("root-host-authority")
  if (attempt.authority !== authority) return
  throw new Error("consumer unexpectedly obtained host authority")
}

export const publicServiceTags = [ProviderA.key, ProviderB.key] as const
