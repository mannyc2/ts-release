import { Crypto, Effect, FileSystem, Option, Path, PlatformError, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import * as Apple from "effect-build-apple"
import { adoptFile, adoptTree, restoreTree } from "../EffectBuild.js"
import { AdoptionError, identityOf, type OwnedFile } from "../internal/ArtifactModel.js"
import { encodeBundle, loadBundle } from "../internal/BundleCodec.js"
import { finalize } from "../internal/BundleFinalize.js"
import { captureContentOwner, readVerifiedContent, type ContentOwner } from "../internal/Content.js"
import { attempt, failure, type ReleaseError } from "../internal/Error.js"
import { decodeOwned, sameBytes } from "../internal/Identity.js"
import { ApplePreparation, ReadyToPlan, productOf, sourceIdentity } from "./Model.js"
import { classifyEvidence, sourceCorresponds } from "./Provider.js"
import { AppleTools, type AppleToolError } from "./Tools.js"

export type NativeAppleError =
  | ReleaseError
  | AdoptionError
  | Schema.SchemaError
  | PlatformError.PlatformError
  | AppleToolError
  | Apple.Notary.ResultNotAccepted
export type NativeAppleServices = FileSystem.FileSystem | Path.Path | Crypto.Crypto | AppleTools
export type DeriveDeliveryFiles<R = never> = (
  assessed: Apple.StapledProduct,
) => Effect.Effect<readonly OwnedFile[], NativeAppleError, R>
const mismatch = () => failure("apple-native-binding", "Apple native evidence differs")

/** A private directory that is always removable afterwards: native app trees can
 * hold read-only nested directories, so every real directory is reopened first. */
const privateWorkspace = Effect.fn("apple.privateWorkspace")(function* (
  directory: string,
  prefix: string,
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const makeRemovable = (root: string) =>
    Effect.gen(function* () {
      const pending = [root]
      while (pending.length) {
        const current = pending.pop()!
        yield* fs.chmod(current, 0o700)
        for (const name of yield* fs.readDirectory(current)) {
          const entry = path.join(current, name)
          if (Option.isSome(yield* Effect.option(fs.readLink(entry)))) continue
          if ((yield* fs.stat(entry)).type === "Directory") pending.push(entry)
        }
      }
    })
  return yield* Effect.acquireRelease(fs.makeTempDirectory({ directory, prefix }), (root) =>
    makeRemovable(root).pipe(
      Effect.andThen(fs.remove(root, { recursive: true, force: true })),
      Effect.orDie,
    ),
  )
})

/** Recreate the signed source bytes in `workspace`; native Apple tools reverify the signature. */
export const restorePreparedSource = Effect.fn("apple.restoreSource")(function* (
  value: ApplePreparation,
  contentOwner: ContentOwner,
  workspace: string,
): Effect.fn.Return<Apple.SignedProduct, NativeAppleError, NativeAppleServices> {
  const owner = captureContentOwner(contentOwner)
  const input = yield* attempt(() => decodeOwned(ApplePreparation, value))
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  if (!path.isAbsolute(workspace)) return yield* mismatch()
  yield* fs.makeDirectory(workspace, { recursive: true })
  if (input._tag === "AppPreparation") {
    const directory = yield* restoreTree(
      owner,
      input.source,
      path.join(workspace, input.bundleName),
    )
    const app = { ...directory, product: "app" as const, signature: input.signature }
    if (!Schema.is(Apple.SignedApp)(app)) return yield* mismatch()
    return app
  }
  const destination = path.join(workspace, `source.${productOf(input)}`)
  const identity = sourceIdentity(input)
  const bytes = yield* readVerifiedContent(owner.read, identity, identity.bytes)
  yield* fs.writeFile(destination, bytes)
  const file = yield* Artifact.file(destination, input.source.producedBy)
  if (file.bytes !== identity.bytes || file.sha256 !== identity.sha256) return yield* mismatch()
  return input._tag === "DmgPreparation"
    ? { ...file, product: "dmg" as const, signature: input.signature }
    : { ...file, product: "pkg" as const, signature: input.signature }
})

export const submitPrepared = Effect.fn("apple.submitPrepared")(function* (
  value: ApplePreparation,
  contentOwner: ContentOwner,
  workspace: string,
) {
  const owner = captureContentOwner(contentOwner)
  const tools = yield* AppleTools
  const input = yield* attempt(() => decodeOwned(ApplePreparation, value))
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const privateRoot = yield* privateWorkspace(workspace, "apple-submit-")
      const source = yield* restorePreparedSource(input, owner, privateRoot)
      return yield* tools.submit(source)
    }),
  )
})

