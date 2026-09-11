import { randomUUID } from "node:crypto"
import { chmod, cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect, FileSystem, Layer, type Crypto, type Path } from "effect"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Artifact from "effect-build/Artifact"
import * as Apple from "effect-build-apple"
import { adoptFile, adoptTree } from "../../../packages/ts-release/src/EffectBuild.js"
import { fileContentOwner } from "../../../packages/ts-release/src/Node.js"
import type { ContentOwner } from "../../../packages/ts-release/src/Bundle.js"
import {
  AppleTools,
  createApplePreparations,
  PREPARATION_FORMAT,
  PRODUCER_VERSION,
  type ApplePreparationInput,
  type ApplePreparations,
  type AppleToolsShape,
} from "../../../packages/ts-release/src/Apple.js"

/** API/protocol fixtures only: nothing here certifies a native Apple tool. */
export const producedBy = { name: "xcrun", version: "70.0.0" }
export const signature = { certificateSha1: "0".repeat(40), secureTimestamp: true as const }
export const run = <A, E>(
  effect: Effect.Effect<A, E, Crypto.Crypto | FileSystem.FileSystem | Path.Path>,
) => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))
export const makeSources = async (
  root: string,
  readOnlyApps = false,
): Promise<{
  owner: ContentOwner
  inputs: ApplePreparationInput[]
  collection: ApplePreparations
}> => {
  const owner = fileContentOwner(join(root, "objects"))
  const inputs: ApplePreparationInput[] = []
  for (const flavor of ["arm64", "x64"] as const) {
    const base = {
      format: PREPARATION_FORMAT,
      principal: "fixture-team",
      credentialRef: "fixture-key",
      producerVersion: PRODUCER_VERSION,
    } as const
    const appRoot = join(root, `source-${flavor}.app`)
    await mkdir(join(appRoot, "Contents"), { recursive: true })
    await writeFile(join(appRoot, "Contents/Info.plist"), "Protocol fixture; not a native app")
    if (readOnlyApps) await chmod(join(appRoot, "Contents"), 0o555)
    const tree = await run(Artifact.directory(appRoot, producedBy))
    inputs.push({
      ...base,
      _tag: "AppPreparation",
      artifactName: `app-${flavor}`,
      bundleName: `Fixture-${flavor}.app`,
      source: await run(adoptTree(owner, `source-${flavor}`, tree)),
      signature: { ...signature, hardenedRuntime: true },
    })
    if (readOnlyApps) await chmod(join(appRoot, "Contents"), 0o755)
    for (const product of ["dmg", "pkg"] as const) {
      const path = join(root, `source-${flavor}.${product}`)
      await writeFile(path, `Protocol ${product}/${flavor}; not a native signed container`)
      const source = await run(
        adoptFile(owner, `source-${flavor}.${product}`, await run(Artifact.file(path, producedBy))),
      )
      inputs.push(
        product === "dmg"
          ? { ...base, _tag: "DmgPreparation", artifactName: `${flavor}.dmg`, source, signature }
          : { ...base, _tag: "PkgPreparation", artifactName: `${flavor}.pkg`, source, signature },
      )
    }
  }
  const collection = await run(
    createApplePreparations(inputs as [ApplePreparationInput, ...ApplePreparationInput[]]),
  )
  return { owner, inputs, collection }
}

/** Protocol doubles for the four native operations, counting every call. */
export const appleDoubles = (lookupProducer: Artifact.Producer = producedBy) => {
  const calls = { submit: 0, info: 0, staple: 0, assess: 0 }
  let status: Apple.Notary.Status = { _tag: "Pending", providerStatus: "In Progress" }
  const tools: AppleToolsShape = {
    submit: (artifact) =>
      Effect.sync(() => {
        calls.submit++
        return {
          submissionId: randomUUID(),
          kind: Apple.Notary.submissionKind(artifact),
          artifact,
          producedBy,
        }
      }),
    info: (reference) =>
      Effect.sync(() => {
        calls.info++
        return { ...reference, status, producedBy: lookupProducer }
      }),
    staple: (input) =>
      Effect.gen(function* () {
        calls.staple++
        const fs = yield* FileSystem.FileSystem
        if (input.artifact.product === "app") {
          const outdir = ("outdir" in input && input.outdir) || input.artifact.path
          yield* Effect.promise(() => cp(input.artifact.path, outdir, { recursive: true }))
          yield* fs.writeFileString(join(outdir, "ticket"), "protocol ticket")
          const current = yield* Artifact.directory(outdir, producedBy)
          return { ...input.artifact, ...current, ticket: input.acceptance }
        }
        const outfile = ("outfile" in input && input.outfile) || input.artifact.path
        const bytes = yield* Effect.promise(() => readFile(input.artifact.path))
        yield* fs.writeFile(outfile, Buffer.concat([bytes, Buffer.from("protocol ticket")]))
        const current = yield* Artifact.file(outfile, producedBy)
        return { ...input.artifact, ...current, ticket: input.acceptance }
      }).pipe(Effect.provide(BunServices.layer), Effect.orDie),
    assess: (artifact) =>
      Effect.sync(() => {
        calls.assess++
        return artifact
      }),
  }
  return {
    calls,
    layer: Layer.succeed(AppleTools, tools),
    status: (value: Apple.Notary.Status) => {
      status = value
    },
  }
}