/** Staple beside the restored source; an app keeps its bundle name, which is part of its identity. */
const staple = (
  tools: AppleTools["Service"],
  source: Apple.SignedProduct,
  acceptance: Apple.Notary.AcceptedReference,
  privateRoot: string,
  path: Path.Path,
) =>
  source.product === "app"
    ? tools.staple({
        artifact: source,
        acceptance,
        outdir: path.join(privateRoot, path.basename(source.path)),
      })
    : tools.staple({
        artifact: source,
        acceptance,
        outfile: path.join(privateRoot, `final.${source.product}`),
      })

/**
 * Poll only the recorded submission. Accepted bytes are restored, stapled,
 * assessed, then adopted; the resulting outputs become durable only through
 * the journal's one compare-and-swap.
 */
export const finishPrepared = Effect.fn("apple.finishPrepared")(function* <R = never>(
  value: ApplePreparation,
  recorded: Apple.Notary.SubmissionReference,
  preparationId: string,
  contentOwner: ContentOwner,
  workspace: string,
  deriveDeliveryFiles?: DeriveDeliveryFiles<R>,
) {
  const owner = captureContentOwner(contentOwner)
  const tools = yield* AppleTools
  const input = yield* attempt(() => decodeOwned(ApplePreparation, value))
  const submission = yield* attempt(() => decodeOwned(Apple.Notary.SubmissionReference, recorded))
  if (!sourceCorresponds(input, submission)) return yield* mismatch()
  const info = yield* tools.info(submission)
  yield* attempt(() => classifyEvidence(input, preparationId, info, [submission]))
  if (info.status._tag !== "Accepted") return info
  const acceptance = yield* Apple.Notary.acceptedReference(info)
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const path = yield* Path.Path
      const privateRoot = yield* privateWorkspace(workspace, "apple-finish-")
      const source = yield* restorePreparedSource(input, owner, path.join(privateRoot, "source"))
      const stapled = yield* staple(tools, source, acceptance, privateRoot, path)
      const assessed = yield* tools.assess(stapled)
      if (assessed.product !== productOf(input)) return yield* mismatch()
      const adopted =
        assessed.product === "app"
          ? yield* adoptTree(owner, input.artifactName, assessed)
          : yield* adoptFile(owner, input.artifactName, assessed)
      const finalArtifact = {
        product: assessed.product,
        logicalName: adopted.logicalName,
        identity: identityOf(adopted),
      }
      const derived = deriveDeliveryFiles ? yield* deriveDeliveryFiles(assessed) : []
      if (derived.some((artifact) => artifact._tag !== "OwnedFile")) return yield* mismatch()
      const outputs = yield* finalize([adopted, ...derived])
      const bytes = encodeBundle(outputs)
      const outputsBundleContent = yield* owner.putOwned(bytes)
      // Read the outputs back through their recorded identity before evidence names them.
      const stored = yield* readVerifiedContent(owner.read, outputsBundleContent, bytes.length)
      if (!sameBytes(stored, bytes)) return yield* mismatch()
      yield* loadBundle(owner, stored)
      const ready = yield* attempt(() =>
        decodeOwned(ReadyToPlan, {
          _tag: "ReadyToPlan",
          preparationId,
          assessed,
          finalArtifact,
          outputsBundleContent,
        }),
      )
      yield* attempt(() => classifyEvidence(input, preparationId, ready, [submission]))
      return ready
    }),
  )
})
